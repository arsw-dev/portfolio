#!/usr/bin/env bash
# Runs viewer-request.cases.json against the published (LIVE) CloudFront Function in CloudFront's own runtime,
# which can differ from Node. test-function executes the code on a sample event and changes nothing.
#
#   FUNCTION_NAME=arsw-portfolio-viewer-request infra/modules/static-site/functions/test-live.sh
#
# Requires the aws CLI, jq, and cloudfront:DescribeFunction + cloudfront:TestFunction.

set -euo pipefail

dir="$(cd "$(dirname "$0")" && pwd)"
name="${FUNCTION_NAME:?FUNCTION_NAME is required}"
event_file="$(mktemp)"
trap 'rm -f "$event_file"' EXIT

etag="$(aws cloudfront describe-function --name "$name" --stage LIVE --query ETag --output text)"
failures=0

while read -r test_case; do
  uri="$(jq -r .uri <<< "$test_case")"
  # Either the rewritten URI, or "status <code>" when the function answers the request itself
  expected="$(jq -r 'if .status then "status \(.status)" else .expected end' <<< "$test_case")"

  jq -n --arg uri "$uri" '{
    version: "1.0",
    context: { eventType: "viewer-request" },
    viewer: { ip: "198.51.100.1" },
    request: { method: "GET", uri: $uri, querystring: {}, headers: {}, cookies: {} }
  }' > "$event_file"

  result="$(aws cloudfront test-function --name "$name" --if-match "$etag" --stage LIVE \
    --event-object "fileb://$event_file" --query TestResult --output json)"

  error="$(jq -r '.FunctionErrorMessage // empty' <<< "$result")"
  actual="$(jq -r '.FunctionOutput // "{}" | fromjson | if .response then "status \(.response.statusCode)" else .request.uri // empty end' <<< "$result")"

  if [[ -z "$error" && "$actual" == "$expected" ]]; then
    echo "pass  $uri -> $actual"
  else
    echo "FAIL  $uri: expected $expected, got ${actual:-nothing}${error:+ (error: $error)}"
    failures=$((failures + 1))
  fi
done < <(jq -c '.[]' "$dir/viewer-request.cases.json")

if (( failures > 0 )); then
  echo "$failures case(s) failed"
  exit 1
fi
