import assert from "node:assert/strict";
import test from "node:test";
import {
  InFlightLimiter,
  InFlightLimitError,
} from "../lib/in-flight-limiter.ts";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("same key shares one operation across 100 callers", async () => {
  const limiter = new InFlightLimiter(20);
  let calls = 0;
  const operation = () => {
    calls += 1;
    return wait(10).then(() => "ok");
  };
  const results = await Promise.all(
    Array.from({ length: 100 }, () => limiter.run("same", operation))
  );
  assert.equal(calls, 1);
  assert.ok(results.every((value) => value === "ok"));
  assert.deepEqual(limiter.stats(), {
    active: 0,
    max: 20,
    mapSize: 0,
    deduplicated: 99,
    rejected: 0,
  });
});

test("20 distinct keys run and the 21st is rejected", async () => {
  const limiter = new InFlightLimiter(20);
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const operation = () => { calls += 1; return gate; };
  const running = Array.from({ length: 20 }, (_, i) => limiter.run(`k${i}`, operation));
  await Promise.resolve();
  assert.equal(calls, 20);
  await assert.rejects(
    Promise.resolve().then(() => limiter.run("k20", operation)),
    (error) => error instanceof InFlightLimitError
  );
  assert.equal(calls, 20);
  assert.equal(limiter.stats().active, 20);
  assert.equal(limiter.stats().mapSize, 20);
  assert.equal(limiter.run("k0", operation), running[0]);
  release();
  await Promise.all(running);
  assert.equal(limiter.stats().active, 0);
  assert.equal(limiter.stats().mapSize, 0);
});

test("a failed operation releases its slot and key", async () => {
  const limiter = new InFlightLimiter(20);
  await assert.rejects(limiter.run("failure", async () => { throw new Error("boom"); }));
  assert.equal(limiter.stats().active, 0);
  assert.equal(limiter.stats().mapSize, 0);
  await assert.doesNotReject(limiter.run("next", async () => "recovered"));
  assert.equal(limiter.stats().active, 0);
  assert.equal(limiter.stats().mapSize, 0);
});

test("ItemList and ActressSearch share the same 20-request budget", async () => {
  const limiter = new InFlightLimiter(20);
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const operation = () => { calls += 1; return gate; };
  const running = [
    ...Array.from({ length: 10 }, (_, i) => limiter.run(`ItemList:${i}`, operation)),
    ...Array.from({ length: 10 }, (_, i) => limiter.run(`ActressSearch:${i}`, operation)),
  ];
  assert.equal(calls, 20);
  assert.equal(limiter.stats().active, 20);
  await assert.rejects(
    Promise.resolve().then(() => limiter.run("GenreSearch:new", operation)),
    (error) => error instanceof InFlightLimitError
  );
  assert.equal(calls, 20);
  release();
  await Promise.all(running);
  assert.equal(limiter.stats().active, 0);
  assert.equal(limiter.stats().mapSize, 0);
});
