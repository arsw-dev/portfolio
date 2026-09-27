import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assetsToDelete,
  buildIdFromRecordKey,
  cacheControlFor,
  contentTypeFor,
  createBuildId,
  formatRecord,
  parseBuildTime,
  parseRecord,
  recordKey,
  selectKeptBuilds,
  shouldUpload,
  staleRootKeys,
} from './plan.ts';

const NOW = new Date('2026-09-26T12:00:00Z');
const HOUR_MS = 60 * 60 * 1000;
const POLICY = { keepBuilds: 3, keepDays: 7 };

const buildAt = (hoursAgo: number, sha = 'abcdef0'): string =>
  createBuildId(new Date(NOW.getTime() - hoursAgo * HOUR_MS), sha);

const daysAgo = (days: number, sha?: string): string => buildAt(days * 24, sha);

describe('createBuildId / parseBuildTime', () => {
  it('formats a compact UTC timestamp with a short SHA', () => {
    assert.equal(createBuildId(new Date('2026-09-26T23:54:52.123Z'), 'abc1234def'), '20260926T235452Z-abc1234');
  });

  it('omits the SHA when there is none', () => {
    assert.equal(createBuildId(new Date('2026-09-26T23:54:52Z')), '20260926T235452Z');
  });

  it('round-trips to the second', () => {
    const id = createBuildId(new Date('2026-01-02T03:04:05.999Z'), 'sha');
    assert.equal(parseBuildTime(id).toISOString(), '2026-01-02T03:04:05.000Z');
  });

  it('sorts chronologically as strings', () => {
    const ids = [daysAgo(1), daysAgo(30), buildAt(1), daysAgo(400)];
    const byTime = ids.toSorted((a, b) => parseBuildTime(a).getTime() - parseBuildTime(b).getTime());
    assert.deepEqual(ids.toSorted(), byTime);
  });

  it('rejects malformed IDs', () => {
    assert.throws(() => parseBuildTime('latest'), /Invalid build ID/);
  });
});

describe('record keys', () => {
  it('maps build IDs to _deploys/ keys and back', () => {
    const id = '20260926T235452Z-abc1234';
    assert.equal(recordKey(id), '_deploys/20260926T235452Z-abc1234.txt');
    assert.equal(buildIdFromRecordKey(recordKey(id)), id);
  });

  it('formats records sorted, one key per line, and parses them back ignoring blanks', () => {
    const text = formatRecord(['assets/b.js', 'assets/a.css']);
    assert.equal(text, 'assets/a.css\nassets/b.js\n');
    assert.deepEqual(parseRecord(`${text}\n  \n`), ['assets/a.css', 'assets/b.js']);
  });
});

describe('shouldUpload', () => {
  it('skips OS metadata files at any depth', () => {
    for (const key of ['.DS_Store', 'assets/.DS_Store', 'Thumbs.db', 'img/desktop.ini']) {
      assert.equal(shouldUpload(key), false, key);
    }
  });

  it('uploads everything else, including other dotfiles', () => {
    for (const key of ['index.html', 'assets/index-a1.js', '.well-known/security.txt', 'DS_Store.txt']) {
      assert.equal(shouldUpload(key), true, key);
    }
  });
});

describe('cacheControlFor', () => {
  it('caches hashed assets forever', () => {
    assert.equal(cacheControlFor('assets/index-BaXPYhR1.js'), 'public, max-age=31536000, immutable');
  });

  it('revalidates everything else', () => {
    for (const key of ['index.html', 'favicon.svg', 'robots.txt', 'nested/assets/file.js']) {
      assert.equal(cacheControlFor(key), 'no-cache', key);
    }
  });
});

describe('contentTypeFor', () => {
  it('knows the types a Vite build produces', () => {
    assert.equal(contentTypeFor('index.html'), 'text/html; charset=utf-8');
    assert.equal(contentTypeFor('assets/index-a1.js'), 'text/javascript; charset=utf-8');
    assert.equal(contentTypeFor('assets/index-a1.css'), 'text/css; charset=utf-8');
    assert.equal(contentTypeFor('favicon.svg'), 'image/svg+xml');
    assert.equal(contentTypeFor('manifest.json'), 'application/json');
    assert.equal(contentTypeFor('assets/font-a1.woff2'), 'font/woff2');
  });

  it('ignores extension case', () => {
    assert.equal(contentTypeFor('og-image.PNG'), 'image/png');
  });

  it('falls back to octet-stream for unknown or missing extensions', () => {
    assert.equal(contentTypeFor('LICENSE'), 'application/octet-stream');
    assert.equal(contentTypeFor('file.unknownext'), 'application/octet-stream');
    assert.equal(contentTypeFor('.well-known/security'), 'application/octet-stream');
  });
});

