// Unit tests for the SPA routing CloudFront Function, run in Node. The same cases run against CloudFront's own
// runtime in test-live.sh, so Node and the cloudfront-js-2.0 runtime are held to identical expectations.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';

type Request = {
  method: string;
  uri: string;
  querystring: Record<string, { value: string }>;
  headers: Record<string, { value: string }>;
};

type Handler = (event: { request: Request }) => Request | Response;

// A case either expects the request to continue to a URI, or the function to answer with a status
type Case = {
  uri: string;
  expected?: string;
  status?: number;
};

type Response = { statusCode: number };

const code = readFileSync(new URL('viewer-request.js', import.meta.url), 'utf8');
const cases: Case[] = JSON.parse(readFileSync(new URL('viewer-request.cases.json', import.meta.url), 'utf8'));

// CloudFront loads the file as a plain script with a global `handler`; evaluate it the same way
const handler = runInNewContext(`${code}\nhandler;`) as Handler;

const request = (uri: string): Request => ({
  method: 'GET',
  uri,
  querystring: { ref: { value: 'newsletter' } },
  headers: { host: { value: 'arsw.dev' } },
});

describe('viewer-request', () => {
  for (const { uri, expected, status } of cases) {
    it(`${uri} -> ${status ?? expected}`, () => {
      const result = handler({ request: request(uri) });
      if (status !== undefined) {
        assert.equal((result as Response).statusCode, status);
      }
      else {
        assert.equal((result as Request).uri, expected);
      }
    });
  }

  it('leaves the rest of the request untouched', () => {
    const result = handler({ request: request('/writing/some-post') });
    assert.deepEqual(result, { ...request('/writing/some-post'), uri: '/index.html' });
  });
});
