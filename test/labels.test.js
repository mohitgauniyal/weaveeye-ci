import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLabel, sizeFromBytes, titleCase } from "../src/core/labels.js";

test("titleCase capitalises each word", () => {
  assert.equal(titleCase("hello world"), "Hello World");
  assert.equal(titleCase("doubleclick"), "Doubleclick");
});

test("buildLabel on a bare registered domain", () => {
  assert.equal(buildLabel("doubleclick.net"), "Doubleclick");
  assert.equal(buildLabel("google-analytics.com"), "Google Analytics");
});

test("buildLabel keeps a meaningful subdomain", () => {
  assert.equal(buildLabel("collector.github.com"), "Collector (Github)");
  assert.equal(buildLabel("adservice.google.com"), "Adservice (Google)");
});

test("buildLabel drops generic subdomains", () => {
  assert.equal(buildLabel("www.example.com"), "Example");
  assert.equal(buildLabel("cdn.example.com"), "Example");
  assert.equal(buildLabel("static.example.com"), "Example");
  assert.equal(buildLabel("img.example.com"), "Example");
  assert.equal(buildLabel("api.example.com"), "Example");
});

test("buildLabel handles deep subdomains", () => {
  assert.equal(buildLabel("a.b.c.example.com"), "A (Example)");
});

test("buildLabel survives a hostname with no dot", () => {
  assert.equal(buildLabel("localhost"), "Localhost");
});

test("sizeFromBytes buckets by payload size", () => {
  assert.equal(sizeFromBytes(0), 9);
  assert.equal(sizeFromBytes(999), 9);
  assert.equal(sizeFromBytes(1001), 11);
  assert.equal(sizeFromBytes(10001), 14);
  assert.equal(sizeFromBytes(100001), 18);
  assert.equal(sizeFromBytes(500001), 22);
});
