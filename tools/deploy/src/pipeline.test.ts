// End-to-end tests of the deploy sequence against an in-memory bucket and a controllable clock. These cover
// what the pure tests in plan.test.ts can't: which objects actually survive a deploy.

import type { Cdn, DeployOptions, Store, Upload } from './pipeline.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { deploy } from './pipeline.ts';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type StoredFile = Upload & { lastModified: Date };

const createClock = (start = new Date('2026-01-01T00:00:00Z')) => {
  let time = start.getTime();
  return {
    now: (): Date => new Date(time),
    advance: (ms: number): void => {
      time += ms;
    },
  };
};

type Clock = ReturnType<typeof createClock>;

const createFakeStore = (clock: Clock) => {
  const objects = new Map<string, StoredFile>();
  const writes: string[] = [];
  let failPut: (key: string) => boolean = () => false;

  const store: Store = {
    // Like S3, the ETag of a single-part upload is the MD5 of its content
    list: async prefix => [...objects.values()]
      .filter(({ key }) => key.startsWith(prefix))
      .map(({ key, lastModified, body }) => ({ key, lastModified, etag: createHash('md5').update(body).digest('hex') })),
    getText: async (key) => {
      const object = objects.get(key);
      if (!object) {
        throw new Error(`NoSuchKey: ${key}`);
      }
      return typeof object.body === 'string' ? object.body : new TextDecoder().decode(object.body);
    },
    put: async (upload) => {
      if (failPut(upload.key)) {
        throw new Error(`put failed: ${upload.key}`);
      }
      objects.set(upload.key, { ...upload, lastModified: clock.now() });
      writes.push(`put ${upload.key}`);
    },
    delete: async (keys) => {
      keys.forEach(key => objects.delete(key));
      writes.push(`delete ${keys.join(', ')}`);
    },
  };

  // Place an object as if uploaded by hand (or by an older deploy) at a given time
  const seed = (key: string, lastModified: Date, body = ''): void => {
    objects.set(key, { key, body, contentType: 'application/octet-stream', cacheControl: '', lastModified });
  };

  return {
    store,
    objects,
    writes,
    seed,
    failPutWhen: (predicate: (key: string) => boolean): void => {
      failPut = predicate;
    },
  };
};

const createFakeCdn = () => {
  const invalidations: string[] = [];
  const cdn: Cdn = {
    invalidateAll: async (reference) => {
      invalidations.push(reference);
    },
  };
  return { cdn, invalidations };
};

type BuildOptions = {
  // Files under assets/ that Vite didn't emit (copied from public/assets/); everything else there is "hashed"
  unhashed?: string[];
  // No Vite manifest at all
  noManifest?: boolean;
  contents?: Record<string, string>;
};

const localBuild = (keys: string[], { unhashed = [], noManifest = false, contents = {} }: BuildOptions = {}): DeployOptions['build'] => ({
  keys,
  read: async key => new TextEncoder().encode(contents[key] ?? `contents of ${key}`),
  hashedAssets: noManifest
    ? new Set()
    : new Set(keys.filter(key => key.startsWith('assets/') && !unhashed.includes(key))),
});

const setup = () => {
  const clock = createClock();
  const bucket = createFakeStore(clock);
  const cdn = createFakeCdn();
  const logs: string[] = [];

  const run = (keys: string[], overrides: Partial<DeployOptions> = {}, buildOptions: BuildOptions = {}) => deploy({
    build: localBuild(keys, buildOptions),
    store: bucket.store,
    cdn: cdn.cdn,
    policy: { keepBuilds: 3, keepDays: 7 },
    dryRun: false,
    now: clock.now,
    log: message => logs.push(message),
    ...overrides,
  });

  return { clock, bucket, cdn, logs, run };
};

// Asset names follow Vite's <name>-<8 char hash>.<ext> shape so they're treated as hashed
const siteBuild = (tag: string, extra: string[] = []): string[] =>
  ['index.html', 'favicon.svg', `assets/index-${tag}Xy12ab.js`, `assets/index-${tag}Xy12ab.css`, ...extra];

