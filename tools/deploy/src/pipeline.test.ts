// End-to-end tests of the deploy sequence against an in-memory bucket and a controllable clock. These cover
// what the pure tests in plan.test.ts can't: which objects actually survive a deploy.

import type { Cdn, DeployOptions, Store, Upload } from './pipeline.ts';
import assert from 'node:assert/strict';
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
    list: async prefix => [...objects.values()]
      .filter(({ key }) => key.startsWith(prefix))
      .map(({ key, lastModified }) => ({ key, lastModified })),
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

const localBuild = (keys: string[]): DeployOptions['build'] => ({
  keys,
  read: async key => new TextEncoder().encode(`contents of ${key}`),
});

const setup = () => {
  const clock = createClock();
  const bucket = createFakeStore(clock);
  const cdn = createFakeCdn();
  const logs: string[] = [];

  const run = (keys: string[], overrides: Partial<DeployOptions> = {}) => deploy({
    build: localBuild(keys),
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

const siteBuild = (tag: string, extra: string[] = []): string[] =>
  ['index.html', 'favicon.svg', `assets/index-${tag}.js`, `assets/index-${tag}.css`, ...extra];

describe('deploy pipeline', () => {
  it('uploads every file with the right headers, records it, and invalidates', async () => {
    const { bucket, cdn, run } = setup();

    const result = await run(siteBuild('a1'));

    assert.equal(bucket.objects.get('index.html')?.cacheControl, 'no-cache');
    assert.equal(bucket.objects.get('index.html')?.contentType, 'text/html; charset=utf-8');
    assert.equal(bucket.objects.get('assets/index-a1.js')?.cacheControl, 'public, max-age=31536000, immutable');
    assert.equal(bucket.objects.get('assets/index-a1.js')?.contentType, 'text/javascript; charset=utf-8');

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
    await run(siteBuild('a1', ['assets/vendor-shared.js']));
    for (const tag of ['b2', 'c3']) {
      clock.advance(30 * DAY_MS);
      await run(siteBuild(tag, ['assets/vendor-shared.js']));
    }
    clock.advance(30 * DAY_MS);

    const result = await run(siteBuild('d4'));

    assert.deepEqual(result.pruned.toSorted(), ['assets/index-a1.css', 'assets/index-a1.js']);
    for (const key of ['assets/vendor-shared.js', 'assets/index-b2.js', 'assets/index-c3.js', 'assets/index-d4.js']) {
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

    assert.equal(bucket.objects.has('assets/index-a1.js'), true);
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

  it('refuses a build without index.html', async () => {
    const { bucket, run } = setup();

    await assert.rejects(run(['assets/index-a1.js']), /index.html not found/);
    assert.equal(bucket.objects.size, 0);
  });
});
