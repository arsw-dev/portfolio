// Pure checks for a deployed site. Each returns a list of failures; empty means it passed. Expected headers
// come from plan.ts, so the smoke test holds the live site to the same rules the deploy used.

import { cacheControlFor, contentTypeFor } from './plan.ts';

type ResponseSnapshot = {
  status: number;
  header: (name: string) => string | null;
};

// A path no site defines, so it exercises the SPA fallback (CloudFront Function rewrite to /index.html)
const DEEP_LINK_PATH = '/__smoke-test/deep-link';

const expectStatus = (response: ResponseSnapshot, status: number): string[] =>
  response.status === status ? [] : [`expected status ${status}, got ${response.status}`];

const expectHeader = (response: ResponseSnapshot, name: string, includes: string): string[] => {
  const value = response.header(name);
  return value?.toLowerCase().includes(includes.toLowerCase())
    ? []
    : [`expected ${name} to include "${includes}", got ${value === null ? 'nothing' : `"${value}"`}`];
};

// Every hashed asset the page references, in order, without duplicates, e.g. /assets/index-BaXPYhR1.js
const findAssetPaths = (html: string): string[] =>
  [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]!))];

const checkServedIndex = (served: string, local: string): string[] =>
  served === local
    ? []
    : [`served index.html (${served.length} bytes) is not this build's (${local.length} bytes); the upload didn't land or CloudFront is serving a stale copy`];

const checkHomePage = (response: ResponseSnapshot): string[] => [
  ...expectStatus(response, 200),
  ...expectHeader(response, 'content-type', 'text/html'),
  ...expectHeader(response, 'cache-control', 'no-cache'),
  ...expectHeader(response, 'strict-transport-security', 'max-age='),
  ...expectHeader(response, 'x-content-type-options', 'nosniff'),
];

const checkDeepLink = (response: ResponseSnapshot): string[] => [
  ...expectStatus(response, 200),
  ...expectHeader(response, 'content-type', 'text/html'),
];

// A deployed file (key relative to the site root) is served with the cache and content type the deploy set
const checkFile = (key: string, response: ResponseSnapshot): string[] => [
  ...expectStatus(response, 200),
  ...expectHeader(response, 'cache-control', cacheControlFor(key)),
  ...expectHeader(response, 'content-type', contentTypeFor(key).split(';')[0]!),
];

const checkFileBody = (key: string, served: string, local: string): string[] =>
  served === local ? [] : [`served ${key} doesn't match the build`];

export { checkDeepLink, checkFile, checkFileBody, checkHomePage, checkServedIndex, DEEP_LINK_PATH, findAssetPaths };

export type { ResponseSnapshot };
