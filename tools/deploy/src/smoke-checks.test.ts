import type { ResponseSnapshot } from './smoke-checks.ts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkDeepLink, checkFile, checkFileBody, checkHomePage, checkServedIndex, findAssetPaths } from './smoke-checks.ts';

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

describe('findAssetPaths', () => {
  it('finds every script, stylesheet and preload, once each, in order', () => {
    const html = [
      '<link rel="stylesheet" href="/assets/index-C1abcdef.css">',
      '<link rel="modulepreload" href="/assets/vendor-D2abcdef.js">',
      '<script type="module" src="/assets/index-B2abcdef.js"></script>',
      '<link rel="modulepreload" href="/assets/vendor-D2abcdef.js">',
    ].join('');
    assert.deepEqual(findAssetPaths(html), [
      '/assets/index-C1abcdef.css',
      '/assets/vendor-D2abcdef.js',
      '/assets/index-B2abcdef.js',
    ]);
  });

  it('ignores non-asset references', () => {
    assert.deepEqual(findAssetPaths('<link rel="icon" href="/favicon.svg"><a href="/writing">x</a>'), []);
  });
});

describe('checkServedIndex', () => {
  it('passes when the live index.html is this build', () => {
    assert.deepEqual(checkServedIndex('<html>new</html>', '<html>new</html>'), []);
  });

  it('fails when an old build is still being served', () => {
    const failures = checkServedIndex('<html>old build</html>', '<html>new</html>');
    assert.equal(failures.length, 1);
    assert.match(failures[0]!, /is not this build's/);
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

describe('checkFile', () => {
  it('passes a hashed asset served immutable with its content type', () => {
    const served = response(200, { 'cache-control': 'public, max-age=31536000, immutable', 'content-type': 'text/javascript; charset=utf-8' });
    assert.deepEqual(checkFile('assets/index-BaXPYhR1.js', served), []);
  });

  it('fails a hashed asset without long-lived caching', () => {
    assert.equal(checkFile('assets/index-BaXPYhR1.js', response(200, { 'content-type': 'text/javascript' })).length, 1);
  });

  it('expects an unhashed file under assets/ to revalidate', () => {
    const cachedForever = response(200, { 'cache-control': 'public, max-age=31536000, immutable', 'content-type': 'image/png' });
    assert.deepEqual(checkFile('assets/logo.png', cachedForever), [
      'expected cache-control to include "no-cache", got "public, max-age=31536000, immutable"',
    ]);
  });

  it('fails a .well-known file answered with the SPA shell', () => {
    const shell = response(200, { 'cache-control': 'no-cache', 'content-type': 'text/html; charset=utf-8' });
    assert.deepEqual(checkFile('.well-known/apple-app-site-association', shell), [
      'expected content-type to include "application/json", got "text/html; charset=utf-8"',
    ]);
  });
});

describe('checkFileBody', () => {
  it('compares the served file with the build', () => {
    assert.deepEqual(checkFileBody('.well-known/security.txt', 'a', 'a'), []);
    assert.deepEqual(checkFileBody('.well-known/security.txt', '<html>', 'a'), ['served .well-known/security.txt doesn\'t match the build']);
  });
});
