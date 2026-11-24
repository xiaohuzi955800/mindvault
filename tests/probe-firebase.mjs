/**
 * Phase 2a probe: Firebase provider wiring + App Check debug token.
 *
 * Runs the app in a headless Chromium with a PERSISTENT browser profile
 * (so the App Check debug token the SDK generates is stored in that
 * profile's IndexedDB and stays valid across runs). Captures:
 *
 *   1. The App Check debug token the SDK prints to the console
 *      ("Firebase App Check debug token: ...") — printed to stdout ONLY,
 *      never written to any file.
 *   2. Whether the app loads in firebase mode (no mock banner, no
 *      init-error banner) and degrades gracefully.
 *   3. On-device availability in this browser (LanguageModel / Prompt API).
 *   4. What happens when a real cloud call is attempted before the debug
 *      token is registered in the console (expected: a clear in-app
 *      error, not a crash or blank screen).
 *
 * Usage (from the app dir, with a real `.env` present):
 *   rm -rf /tmp/mindvault-debug-profile   # fresh profile => fresh token
 *   npm run dev                            # in another terminal (:5173)
 *   node tests/probe-firebase.mjs
 *
 * Env overrides:
 *   PROBE_BASE_URL     default http://localhost:5173
 *   PROBE_PROFILE_DIR  default /tmp/mindvault-debug-profile
 *
 * Exit code 0 means the probe itself ran to completion (AI-call failures
 * are expected data here, not probe failures). Non-zero means the probe
 * crashed or the app did not load.
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.PROBE_BASE_URL || 'http://localhost:5173';
const PROFILE_DIR =
  process.env.PROBE_PROFILE_DIR || '/tmp/mindvault-debug-profile';
const HOME = process.env.HOME || '/home/hatch';
const CANDIDATES = [
  `${HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`,
  `${HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`,
];

const TOKEN_RE = /Firebase App Check debug token:\s*([0-9a-fA-F-]{36})/;

const results = {
  appLoaded: false,
  mockBannerVisible: null,
  initErrorBanner: null,
  debugToken: null,
  languageModel: null,
  availability: null,
  statusPill: null,
  simulateTogglePresent: null,
  onDevicePanel: null,
  cloudAttempt: null,
  pageErrors: [],
};

function note(name, value) {
  results[name] = value;
  console.log(`PROBE  ${name}: ${JSON.stringify(value)}`);
}

async function main() {
  const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
  if (!executablePath) {
    console.error('No cached Chromium found. Checked:', CANDIDATES.join(', '));
    process.exit(2);
  }
  const consoleLines = [];
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    executablePath,
    args: ['--no-sandbox'],
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLines.push(text);
    const match = text.match(TOKEN_RE);
    if (match && !results.debugToken) {
      results.debugToken = match[1];
    }
  });
  page.on('pageerror', (err) => {
    results.pageErrors.push(err.message);
    console.log(`PROBE  pageerror: ${err.message}`);
  });

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await page
      .getByRole('heading', { name: 'MindVault' })
      .first()
      .waitFor({ timeout: 15000 });
    note('appLoaded', true);

    // The SDK generates + logs the debug token asynchronously after App
    // Check initializes; give it up to 20 s to appear in the console.
    const deadline = Date.now() + 20000;
    while (!results.debugToken && Date.now() < deadline) {
      await page.waitForTimeout(500);
    }
    note('debugToken', results.debugToken);

    note(
      'mockBannerVisible',
      (await page.getByText('Demo build').count()) > 0,
    );
    const initAlert = page.getByRole('alert').filter({
      hasText: 'Firebase AI could not start',
    });
    note(
      'initErrorBanner',
      (await initAlert.count()) > 0
        ? await initAlert.first().innerText()
        : null,
    );

    // Raw Prompt API probe (independent of the app's own wrapper).
    const lmProbe = await page
      .evaluate(async () => {
        const lm = globalThis.LanguageModel;
        if (!lm || typeof lm.availability !== 'function') {
          return { present: false, availability: null, error: null };
        }
        try {
          const availability = await lm.availability();
          return { present: true, availability, error: null };
        } catch (err) {
          return {
            present: true,
            availability: null,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      })
      .catch((err) => ({
        present: null,
        availability: null,
        error: `probe threw: ${err.message}`,
      }));
    note('languageModel', lmProbe.present);
    note('availability', lmProbe.availability ?? lmProbe.error);

    note(
      'statusPill',
      await page
        .getByTitle('See on-device AI status')
        .innerText()
        .catch(() => null),
    );
    note(
      'simulateTogglePresent',
      (await page
        .getByLabel(/simulate an unavailable device model/i)
        .count()) > 0,
    );

    const panel = page.getByRole('region', { name: 'On-device AI status' });
    const enableButton = page.getByRole('button', {
      name: 'Enable on-device AI',
    });
    if ((await enableButton.count()) > 0) {
      await enableButton.click();
      await page.waitForTimeout(3000);
    }
    note(
      'onDevicePanel',
      (await panel.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600),
    );

    // Attempt a real cloud call with the debug token NOT yet registered in
    // the console. Expected: the consent flow works, the call fails, and a
    // clear error is shown in the app (no crash, no blank screen). Skipped
    // when the provider fell back to mock (init error) — then the call
    // would be simulated, not real.
    if (results.initErrorBanner) {
      note('cloudAttempt', 'skipped (provider fell back to mock)');
    } else {
      await probeCloudCall(page);
    }
  } finally {
    await context.close();
  }

  console.log('\n=== PROBE SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
  if (!results.appLoaded) {
    console.log('PROBE FAILED: app did not load');
    process.exit(1);
  }
  if (!results.debugToken) {
    console.log(
      'PROBE NOTE: no debug token was printed to the console. ' +
        'This happens when the profile already has a stored token — ' +
        'use a fresh profile dir (rm -rf it first) to capture a new one.',
    );
  }
}

async function probeCloudCall(page) {
    // Use a FRESH note: the seeded entries already carry pre-computed
    // IN-CLOUD results, which would make the badge check meaningless.
    await page.getByRole('button', { name: '+ New entry' }).click();
    await page.waitForFunction(
      () => document.querySelector('#note-title')?.value === '',
      { timeout: 10000 },
    );
    await page.locator('#note-title').fill('Probe entry');
    await page
      .locator('#note-content')
      .fill(
        'A short probe note to test the real cloud path. Today was quiet and I felt calm.',
      );
    await page.getByText(/Saved locally/).first().waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Deep summary', exact: true }).click();
    await page.getByText('Send this note to the cloud?').waitFor({ timeout: 10000 });
    await page
      .getByRole('checkbox', { name: /I understand this note will/ })
      .check();
    await page
      .getByRole('button', { name: 'Send once, with my approval' })
      .click();
    const outcome = await Promise.race([
      page
        .getByText('IN-CLOUD')
        .first()
        .waitFor({ timeout: 45000 })
        .then(() => 'IN-CLOUD badge appeared (call succeeded)'),
      page
        .locator('[role="alert"]')
        .first()
        .waitFor({ timeout: 45000 })
        .then(async () => {
          const text = await page
            .locator('[role="alert"]')
            .first()
            .innerText()
            .catch(() => '');
          return `error shown: ${text.replace(/\s+/g, ' ').slice(0, 500)}`;
        }),
    ]).catch(() => 'neither badge nor error appeared within 45 s');
    note('cloudAttempt', outcome);
}

main().catch((err) => {
  console.error('PROBE CRASHED:', err);
  process.exit(1);
});