describe('deploy pipeline', () => {
  it('uploads every file with the right headers, records it, and invalidates', async () => {
    const { bucket, cdn, run } = setup();

    const result = await run(siteBuild('a1'));

    assert.equal(bucket.objects.get('index.html')?.cacheControl, 'no-cache');
    assert.equal(bucket.objects.get('index.html')?.contentType, 'text/html; charset=utf-8');
    assert.equal(bucket.objects.get('assets/index-a1Xy12ab.js')?.cacheControl, 'public, max-age=31536000, immutable');
    assert.equal(bucket.objects.get('assets/index-a1Xy12ab.js')?.contentType, 'text/javascript; charset=utf-8');

    const record = await bucket.store.getText(`_deploys/${result.buildId}.txt`);
    assert.deepEqual(record.trim().split('\n'), siteBuild('a1').toSorted());
    assert.deepEqual(cdn.invalidations, [result.buildId]);
  });

  it('writes the build record only after every file is uploaded', async () => {
    const { bucket, cdn, run } = setup();
    bucket.failPutWhen(key => key === 'index.html');

    await assert.rejects(run(siteBuild('a1')), /put failed: index.html/);

    assert.deepEqual([...bucket.objects.keys()].filter(key => key.startsWith('_deploys/')), []);
    assert.deepEqual(cdn.invalidations, []);
  });

  it('removes root files the previous deploy uploaded that this build dropped', async () => {
    const { bucket, clock, run } = setup();
    await run(siteBuild('a1', ['old-logo.svg']));
    clock.advance(DAY_MS);

    const result = await run(siteBuild('b2'));

    assert.deepEqual(result.staleDeleted, ['old-logo.svg']);
    assert.equal(bucket.objects.has('old-logo.svg'), false);
    assert.equal(bucket.objects.has('index.html'), true);
  });

  it('never deletes files no deploy uploaded', async () => {
    const { bucket, clock, run } = setup();
    bucket.seed('google123abc.html', clock.now());
    bucket.seed('.well-known/security.txt', clock.now());

    await run(siteBuild('a1'));
    clock.advance(DAY_MS);
    await run(siteBuild('b2'));

    assert.equal(bucket.objects.has('google123abc.html'), true);
    assert.equal(bucket.objects.has('.well-known/security.txt'), true);
  });

  it('deletes nothing at the root when the previous record predates root files being recorded', async () => {
    const { bucket, clock, run } = setup();
    const monthAgo = new Date(clock.now().getTime() - 30 * DAY_MS);
    bucket.seed('_deploys/20251201T000000Z-aaaaaaa.txt', monthAgo, 'assets/index-old.js\n');
    bucket.seed('assets/index-old.js', monthAgo);
    bucket.seed('dropped-long-ago.svg', monthAgo);

    const result = await run(siteBuild('a1'));

    assert.deepEqual(result.staleDeleted, []);
    assert.equal(bucket.objects.has('dropped-long-ago.svg'), true);
  });

  it('prunes an old build once it is outside the last 3 and was replaced over 7 days ago, keeping shared assets', async () => {
    const { bucket, clock, run } = setup();
    await run(siteBuild('a1', ['assets/vendor-Sh4red00.js']));
    for (const tag of ['b2', 'c3']) {
      clock.advance(30 * DAY_MS);
      await run(siteBuild(tag, ['assets/vendor-Sh4red00.js']));
    }
    clock.advance(30 * DAY_MS);

    const result = await run(siteBuild('d4'));

    assert.deepEqual(result.pruned.toSorted(), ['assets/index-a1Xy12ab.css', 'assets/index-a1Xy12ab.js']);
    for (const key of ['assets/vendor-Sh4red00.js', 'assets/index-b2Xy12ab.js', 'assets/index-c3Xy12ab.js', 'assets/index-d4Xy12ab.js']) {
      assert.equal(bucket.objects.has(key), true, key);
    }
  });

  it('keeps a long-lived build that was replaced moments ago, even outside the last 3', async () => {
    const { bucket, clock, run } = setup();
    await run(siteBuild('a1'));
    clock.advance(200 * DAY_MS);
    for (const tag of ['b2', 'c3', 'd4']) {
      clock.advance(HOUR_MS);
      await run(siteBuild(tag));
    }

    assert.equal(bucket.objects.has('assets/index-a1Xy12ab.js'), true);
  });

  it('never prunes the build that just went live, even with no upload grace period', async () => {
    const { bucket, clock, run } = setup();
    const twoMonthsAgo = new Date(clock.now().getTime() - 60 * DAY_MS);
    const monthAgo = new Date(clock.now().getTime() - 30 * DAY_MS);
    bucket.seed('_deploys/20251102T000000Z-aaaaaaa.txt', twoMonthsAgo, 'assets/index-old1.js\n');
    bucket.seed('assets/index-old1.js', twoMonthsAgo);
    bucket.seed('_deploys/20251202T000000Z-bbbbbbb.txt', monthAgo, 'assets/index-old2.js\n');
    bucket.seed('assets/index-old2.js', monthAgo);

    // keepBuilds 1 and no grace period: only the record logic protects anything. old2 was live until this deploy,
    // so it's kept; old1 was replaced a month ago and goes.
    const result = await run(siteBuild('a1'), { policy: { keepBuilds: 1, keepDays: 7 }, recentUploadGraceMs: 0 });

    for (const key of siteBuild('a1')) {
      assert.equal(bucket.objects.has(key), true, key);
    }
    assert.deepEqual(result.pruned, ['assets/index-old1.js']);
    assert.equal(bucket.objects.has('assets/index-old2.js'), true);
  });

  it('leaves unrecorded assets uploaded within the last hour alone (an in-flight deploy)', async () => {
    const { bucket, clock, run } = setup();
    const monthAgo = new Date(clock.now().getTime() - 30 * DAY_MS);
    bucket.seed('_deploys/20251201T000000Z-aaaaaaa.txt', monthAgo, 'assets/index-old.js\n');
    bucket.seed('assets/index-in-flight.js', new Date(clock.now().getTime() - 10 * 60 * 1000));

    await run(siteBuild('a1'), { policy: { keepBuilds: 1, keepDays: 7 } });

    assert.equal(bucket.objects.has('assets/index-in-flight.js'), true);
  });

  it('ignores objects under _deploys/ that are not build records', async () => {
    const { bucket, clock, logs, run } = setup();
    bucket.seed('_deploys/', clock.now());
    bucket.seed('_deploys/README.md', clock.now(), '# notes');

    await run(siteBuild('a1'));

    assert.equal(bucket.objects.has('_deploys/README.md'), true);
    assert.ok(logs.some(line => line.includes('ignoring _deploys/README.md')));
  });

  it('ignores a build record dated in the future instead of treating it as the newest deploy', async () => {
    const { bucket, clock, logs, run } = setup();
    await run(siteBuild('a1', ['old-logo.svg']));
    clock.advance(DAY_MS);
    // A deploy from a machine whose clock ran a year fast, listing only its own files
    bucket.seed('_deploys/20270101T000000Z-fffffff.txt', clock.now(), 'index.html\nassets/index-ffXy12ab.js\n');

    const result = await run(siteBuild('b2'));

    // The previous deploy is still a1, so its dropped file is recognised as stale
    assert.deepEqual(result.staleDeleted, ['old-logo.svg']);
    assert.ok(logs.some(line => line.includes('ignoring _deploys/20270101T000000Z-fffffff.txt: dated in the future')));
  });

  it('writes nothing and invalidates nothing in a dry run', async () => {
    const { bucket, cdn, clock, run } = setup();
    await run(siteBuild('a1', ['old-logo.svg']));
    clock.advance(30 * DAY_MS);
    const before = new Map(bucket.objects);
    const writesBefore = bucket.writes.length;

    await run(siteBuild('b2'), { dryRun: true });

    assert.deepEqual(bucket.objects, before);
    assert.equal(bucket.writes.length, writesBefore);
    assert.equal(cdn.invalidations.length, 1);
  });

  it('skips a hashed asset whose identical content is already in the bucket, but still records it', async () => {
    const { bucket, clock, run } = setup();
    await run(siteBuild('a1', ['assets/vendor-Sh4red00.js']));
    clock.advance(DAY_MS);
    const writesBefore = bucket.writes.length;

    const result = await run(siteBuild('b2', ['assets/vendor-Sh4red00.js']));

    assert.deepEqual(result.skipped, ['assets/vendor-Sh4red00.js']);
    assert.ok(!bucket.writes.slice(writesBefore).includes('put assets/vendor-Sh4red00.js'));
    assert.ok((await bucket.store.getText(`_deploys/${result.buildId}.txt`)).includes('assets/vendor-Sh4red00.js'));
  });

  it('uploads a hashed asset again when the bucket copy differs', async () => {
    const { bucket, clock, run } = setup();
    bucket.seed('assets/vendor-Sh4red00.js', clock.now(), 'a corrupted or hand-edited copy');

    const result = await run(siteBuild('a1', ['assets/vendor-Sh4red00.js']));

    assert.deepEqual(result.skipped, []);
    assert.equal(await bucket.store.getText('assets/vendor-Sh4red00.js'), 'contents of assets/vendor-Sh4red00.js');
  });

  it('ships a changed hand-named file under assets/ even when its name looks hashed', async () => {
    const { bucket, clock, run } = setup();
    const photo = 'assets/team-member-1.jpg';
    await run(siteBuild('a1', [photo]), {}, { unhashed: [photo], contents: { [photo]: 'OLD PHOTO' } });
    clock.advance(DAY_MS);

    const result = await run(siteBuild('a1', [photo]), {}, { unhashed: [photo], contents: { [photo]: 'NEW PHOTO' } });

    assert.ok(!result.skipped.includes(photo));
    assert.equal(await bucket.store.getText(photo), 'NEW PHOTO');
    assert.equal(bucket.objects.get(photo)?.cacheControl, 'no-cache');
  });

  it('without a Vite manifest, caches nothing forever and skips nothing', async () => {
    const { bucket, clock, logs, run } = setup();
    await run(siteBuild('a1'), {}, { noManifest: true });
    clock.advance(DAY_MS);

    const result = await run(siteBuild('a1'), {}, { noManifest: true });

    assert.deepEqual(result.skipped, []);
    assert.equal(bucket.objects.get('assets/index-a1Xy12ab.js')?.cacheControl, 'no-cache');
    assert.ok(logs.some(line => line.includes('no Vite manifest')));
  });

  it('refuses a build without index.html', async () => {
    const { bucket, run } = setup();

    await assert.rejects(run(['assets/index-a1Xy12ab.js']), /index.html not found/);
    assert.equal(bucket.objects.size, 0);
  });
});
