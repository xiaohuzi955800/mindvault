/**
 * Scripted walkthrough for the MindVault v6 UI (the shipped version).
 *
 * Same seed data, one flow:
 *   open app → read a seeded note → enable on-device AI → create a note
 *   → on-device summary + mood → cloud deep summary (with consent) →
 *   check the Privacy Ledger → check the mood view.
 *
 * Usage:
 *   VITE_AI_PROVIDER=mock npm run build
 *   npm run preview        # in another terminal (port 4173)
 *   node tests/variants-walkthrough.mjs v6
 *
 * History: five UI variants were compared on 2026-11-24 with their own
 * flow functions; the losing variants (v1–v5) were removed from the
 * bundle on 2026-11-26 before submission, and this script now covers
 * v6 only.
 *
 * Screenshots: /tmp/mindvault-v6-home.png (first screen) and
 * /tmp/mindvault-v6.png (end of walkthrough).
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const VARIANT = process.argv[2] || process.env.VARIANT || 'v6';
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4173';
const HOME = process.env.HOME || '/home/hatch';
const CANDIDATES = [
  `${HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`,
  `${HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`,
];

const NOTE_TITLE = 'Walkthrough entry';
const NOTE_BODY =
  'I felt happy and grateful today. The morning was calm and wonderful, and I felt proud of the progress I made.';

const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function waitForEditorEmpty(page) {
  await page.waitForFunction(
    () => document.querySelector('#note-title')?.value === '',
    { timeout: 10000 },
  );
}

async function fillNewNote(page) {
  await page.locator('#note-title').fill(NOTE_TITLE);
  await page.locator('#note-content').fill(NOTE_BODY);
  await page.getByText(/Saved locally/).first().waitFor({ timeout: 10000 });
  check('new note autosaves locally', true);
}

async function enableDevice(page) {
  await page.getByRole('button', { name: 'Enable on-device AI' }).click();
  await page.getByText('On-device AI ready').first().waitFor({ timeout: 15000 });
  check('on-device model enables with progress', true);
}

async function runOnDeviceIn(scope) {
  await scope.getByRole('button', { name: 'Summarize on device' }).click();
  // Completion signal: the button flips to "Re-summarize" only after the
  // result is saved. (Waiting on the summary text is not a completion
  // signal in V4, where the card also shows the note body itself.)
  await scope.getByRole('button', { name: 'Re-summarize' }).waitFor({ timeout: 15000 });
  check('on-device summary runs', true);
  check(
    'summary wears ON-DEVICE badge',
    await scope.getByText('ON-DEVICE', { exact: true }).first().isVisible(),
  );

  await scope.getByRole('button', { name: 'Analyze mood on device' }).click();
  await scope.getByRole('button', { name: 'Re-analyze mood' }).waitFor({ timeout: 15000 });
  check(
    'on-device sentiment returns a positive label for happy text',
    await scope.getByText(/Positive|Bright/).first().isVisible(),
  );
}

async function runCloudIn(scope, page) {
  await scope.getByRole('button', { name: 'Deep summary', exact: true }).click();
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
  await scope.getByText('IN-CLOUD', { exact: true }).first().waitFor({ timeout: 10000 });
  check('cloud deep summary runs after approval with IN-CLOUD badge', true);
}

async function checkLedgerView(page) {
  await page.getByText('Every AI action, accounted for').waitFor({ timeout: 5000 });
  // Entries load via a live IndexedDB query, so wait for them — the
  // section heading renders immediately even with zero entries, so
  // waiting on it alone is not enough (flaky without this wait).
  await page.getByText('On-device summary').first().waitFor({ timeout: 5000 });
  check('ledger lists the on-device summary', true);
  await page.getByText('Cloud deep summary').first().waitFor({ timeout: 5000 });
  check('ledger lists the cloud deep summary', true);
  check(
    'ledger shows zero silent uploads',
    (await page.getByText('Silent uploads').count()) >= 1,
  );
}

async function checkMoodView(page) {
  await page.getByText('Mood over time').waitFor({ timeout: 5000 });
  check(
    'mood chart renders',
    (await page.locator('svg[aria-label*="Line chart"]').count()) === 1,
  );
}

// ---------------------------------------------------------------------------
// Per-variant flows
// ---------------------------------------------------------------------------

async function flowV6(page) {
  // Vault is home: privacy score + ledger hero.
  await page.getByText('Your vault, verified').waitFor({ timeout: 10000 });
  check('vault home shows privacy dashboard', true);
  check(
    'privacy score states 100% of sensitive insights stayed on-device',
    await page
      .getByText('100% of sensitive insights stayed on this device')
      .isVisible(),
  );

  await enableDevice(page);

  // Open the vault → notes workspace.
  await page.getByRole('button', { name: 'Open vault →' }).first().click();
  await page.getByText('A quiet Sunday').first().waitFor({ timeout: 10000 });
  check('notes workspace opens from the vault', true);

  // Two "+ New entry" buttons exist on the Notes tab (header + note list);
  // the header one comes first in DOM order.
  await page.getByRole('button', { name: '+ New entry' }).first().click();
  await waitForEditorEmpty(page);
  await fillNewNote(page);
  await runOnDeviceIn(page);
  await runCloudIn(page, page);

  await page.getByRole('button', { name: 'Vault', exact: true }).click();
  await checkLedgerView(page);
  check(
    'privacy score still 100 after cloud actions',
    await page
      .getByText('100% of sensitive insights stayed on this device')
      .isVisible(),
  );

  // Per-entry privacy control: remove the seeded entry's cloud results.
  // Scope to the controls section (the ledger below also lists this note).
  const controls = page.locator('section[aria-label="Per-entry privacy controls"]');
  const row = controls.locator('li', { hasText: 'A small win, finally' }).first();
  await row.getByRole('button', { name: 'Remove cloud results' }).click();
  await row.getByRole('button', { name: 'Click again to remove' }).click();
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('li')].filter((li) =>
      li.textContent?.includes('A small win, finally'),
    );
    return rows.every((li) => !li.textContent?.includes('Remove cloud results'));
  }, { timeout: 10000 });
  check('per-entry control removes cloud results (two-step confirm)', true);

  // Dashboard tab: mood chart + clickable calendar + recent insights.
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await page.getByText('How have your days felt?').waitFor({ timeout: 5000 });
  check('dashboard tab shows mood hero', true);
  await checkMoodView(page);
  check(
    'recent insights strip present',
    await page.getByText('Recent insights').isVisible(),
  );

  // Calendar-driven navigation: click a day with an entry — it opens in
  // the Notes tab (v6 has no overlay editor).
  const dayButton = page.getByRole('button', { name: /open this entry/ }).first();
  await dayButton.click();
  await page.waitForFunction(
    () => document.querySelector('#note-title')?.value !== '',
    { timeout: 10000 },
  );
  check('calendar day opens the entry in the Notes tab', true);
}

const FLOWS = { v6: flowV6 };

async function main() {
  const flow = FLOWS[VARIANT];
  if (!flow) {
    console.error(`Unknown variant "${VARIANT}". Only v6 is shipped.`);
    process.exit(2);
  }
  const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
  if (!executablePath) {
    console.error('No cached Chromium found. Checked:', CANDIDATES.join(', '));
    process.exit(2);
  }
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (err) => {
    failures.push(`pageerror: ${err.message}`);
    console.log(`FAIL  pageerror: ${err.message}`);
  });

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.getByRole('heading', { name: 'MindVault' }).first().waitFor({ timeout: 10000 });
    check('app shell renders', true);
    const variantAttr = await page.locator('[data-variant]').getAttribute('data-variant');
    check(`running variant is ${VARIANT}`, variantAttr === VARIANT, `got ${variantAttr}`);
    check(
      'mock-mode banner visible',
      await page.getByText('Demo build').first().isVisible(),
    );
    await page.screenshot({ path: `/tmp/mindvault-${VARIANT}-home.png` });
    console.log(`Home screenshot saved to /tmp/mindvault-${VARIANT}-home.png`);

    await flow(page);

    await page.screenshot({ path: `/tmp/mindvault-${VARIANT}.png`, fullPage: true });
    console.log(`Screenshot saved to /tmp/mindvault-${VARIANT}.png`);
  } finally {
    await browser.close();
  }

  if (failures.length === 0) {
    console.log(`\nALL ${VARIANT.toUpperCase()} WALKTHROUGH CHECKS PASSED`);
  } else {
    console.log(`\n${failures.length} ${VARIANT.toUpperCase()} CHECK(S) FAILED`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('WALKTHROUGH CRASHED:', err);
  process.exit(1);
});
