import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL("../lib/fanza-safe-log.ts", import.meta.url);
const {
  getSafeFanzaError,
  logFanzaSearchFailure,
  sanitizeFanzaLogValue,
} = await import(moduleUrl);

test("masks FANZA credentials and the complete authenticated URL", () => {
  const apiId = process.env.DMM_API_ID ?? "test-api-value";
  const affiliateId =
    process.env.DMM_AFFILIATE_ID ?? "test-affiliate-value";
  const authenticatedUrl =
    `https://api.dmm.com/affiliate/v3/GenreSearch?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}&offset=101&output=json`;
  const sanitized = String(
    sanitizeFanzaLogValue(`Dynamic Server Usage: fetch ${authenticatedUrl}`)
  );

  assert.equal(sanitized.includes(apiId), false);
  assert.equal(sanitized.includes(affiliateId), false);
  assert.equal(sanitized.includes("api_id="), false);
  assert.equal(sanitized.includes("affiliate_id="), false);
  assert.equal(sanitized.includes("https://api.dmm.com/affiliate/v3/"), false);
  assert.match(sanitized, /\[FANZA_API_URL_REDACTED\]/);
});

test("masks standalone credential parameters recursively", () => {
  const sanitized = sanitizeFanzaLogValue({
    message: "api_id=secret&affiliate_id=secret-two",
    api_id: "secret",
    nested: ["affiliate_id=secret-two"],
  });
  const serialized = JSON.stringify(sanitized);

  assert.equal(serialized.includes("api_id="), false);
  assert.equal(serialized.includes("affiliate_id="), false);
  assert.equal(serialized.includes('"api_id"'), false);
});

test("keeps safe exception diagnostics", () => {
  const error = new Error(
    "Dynamic Server Usage at " +
      "https://api.dmm.com/affiliate/v3/SeriesSearch?api_id=a&affiliate_id=b&offset=201"
  );
  const sanitized = getSafeFanzaError(error);

  assert.equal(sanitized.name, "Error");
  assert.match(String(sanitized.message), /Dynamic Server Usage/);
  assert.equal(JSON.stringify(sanitized).includes("api_id="), false);
});

test("HTTP and exception logs retain only safe diagnostics", () => {
  const entries = [];
  const originalConsoleError = console.error;
  console.error = (...values) => entries.push(values);

  try {
    logFanzaSearchFailure({
      api: "SeriesSearch",
      initial: "あ",
      offset: 101,
      status: 503,
    });
    logFanzaSearchFailure({
      api: "MakerSearch",
      error: new Error(
        "Dynamic Server Usage: " +
          "https://api.dmm.com/affiliate/v3/MakerSearch?api_id=secret&affiliate_id=secret-two&offset=201"
      ),
      initial: "か",
      offset: 201,
      status: null,
    });
  } finally {
    console.error = originalConsoleError;
  }

  const output = JSON.stringify(entries);
  assert.match(output, /SeriesSearch/);
  assert.match(output, /MakerSearch/);
  assert.match(output, /503/);
  assert.match(output, /101/);
  assert.match(output, /201/);
  assert.match(output, /Dynamic Server Usage/);
  assert.equal(output.includes("api_id="), false);
  assert.equal(output.includes("affiliate_id="), false);
  assert.equal(output.includes("https://api.dmm.com/affiliate/v3/"), false);
});
