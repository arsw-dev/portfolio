// CloudFront Function (cloudfront-js-2.0) on viewer-request.
// Client-side routes like /writing/some-post have no matching S3 object, so serve the SPA shell
// for any path whose last segment has no file extension. Real files (/assets/app-1a2b.js, /robots.txt)
// pass through untouched, so a missing asset still errors instead of returning HTML.
// The runtime requires a top-level function declaration named handler.

// eslint-disable-next-line no-unused-vars, unused-imports/no-unused-vars
function handler(event) {
  const request = event.request;
  const lastSegment = request.uri.slice(request.uri.lastIndexOf('/') + 1);

  if (!lastSegment.includes('.')) {
    request.uri = '/index.html';
  }

  return request;
}
