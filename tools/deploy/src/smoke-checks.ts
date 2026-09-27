// Pure checks for a deployed site. Each returns a list of failures; empty means it passed.

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

// First hashed asset the page references, e.g. /assets/index-BaXPYhR1.js
const findAssetPath = (html: string): string | undefined =>
  /(?:src|href)="(\/assets\/[^"]+)"/.exec(html)?.[1];

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

const checkAsset = (response: ResponseSnapshot): string[] => [
  ...expectStatus(response, 200),
  ...expectHeader(response, 'cache-control', 'immutable'),
];

export { checkAsset, checkDeepLink, checkHomePage, DEEP_LINK_PATH, findAssetPath };

export type { ResponseSnapshot };
