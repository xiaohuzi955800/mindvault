/**
 * End-to-end smoke test for MindVault (mock provider).
 *
 * Drives the production build in the cached headless Chromium via
 * playwright-core. Expects a server on SMOKE_BASE_URL (default
 * http://localhost:4173 — `npm run preview`). Tests the DEFAULT variant
 * (v6, the merged submission version): Vault home → Notes workspace →
 * Dashboard. The other variants are covered by tests/variants-walkthrough.mjs.
 *
 * Usage:
 *   VITE_AI_PROVIDER=mock npm run build
 *   npm run preview        # in another terminal
 *   npm run test:smoke
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4173';
const HOME = process.env.HOME || '/home/hatch';
const CANDIDATES = [
  `${HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`,
  `${HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`,
];

const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
  if (!executablePath) {
    console.error('No cached Chromium found. Checked:', CANDIDATES.join(', '));
    process.exit(2);
  }
  const browser = await chromium.launch({
    executablePath,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (err) => {
    failures.push(`pageerror: ${err.message}`);
    console.log(`FAIL  pageerror: ${err.message}`);
  });

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.getByRole('heading', { name: 'MindVault' }).first().waitFor({ timeout: 10000 });
    check('app shell renders', true);

    // Seeded demo data is visible.
    await page.getByText('A quiet Sunday').first().waitFor({ timeout: 10000 });
    check('seeded notes visible', true);
    check(
      'mock-mode banner visible',
      await page.getByText('Demo build').first().isVisible(),
    );

    // Enable the (mock) on-device model.
    await page.getByRole('button', { name: 'Enable on-device AI' }).click();
    await page.getByText('On-device AI ready').first().waitFor({ timeout: 15000 });
    check('on-device model enables with progress', true);

    // Create a note and type into it. Wait for the editor to switch to the
    // new (empty) note first — note creation is async, and filling the title
    // before the switch would type into the previous note's editor.
    await page.getByRole('button', { name: '+ New entry' }).click();
    await page.waitForFunction(
      () => document.querySelector('#note-title')?.value === '',
      { timeout: 10000 },
    );
    await page.locator('#note-title').fill('Smoke test entry');
    await page
      .locator('#note-content')
      .fill(
        'I felt happy and grateful today. The morning was calm and wonderful, and I felt proud of the progress I made.',
      );
    await page.getByText(/Saved locally/).first().waitFor({ timeout: 10000 });
    check('new note autosaves locally', true);

    // On-device summary. Completion signal: the button flips to
    // "Re-summarize" only after the result is saved. (Waiting on
    // getByText('ON-DEVICE') would substring-match the "On-device AI"
    // panel heading and return before the summary exists.)
    await page.getByRole('button', { name: 'Summarize on device' }).click();
    await page.getByRole('button', { name: 'Re-summarize' }).waitFor({ timeout: 15000 });
    const summaryVisible = await page
      .getByText('ON-DEVICE', { exact: true })
      .first()
      .isVisible()
      .catch(() => false);
    check('on-device summary runs and wears ON-DEVICE badge', summaryVisible);

    // On-device sentiment.
    await page.getByRole('button', { name: 'Analyze mood on device' }).click();
    await page
      .getByText(/Positive|Bright/)
      .first()
      .waitFor({ timeout: 15000 });
    check('on-device sentiment returns a positive label for happy text', true);

    // Cloud flow: consent modal first, nothing sent before approval.
    // (exact: the note list also contains "deep summary" indicator text.)
    await page.getByRole('button', { name: 'Deep summary', exact: true }).click();
    await page.getByText('Send this note to the cloud?').waitFor({ timeout: 5000 });
    const excerptVisible = await page
      .getByText(/happy and grateful today/i)
      .first()
      .isVisible();
    check('consent modal shows exactly what will be sent', excerptVisible);
    const confirmButton = page.getByRole('button', {
      name: 'Send once, with my approval',
    });
    check('confirm disabled until checkbox ticked', await confirmButton.isDisabled());
    await page
      .getByRole('checkbox', { name: /I understand this note will/ })
      .check();
    await confirmButton.click();
    await page.getByText('IN-CLOUD', { exact: true }).first().waitFor({ timeout: 10000 });
    check('cloud deep summary runs after approval with IN-CLOUD badge', true);

    // Privacy ledger records everything. In v6 the ledger is the Vault
    // home's hero section (no separate ledger tab). The "Silent uploads"
    // check is scoped to the ledger section — the privacy-score card above
    // it shows the same counter. Entries load via a live IndexedDB query,
    // so wait for them — the section heading renders immediately even
    // with zero entries, so waiting on it alone is not enough.
    await page.getByRole('button', { name: 'Vault', exact: true }).click();
    await page.getByText('Every AI action, accounted for').waitFor({ timeout: 5000 });
    await page.getByText('On-device summary').first().waitFor({ timeout: 5000 });
    check('ledger lists the on-device summary', true);
    await page.getByText('Cloud deep summary').first().waitFor({ timeout: 5000 });
    check('ledger lists the cloud deep summary', true);
    check(
      'ledger shows zero silent uploads',
      (await page
        .locator('section[aria-label="Privacy ledger"]')
        .getByText('Silent uploads')
        .count()) === 1,
    );

    // Seeded photo: open the "small win" entry and check its photo + description.
    await page.getByRole('button', { name: 'Notes', exact: true }).click();
    await page.getByText('A small win, finally').first().click();
    await page
      .getByAltText(/Warm evening light/)
      .first()
      .waitFor({ timeout: 10000 });
    check('seeded photo loads with on-device description', true);

    // Mood timeline renders (v6 Dashboard tab).
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await page.getByText('Mood over time').waitFor({ timeout: 5000 });
    check(
      'mood chart renders',
      (await page.locator('svg[aria-label*="Line chart"]').count()) === 1,
    );

    // Graceful degradation: simulate an unavailable device model.
    await page.getByRole('button', { name: 'Notes', exact: true }).click();
    await page
      .getByLabel(/simulate an unavailable device model/i)
      .check();
    await page
      .getByText('On-device AI is unavailable here.')
      .waitFor({ timeout: 5000 });
    check('unavailable state shows guidance instead of failing silently', true);
    await page
      .getByLabel(/simulate an unavailable device model/i)
      .uncheck();
    await page.getByText('On-device AI ready').first().waitFor({ timeout: 5000 });
    check('un-simulating restores on-device AI', true);

    await page.screenshot({ path: '/tmp/mindvault-smoke.png', fullPage: true });
    console.log('Screenshot saved to /tmp/mindvault-smoke.png');
  } finally {
    await browser.close();
  }

  if (failures.length === 0) {
    console.log('\nALL SMOKE TESTS PASSED');
  } else {
    console.log(`\n${failures.length} SMOKE TEST(S) FAILED`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('SMOKE TEST CRASHED:', err);
  process.exit(1);
});
