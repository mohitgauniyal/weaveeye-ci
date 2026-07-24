import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeVerdict,
  countByCategory,
  findConfirmedViolations,
  findGatedTags,
  isConfirmedTransfer,
  VERDICTS,
} from "../src/core/verdict.js";

const node = (id, category, extra = {}) => ({ id, category, ...extra });

// ── isConfirmedTransfer ───────────────────────────────────────────────────────

test("ad exchanges and data brokers are always confirmed transfers", () => {
  // Consent Mode never gates third-party ad-tech, so even a script load counts.
  assert.equal(isConfirmedTransfer(node("doubleclick.net", "Advertising")), true);
  assert.equal(isConfirmedTransfer(node("krxd.net", "Data Broker")), true);
  assert.equal(isConfirmedTransfer(node("doubleclick.net", "Advertising", { dataFlow: false })), true);
});

test("an analytics tag that sent data is a confirmed transfer", () => {
  assert.equal(isConfirmedTransfer(node("google-analytics.com", "Analytics", { dataFlow: true })), true);
});

test("an analytics tag that only loaded a script is NOT a confirmed transfer", () => {
  // The Consent Mode case: googletagmanager loads but may withhold data.
  assert.equal(isConfirmedTransfer(node("googletagmanager.com", "Analytics", { dataFlow: false })), false);
  assert.equal(isConfirmedTransfer(node("googletagmanager.com", "Analytics")), false);
});

// ── findConfirmedViolations vs findGatedTags ──────────────────────────────────

test("splits pre-consent findings into confirmed transfers and gated tags", () => {
  const before = [
    node("doubleclick.net", "Advertising", { dataFlow: false }),   // ad-tech → violation
    node("krxd.net", "Data Broker", { dataFlow: false }),          // broker → violation
    node("google-analytics.com", "Analytics", { dataFlow: true }), // analytics + data → violation
    node("googletagmanager.com", "Analytics", { dataFlow: false }),// analytics, script only → gated
    node("cloudflare.com", "CDN", { dataFlow: true }),             // not consent-requiring
  ];
  assert.deepEqual(findConfirmedViolations(before).map(n => n.id),
    ["doubleclick.net", "krxd.net", "google-analytics.com"]);
  assert.deepEqual(findGatedTags(before).map(n => n.id),
    ["googletagmanager.com"]);
});

test("a page whose only pre-consent tag is a gated GTM has zero confirmed violations", () => {
  // This is the hp.com case: one googletagmanager.com script load, nothing else.
  const before = [node("googletagmanager.com", "Analytics", { dataFlow: false })];
  assert.equal(findConfirmedViolations(before).length, 0);
  assert.equal(findGatedTags(before).length, 1);
});

test("findConfirmedViolations ignores non-consent categories", () => {
  const before = [node("cloudflare.com", "CDN", { dataFlow: true }), node("gstatic.com", "Fonts", { dataFlow: true })];
  assert.deepEqual(findConfirmedViolations(before), []);
});

// ── computeVerdict ────────────────────────────────────────────────────────────

test("no banner detected reports NO_BANNER_DETECTED regardless of findings", () => {
  assert.equal(computeVerdict({ bannerDetected: false, consentAccepted: false, violationCount: 0 }), VERDICTS.NO_BANNER_DETECTED);
  assert.equal(computeVerdict({ bannerDetected: false, consentAccepted: false, violationCount: 12 }), VERDICTS.NO_BANNER_DETECTED);
});

test("banner detected but accept click failed is INCONCLUSIVE, never NON_COMPLIANT", () => {
  assert.equal(computeVerdict({ bannerDetected: true, consentAccepted: false, violationCount: 9 }), VERDICTS.INCONCLUSIVE);
  assert.equal(computeVerdict({ bannerDetected: true, consentAccepted: false, violationCount: 0 }), VERDICTS.INCONCLUSIVE);
});

test("accepted consent with no confirmed transfers is COMPLIANT", () => {
  assert.equal(computeVerdict({ bannerDetected: true, consentAccepted: true, violationCount: 0 }), VERDICTS.COMPLIANT);
});

test("accepted consent with a confirmed transfer is NON_COMPLIANT", () => {
  assert.equal(computeVerdict({ bannerDetected: true, consentAccepted: true, violationCount: 1 }), VERDICTS.NON_COMPLIANT);
});

test("a single confirmed transfer is enough to fail — no threshold", () => {
  assert.equal(computeVerdict({ bannerDetected: true, consentAccepted: true, violationCount: 1 }), VERDICTS.NON_COMPLIANT);
});

// ── countByCategory ───────────────────────────────────────────────────────────

test("countByCategory tallies findings", () => {
  const v = [node("a.com", "Advertising"), node("b.com", "Advertising"), node("c.com", "Data Broker")];
  assert.deepEqual(countByCategory(v), { "Advertising": 2, "Data Broker": 1 });
});

test("countByCategory of nothing is an empty object", () => {
  assert.deepEqual(countByCategory([]), {});
});
