import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyBlock } from "../src/core/scan.js";

test("detects common bot-wall challenge pages by title", () => {
  const cases = [
    "Access to this page has been denied",
    "Just a moment...",
    "Attention Required! | Cloudflare",
    "Pardon Our Interruption",
  ];
  for (const title of cases) {
    const r = classifyBlock(title, "some body text long enough to pass the length check here");
    assert.equal(r.blocked, true, `"${title}" should be flagged`);
  }
});

test("detects a challenge phrase appearing in body text", () => {
  const r = classifyBlock("Home", "Please enable JS and disable any ad blocker to continue.");
  assert.equal(r.blocked, true);
});

test("flags a near-empty page as a likely block", () => {
  assert.equal(classifyBlock("", "").blocked, true);
  assert.equal(classifyBlock("Site", "   ").blocked, true);
});

test("a real page with content is not blocked", () => {
  const text = "Welcome to our store. Browse thousands of products across dozens of categories.";
  const r = classifyBlock("Big Store — Home", text);
  assert.equal(r.blocked, false);
  assert.equal(r.reason, null);
});

test("matching is case-insensitive", () => {
  assert.equal(classifyBlock("ACCESS DENIED", "x".repeat(50)).blocked, true);
});
