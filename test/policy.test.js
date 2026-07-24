import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_POLICY, normalizePolicy, evaluate, isAllowed,
} from "../src/policy.js";

// Build a scan result shaped like consentScan()'s output.
function scanWith({ verdict, before = [], accepted = false }) {
  const illegal = before.filter(n =>
    ["Advertising", "Analytics", "Data Broker"].includes(n.category));
  return {
    hostname: "example.com", url: "https://example.com",
    scannedAt: "2026-01-01T00:00:00Z",
    verdict, consentAccepted: accepted, cmpName: null, consentClickedAt: null,
    before: { nodes: before, count: before.length },
    after: { nodes: [], count: 0 },
    illegal: { nodes: illegal, count: illegal.length, categories: {} },
  };
}

const node = (id, category, extra = {}) => ({ id, category, parent: null, time: 100, bytes: 0, ...extra });

// ── isAllowed ─────────────────────────────────────────────────────────────────

test("isAllowed matches exact host and subdomains", () => {
  assert.equal(isAllowed("onetrust.com", ["onetrust.com"]), true);
  assert.equal(isAllowed("cdn.onetrust.com", ["onetrust.com"]), true);
  assert.equal(isAllowed("www.onetrust.com", ["onetrust.com"]), true);
  assert.equal(isAllowed("evil-onetrust.com", ["onetrust.com"]), false);
  assert.equal(isAllowed("doubleclick.net", ["onetrust.com"]), false);
});

// ── normalizePolicy ───────────────────────────────────────────────────────────

test("defaults fail on the three consent-requiring categories", () => {
  assert.deepEqual(DEFAULT_POLICY.failOnCategories, ["Advertising", "Analytics", "Data Broker"]);
});

test("normalizePolicy lowercases and strips www from allowlist", () => {
  const p = normalizePolicy({ allow: ["WWW.OneTrust.com", "Cookielaw.org"] });
  assert.deepEqual(p.allow, ["onetrust.com", "cookielaw.org"]);
});

test("normalizePolicy rejects an invalid verdict action", () => {
  assert.throws(() => normalizePolicy({ verdicts: { inconclusive: "explode" } }), /Invalid action/);
});

test("normalizePolicy rejects a non-list allow", () => {
  assert.throws(() => normalizePolicy({ allow: "onetrust.com" }), /must be a list/);
});

// ── evaluate: the pass/fail decisions ─────────────────────────────────────────

test("COMPLIANT passes", () => {
  const r = evaluate(scanWith({ verdict: "COMPLIANT", accepted: true }), DEFAULT_POLICY);
  assert.equal(r.passed, true);
  assert.equal(r.action, "pass");
});

test("NON_COMPLIANT with pre-consent trackers fails", () => {
  const scan = scanWith({
    verdict: "NON_COMPLIANT", accepted: true,
    before: [node("doubleclick.net", "Advertising")],
  });
  const r = evaluate(scan, DEFAULT_POLICY);
  assert.equal(r.passed, false);
  assert.equal(r.violations.length, 1);
});

test("NO_BANNER_DETECTED with tracking fails by default", () => {
  const scan = scanWith({
    verdict: "NO_BANNER_DETECTED",
    before: [node("google-analytics.com", "Analytics"), node("krxd.net", "Data Broker")],
  });
  const r = evaluate(scan, DEFAULT_POLICY);
  assert.equal(r.passed, false);
  assert.equal(r.violations.length, 2);
});

test("NO_BANNER_DETECTED with only benign third parties passes", () => {
  const scan = scanWith({
    verdict: "NO_BANNER_DETECTED",
    before: [node("cloudflare.com", "CDN"), node("gstatic.com", "CDN")],
  });
  const r = evaluate(scan, DEFAULT_POLICY);
  assert.equal(r.passed, true);
  assert.equal(r.violations.length, 0);
});

test("INCONCLUSIVE warns by default — findings reported, build not broken", () => {
  const scan = scanWith({
    verdict: "INCONCLUSIVE",
    before: [node("doubleclick.net", "Advertising")],
  });
  const r = evaluate(scan, DEFAULT_POLICY);
  assert.equal(r.passed, true);
  assert.equal(r.action, "warn");
  assert.equal(r.violations.length, 1);
});

test("INCONCLUSIVE can be escalated to fail", () => {
  const policy = normalizePolicy({ verdicts: { inconclusive: "fail" } });
  const scan = scanWith({
    verdict: "INCONCLUSIVE",
    before: [node("doubleclick.net", "Advertising")],
  });
  assert.equal(evaluate(scan, policy).passed, false);
});

test("allowlist suppresses a matching violation", () => {
  const policy = normalizePolicy({ allow: ["doubleclick.net"] });
  const scan = scanWith({
    verdict: "NON_COMPLIANT", accepted: true,
    before: [node("doubleclick.net", "Advertising"), node("krxd.net", "Data Broker")],
  });
  const r = evaluate(scan, policy);
  assert.equal(r.violations.length, 1);
  assert.equal(r.violations[0].id, "krxd.net");
  assert.equal(r.allowed.length, 1);
  assert.equal(r.allowed[0].id, "doubleclick.net");
});

test("allowlisting away every finding turns a fail into a pass", () => {
  const policy = normalizePolicy({ allow: ["doubleclick.net"] });
  const scan = scanWith({
    verdict: "NON_COMPLIANT", accepted: true,
    before: [node("doubleclick.net", "Advertising")],
  });
  assert.equal(evaluate(scan, policy).passed, true);
});

test("fail_on_categories narrows what counts", () => {
  // Only Data Broker should fail; Analytics is ignored.
  const policy = normalizePolicy({ fail_on_categories: ["Data Broker"] });
  const scan = scanWith({
    verdict: "NO_BANNER_DETECTED",
    before: [node("google-analytics.com", "Analytics"), node("krxd.net", "Data Broker")],
  });
  const r = evaluate(scan, policy);
  assert.equal(r.violations.length, 1);
  assert.equal(r.violations[0].category, "Data Broker");
});

test("Consent-category domains never count as violations", () => {
  // A CMP classified as Consent is not in any fail_on category.
  const scan = scanWith({
    verdict: "NO_BANNER_DETECTED",
    before: [node("cookielaw.org", "Consent")],
  });
  assert.equal(evaluate(scan, DEFAULT_POLICY).violations.length, 0);
});
