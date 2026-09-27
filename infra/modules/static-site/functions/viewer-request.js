// CloudFront Function (cloudfront-js-2.0) on viewer-request.
// Client-side routes like /writing/some-post have no matching S3 object, so serve the SPA shell
// for any path whose last segment has no file extension. Real files (/assets/app-1a2b.js, /robots.txt)
// pass through untouched, so a missing asset still errors instead of returning HTML.
// /_deploys/ holds the deploy tool's build records, which are bookkeeping, not site content: answered with 404.
// (The bucket policy also denies CloudFront those keys, so this is the friendly answer, not the only guard.)
// Paths are matched decoded: S3 decodes %5F and %2F, so /%5Fdeploys/x must count as /_deploys/x.
// /.well-known/ is never rewritten: files there are often extensionless (apple-app-site-association) and
// must never be answered with the SPA shell.
// The runtime requires a top-level function declaration named handler.

// eslint-disable-next-line no-unused-vars, unused-imports/no-unused-vars
function handler(event) {
  const request = event.request;
  let path = request.uri;
  try {
    path = decodeURIComponent(request.uri);
  }
  // A catch binding, because optional catch binding (ES2019) may not exist in cloudfront-js-2.0
  // eslint-disable-next-line unused-imports/no-unused-vars
  catch (_error) {
    // Malformed escapes: match the raw URI; S3 rejects the key anyway
  }

  if (path.startsWith('/_deploys/')) {
    return { statusCode: 404, statusDescription: 'Not Found' };
  }
  if (path.startsWith('/.well-known/')) {
    return request;
  }

  const lastSegment = path.slice(path.lastIndexOf('/') + 1);

  if (!lastSegment.includes('.')) {
    request.uri = '/index.html';
  }

  return request;
}
