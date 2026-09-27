import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assetsToDelete,
  buildIdFromRecordKey,
  cacheControlFor,
  contentTypeFor,
  createBuildId,
  formatRecord,
  hashedAssetsFromManifest,
  isFromTheFuture,
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

  it('flags IDs dated beyond the clock-skew tolerance as from the future', () => {
    const tolerance = 5 * 60 * 1000;
    assert.equal(isFromTheFuture(buildAt(-1), NOW, tolerance), true);
    assert.equal(isFromTheFuture(createBuildId(new Date(NOW.getTime() + 4 * 60 * 1000)), NOW, tolerance), false);
    assert.equal(isFromTheFuture(buildAt(1), NOW, tolerance), false);
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
    assert.equal(buildIdFromRecordKey(recordKey('20260926T235452Z')), '20260926T235452Z');
  });

  it('rejects anything under _deploys/ that is not a build record', () => {
    for (const key of ['_deploys/', '_deploys/README.md', '_deploys/latest.txt', '_deploys/20260926T235452Z-ABC1234.txt', 'assets/20260926T235452Z.txt']) {
      assert.equal(buildIdFromRecordKey(key), undefined, key);
    }
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

  it('never uploads Vite build metadata', () => {
    assert.equal(shouldUpload('.vite/manifest.json'), false);
  });

  it('uploads everything else, including other dotfiles', () => {
    for (const key of ['index.html', 'assets/index-a1.js', '.well-known/security.txt', 'DS_Store.txt']) {
      assert.equal(shouldUpload(key), true, key);
    }
  });
});

// Shaped like this site's real dist/.vite/manifest.json
const MANIFEST = {
  '_posts-BIE8_9J4.js': { file: 'assets/posts-BIE8_9J4.js' },
  'index.html': { file: 'assets/index-BK6ZGIxf.js', css: ['assets/index-rs8v4u0x.css'], isEntry: true },
  'src/routes/writing/$slug.tsx?tsr-split=component': { file: 'assets/_slug-QDNn1Eue.js', isDynamicEntry: true },
  'src/components/hero.tsx': { file: 'assets/hero-Dx81abcd.js', assets: ['assets/portrait-C0ffee12.webp'] },
};
const HASHED = hashedAssetsFromManifest(MANIFEST);
const IMMUTABLE_HEADER = 'public, max-age=31536000, immutable';

describe('hashedAssetsFromManifest', () => {
  it('collects every emitted file: chunks, their CSS and imported assets', () => {
    assert.deepEqual([...HASHED].toSorted(), [
      'assets/_slug-QDNn1Eue.js',
      'assets/hero-Dx81abcd.js',
      'assets/index-BK6ZGIxf.js',
      'assets/index-rs8v4u0x.css',
      'assets/portrait-C0ffee12.webp',
      'assets/posts-BIE8_9J4.js',
    ]);
  });

  it('ignores anything outside assets/ and malformed entries', () => {
    const hashed = hashedAssetsFromManifest({ a: { file: 'other/x-Abcdef12.js', css: 'not-a-list' }, b: null, c: { file: 42 } });
    assert.equal(hashed.size, 0);
  });

  it('rejects a manifest that is not an object', () => {
    assert.throws(() => hashedAssetsFromManifest(null), /not an object/);
  });
});

describe('cacheControlFor', () => {
  it('caches files Vite emitted forever', () => {
    for (const key of HASHED) {
      assert.equal(cacheControlFor(key, HASHED), IMMUTABLE_HEADER, key);
    }
  });

  it('revalidates files that only look hashed (copied from public/assets/ under their own names)', () => {
    for (const key of ['assets/team-member-1.jpg', 'assets/icon-arrow-up.svg', 'assets/slide-01-intro.png', 'assets/logo-Abcdef12.png', 'assets/logo.png']) {
      assert.equal(cacheControlFor(key, HASHED), 'no-cache', key);
    }
  });

  it('treats nothing as hashed without a manifest', () => {
    assert.equal(cacheControlFor('assets/index-BK6ZGIxf.js', new Set()), 'no-cache');
  });

  it('revalidates everything outside assets/', () => {
    for (const key of ['index.html', 'favicon.svg', 'robots.txt', 'nested/assets/file.js']) {
      assert.equal(cacheControlFor(key, HASHED), 'no-cache', key);
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

  it('serves media and data files with real types so nosniff browsers accept them', () => {
    assert.equal(contentTypeFor('captions/en.vtt'), 'text/vtt; charset=utf-8');
    assert.equal(contentTypeFor('audio/intro.mp3'), 'audio/mpeg');
    assert.equal(contentTypeFor('data/prices.csv'), 'text/csv; charset=utf-8');
    assert.equal(contentTypeFor('legacy.htm'), 'text/html; charset=utf-8');
    assert.equal(contentTypeFor('models/chair.glb'), 'model/gltf-binary');
  });

  it('types extensionless well-known files by name', () => {
    assert.equal(contentTypeFor('.well-known/apple-app-site-association'), 'application/json');
    assert.equal(contentTypeFor('.well-known/assetlinks.json'), 'application/json');
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
  const GRACE_MS = HOUR_MS;
  const old = (key: string) => ({ key, lastModified: new Date(NOW.getTime() - 30 * 24 * HOUR_MS) });

  it('deletes assets no kept build references, including pre-record leftovers', () => {
    const remote = ['assets/a1.js', 'assets/shared.js', 'assets/b1.js', 'assets/legacy.js'].map(old);
    const kept = new Set(['assets/shared.js', 'assets/b1.js']);
    assert.deepEqual(assetsToDelete(remote, kept, NOW, GRACE_MS), ['assets/a1.js', 'assets/legacy.js']);
  });

  it('never touches files outside assets/', () => {
    const remote = ['index.html', '_deploys/20260101T000000Z.txt', 'favicon.svg'].map(old);
    assert.deepEqual(assetsToDelete(remote, new Set(), NOW, GRACE_MS), []);
  });

  it('leaves recently uploaded assets alone even when unreferenced (an in-flight deploy)', () => {
    const remote = [
      { key: 'assets/in-flight.js', lastModified: new Date(NOW.getTime() - 5 * 60 * 1000) },
      { key: 'assets/just-over.js', lastModified: new Date(NOW.getTime() - GRACE_MS) },
    ];
    assert.deepEqual(assetsToDelete(remote, new Set(), NOW, GRACE_MS), ['assets/just-over.js']);
  });
});

describe('staleRootKeys', () => {
  it('finds root files the previous deploy uploaded that this build dropped', () => {
    const previous = ['assets/a.js', 'index.html', 'old-logo.svg', 'robots.txt'];
    assert.deepEqual(staleRootKeys(previous, new Set(['index.html', 'robots.txt'])), ['old-logo.svg']);
  });

  it('never considers files no deploy recorded (hand-placed files survive)', () => {
    // google123.html exists in the bucket but isn't in any record, so it can't be a candidate
    assert.deepEqual(staleRootKeys(['index.html'], new Set(['index.html'])), []);
  });

  it('treats an asset-only record from before root files were recorded as having no root files', () => {
    assert.deepEqual(staleRootKeys(['assets/a.js', 'assets/b.css'], new Set(['index.html'])), []);
  });

  it('leaves assets and build records to pruning', () => {
    const previous = ['assets/old.js', '_deploys/20260101T000000Z.txt', 'index.html'];
    assert.deepEqual(staleRootKeys(previous, new Set(['index.html'])), []);
  });
});