describe('selectKeptBuilds', () => {
  it('skips when there are no records', () => {
    assert.deepEqual(selectKeptBuilds([], NOW, POLICY), { skip: true, reason: 'no build records' });
  });

  it('skips until the first record is older than keepDays (pre-record assets get a grace period)', () => {
    const result = selectKeptBuilds([daysAgo(6), buildAt(1)], NOW, POLICY);
    assert.equal(result.skip, true);
  });

  it('keeps only the last keepBuilds when everything was replaced long ago', () => {
    const ids = [daysAgo(100), daysAgo(90), daysAgo(80), daysAgo(70), daysAgo(60)];
    assert.deepEqual(selectKeptBuilds(ids, NOW, POLICY), { skip: false, ids: ids.slice(-3) });
  });

  it('keeps an old build that was live until recently, even outside the last keepBuilds', () => {
    // Quiet site: January build was live until a burst of three deploys today
    const january = daysAgo(260, 'aaaaaaa');
    const march = daysAgo(200, 'bbbbbbb');
    const today = [buildAt(3, 'ccccccc'), buildAt(2, 'ddddddd'), buildAt(1, 'eeeeeee')];

    const result = selectKeptBuilds([january, march, ...today], NOW, POLICY);

    assert.deepEqual(result, { skip: false, ids: [march, ...today] });
  });

  it('keeps every build replaced within keepDays during a burst of deploys', () => {
    const old = daysAgo(30);
    const burst = [buildAt(6), buildAt(5), buildAt(4), buildAt(3), buildAt(2), buildAt(1)];

    const result = selectKeptBuilds([old, ...burst], NOW, POLICY);

    assert.deepEqual(result, { skip: false, ids: [old, ...burst] });
  });

  it('never keeps fewer than the newest build', () => {
    const ids = [daysAgo(30), daysAgo(20)];
    assert.deepEqual(selectKeptBuilds(ids, NOW, { keepBuilds: 1, keepDays: 7 }), { skip: false, ids: [ids[1]] });
  });

  it('treats the boundary as exclusive: replaced exactly keepDays ago is dropped', () => {
    const replaced = daysAgo(30);
    const replacement = daysAgo(7);
    const result = selectKeptBuilds([replaced, replacement], NOW, { keepBuilds: 1, keepDays: 7 });
    assert.deepEqual(result, { skip: false, ids: [replacement] });
  });

  it('does not depend on input order', () => {
    const ids = [daysAgo(100), daysAgo(50), buildAt(2), buildAt(1)];
    assert.deepEqual(
      selectKeptBuilds(ids.toReversed(), NOW, POLICY),
      selectKeptBuilds(ids, NOW, POLICY),
    );
  });
});

describe('assetsToDelete', () => {
  it('deletes assets no kept build references, including pre-record leftovers', () => {
    const remote = ['assets/a1.js', 'assets/shared.js', 'assets/b1.js', 'assets/legacy.js'];
    const kept = new Set(['assets/shared.js', 'assets/b1.js']);
    assert.deepEqual(assetsToDelete(remote, kept), ['assets/a1.js', 'assets/legacy.js']);
  });

  it('never touches files outside assets/', () => {
    const remote = ['index.html', '_deploys/20260101T000000Z.txt', 'favicon.svg'];
    assert.deepEqual(assetsToDelete(remote, new Set()), []);
  });
});

describe('staleRootKeys', () => {
  it('finds root files that are no longer in the build', () => {
    const remote = ['index.html', 'old-logo.svg', 'robots.txt'];
    assert.deepEqual(staleRootKeys(remote, new Set(['index.html', 'robots.txt'])), ['old-logo.svg']);
  });

  it('leaves assets and build records to pruning', () => {
    const remote = ['assets/old.js', '_deploys/20260101T000000Z.txt', 'index.html'];
    assert.deepEqual(staleRootKeys(remote, new Set(['index.html'])), []);
  });
});
