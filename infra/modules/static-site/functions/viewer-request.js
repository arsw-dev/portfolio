// CloudFront Function (cloudfront-js-2.0) on viewer-request.
// Client-side routes like /writing/some-post have no matching S3 object, so serve the SPA shell
// for any path whose last segment has no file extension. Real files (/assets/app-1a2b.js, /robots.txt)
// pass through untouched, so a missing asset still errors instead of returning HTML.
// /_deploys/ holds the deploy tool's build records, which are bookkeeping, not site content: answered with 404.
// /.well-known/ is never rewritten: files there are often extensionless (apple-app-site-association) and
// must never be answered with the SPA shell.
// The runtime requires a top-level function declaration named handler.

// eslint-disable-next-line no-unused-vars, unused-imports/no-unused-vars
function handler(event) {
  const request = event.request;
  if (request.uri.startsWith('/_deploys/')) {
    return { statusCode: 404, statusDescription: 'Not Found' };
  }
  if (request.uri.startsWith('/.well-known/')) {
    return request;
  }

  const lastSegment = request.uri.slice(request.uri.lastIndexOf('/') + 1);

  if (!lastSegment.includes('.')) {
    request.uri = '/index.html';
  }

  return request;
}
