import type { ResponseSnapshot } from './smoke-checks.ts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkAsset, checkDeepLink, checkHomePage, findAssetPath } from './smoke-checks.ts';

const response = (status: number, headers: Record<string, string>): ResponseSnapshot => ({
  status,
  header: name => headers[name.toLowerCase()] ?? null,
});

const GOOD_HOME = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-cache',
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
};

describe('findAssetPath', () => {
  it('finds the first hashed script or stylesheet', () => {
    const html = '<link rel="stylesheet" href="/assets/index-C1.css"><script type="module" src="/assets/index-B2.js"></script>';
    assert.equal(findAssetPath(html), '/assets/index-C1.css');
  });

  it('ignores non-asset references', () => {
    assert.equal(findAssetPath('<link rel="icon" href="/favicon.svg">'), undefined);
  });
});

describe('checkHomePage', () => {
  it('passes a correctly deployed page', () => {
    assert.deepEqual(checkHomePage(response(200, GOOD_HOME)), []);
  });

  it('reports a missing cache header, as uploaded by the old sync deploy', () => {
    const { 'cache-control': _, ...rest } = GOOD_HOME;
    assert.deepEqual(checkHomePage(response(200, rest)), ['expected cache-control to include "no-cache", got nothing']);
  });

  it('reports missing security headers', () => {
    const failures = checkHomePage(response(200, { 'content-type': 'text/html', 'cache-control': 'no-cache' }));
    assert.equal(failures.length, 2);
  });
});

describe('checkDeepLink', () => {
  it('passes when the SPA fallback serves HTML', () => {
    assert.deepEqual(checkDeepLink(response(200, { 'content-type': 'text/html' })), []);
  });

  it('fails on the S3 403 the site returned before the CloudFront Function', () => {
    const failures = checkDeepLink(response(403, { 'content-type': 'application/xml' }));
    assert.deepEqual(failures, [
      'expected status 200, got 403',
      'expected content-type to include "text/html", got "application/xml"',
    ]);
  });
});

describe('checkAsset', () => {
  it('passes an immutable asset', () => {
    assert.deepEqual(checkAsset(response(200, { 'cache-control': 'public, max-age=31536000, immutable' })), []);
  });

  it('fails an asset without long-lived caching', () => {
    assert.equal(checkAsset(response(200, {})).length, 1);
  });
});
