/**
 * Node test for the Dexie data layer, seed data, and mock AI provider.
 *
 * Runs against fake-indexeddb (preloaded via `node -r fake-indexeddb/auto`,
 * see package.json "test:db"). No browser needed.
 *
 * Usage: npm run test:db
 */
import {
  CloudNotAuthorizedError,
  OnDeviceUnavailableError,
} from '../src/lib/ai/types';
import {
  mockProvider,
  resetMockDeviceState,
} from '../src/lib/ai/mockProvider';
import {
  clearAllData,
  createNote,
  db,
  deleteNoteAndLedger,
  getLedgerCounts,
  recordLedgerEntry,
  saveAnalysis,
  updateNoteFields,
} from '../src/lib/db';
import { ensureSeeded } from '../src/lib/seed';

let failures = 0;

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  // --- Seed data -----------------------------------------------------------
  await ensureSeeded();
  const notes = await db.notes.toArray();
  check('seed creates 4 notes', notes.length === 4, `got ${notes.length}`);

  const counts = await getLedgerCounts();
  // 4 notes × (summary + sentiment) = 8 on-device entries, + 1 photo entry
  // when the seed photo loads (it needs a static server, so it is skipped in
  // this Node test — the browser smoke test covers the photo path),
  // + deep summary & suggestions on the last note = 2 in-cloud.
  const photoSeeded = notes.some((n) => n.photos.length > 0);
  const expectedOnDevice = photoSeeded ? 9 : 8;
  const expectedTotal = photoSeeded ? 11 : 10;
  check(
    `seed ledger: ${expectedOnDevice} on-device entries`,
    counts.onDevice === expectedOnDevice,
    `got ${counts.onDevice}`,
  );
  check('seed ledger: 2 in-cloud entries', counts.inCloud === 2, `got ${counts.inCloud}`);
  check(
    `seed ledger: ${expectedTotal} total entries`,
    counts.total === expectedTotal,
    `got ${counts.total}`,
  );

  await ensureSeeded();
  check(
    'seed is idempotent',
    (await db.notes.count()) === 4,
    `got ${await db.notes.count()}`,
  );

  if (photoSeeded) {
    const withPhoto = notes.find((n) => n.photos.length > 0);
    check(
      'seeded photo has an on-device description',
      withPhoto?.photos[0]?.description !== undefined &&
        withPhoto.photos[0].source === 'ON_DEVICE',
    );
  } else {
    console.log('SKIP  seeded photo checks (no static server in Node test)');
  }

  const withCloud = notes.find((n) => n.analysis.deepSummary);
  check('one seeded note has a cloud deep summary', withCloud !== undefined);
  check(
    'seeded cloud entry records chars sent',
    (withCloud?.analysis.deepSummary?.charsSent ?? 0) ===
      (withCloud?.content.length ?? -1),
  );

  // --- CRUD ----------------------------------------------------------------
  const id = await createNote();
  await updateNoteFields(id, { title: 'Test entry', content: 'Hello world' });
  const created = await db.notes.get(id);
  check('create + update round-trips', created?.title === 'Test entry');

  await saveAnalysis(id, {
    sentiment: {
      source: 'ON_DEVICE',
      score: 42,
      label: 'Positive',
      keywords: ['test'],
      model: 'test',
      createdAt: Date.now(),
    },
  });
  const withAnalysis = await db.notes.get(id);
  check(
    'saveAnalysis persists sentiment',
    withAnalysis?.analysis.sentiment?.score === 42,
  );

  await recordLedgerEntry({
    noteId: id,
    noteTitle: 'Test entry',
    action: 'on-device-sentiment',
    source: 'ON_DEVICE',
    detail: 'test',
    authorized: false,
    charsSent: 0,
  });
  const countsAfter = await getLedgerCounts();
  check(
    'ledger grows after recording',
    countsAfter.total === counts.total + 1,
    `got ${countsAfter.total}, expected ${counts.total + 1}`,
  );

  await deleteNoteAndLedger(id);
  check('delete removes the note', (await db.notes.get(id)) === undefined);
  check(
    'delete removes the note ledger entries',
    (await db.ledger.where('noteId').equals(id).count()) === 0,
  );

  // --- Mock provider: privacy contract --------------------------------------
  resetMockDeviceState();
  const availability = await mockProvider.getDeviceAvailability();
  check('mock starts downloadable', availability === 'downloadable');

  const sample = {
    id: 999,
    title: 'A bright test day',
    content:
      'I felt happy and grateful today. Everything was wonderful and I felt calm and proud of my progress.',
  };

  let threwUnavailable = false;
  try {
    await mockProvider.summarizeOnDevice(sample);
  } catch (err) {
    threwUnavailable = err instanceof OnDeviceUnavailableError;
  }
  check(
    'on-device call before init throws OnDeviceUnavailableError (no silent cloud fallback)',
    threwUnavailable,
  );

  let lastProgress = -1;
  await mockProvider.initializeDeviceModel((p) => {
    lastProgress = p;
  });
  check('download progress reaches 100', lastProgress === 100);
  check(
    'availability is available after init',
    (await mockProvider.getDeviceAvailability()) === 'available',
  );

  const summary = await mockProvider.summarizeOnDevice(sample);
  check('summary source is ON_DEVICE', summary.source === 'ON_DEVICE');
  check('summary is non-empty', summary.text.length > 0);

  const sentiment = await mockProvider.analyzeSentimentOnDevice(sample);
  check('sentiment source is ON_DEVICE', sentiment.source === 'ON_DEVICE');
  check(
    'happy text scores positive',
    sentiment.score > 0 && sentiment.score <= 100,
    `score=${sentiment.score}`,
  );
  check(
    'sentiment finds keywords',
    sentiment.keywords.includes('happy') || sentiment.keywords.includes('grateful'),
    `keywords=${sentiment.keywords.join(',')}`,
  );

  const sad = await mockProvider.analyzeSentimentOnDevice({
    id: 998,
    title: 'A hard day',
    content: 'I felt sad and anxious and tired and lonely all day. Everything was awful.',
  });
  check('sad text scores negative', sad.score < 0, `score=${sad.score}`);

  // Determinism: same input, same output.
  const again = await mockProvider.analyzeSentimentOnDevice(sample);
  check(
    'mock sentiment is deterministic',
    again.score === sentiment.score && again.label === sentiment.label,
  );

  const photo = await mockProvider.describePhotoOnDevice({
    name: 'sunset.jpg',
    mimeType: 'image/jpeg',
    dataUrl: 'data:image/jpeg;base64,xxxx',
  });
  check('photo description source is ON_DEVICE', photo.source === 'ON_DEVICE');
  check('photo description is non-empty', photo.description.length > 0);

  let threwNotAuthorized = false;
  try {
    await mockProvider.deepSummaryInCloud(sample, { authorized: false });
  } catch (err) {
    threwNotAuthorized = err instanceof CloudNotAuthorizedError;
  }
  check(
    'cloud call without authorization throws CloudNotAuthorizedError',
    threwNotAuthorized,
  );

  const deep = await mockProvider.deepSummaryInCloud(sample, {
    authorized: true,
    authorizedAt: Date.now(),
  });
  check('authorized cloud call returns IN_CLOUD', deep.source === 'IN_CLOUD');
  check(
    'cloud call records chars sent',
    deep.charsSent === sample.content.length,
  );

  // --- Cleanup ----------------------------------------------------------------
  await clearAllData();
  check('clearAllData empties notes', (await db.notes.count()) === 0);
  check('clearAllData empties ledger', (await db.ledger.count()) === 0);

  // Touch the assert helper so strict TS is happy it is used.
  assert(failures >= 0, 'failure counter broken');

  console.log(failures === 0 ? '\nALL DB TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('DB TEST CRASHED:', err);
  process.exit(1);
});
