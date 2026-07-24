import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeVerdict,
  countByCategory,
  findIllegalNodes,
  VERDICTS,
} from "../src/core/verdict.js";

const node = (id, category) => ({ id, category });

test("findIllegalNodes picks only consent-requiring categories", () => {
  const before = [
    node("doubleclick.net", "Advertising"),
    node("google-analytics.com", "Analytics"),
    node("krxd.net", "Data Broker"),
    node("cloudflare.com", "CDN"),
    node("recaptcha.net", "Security"),
    node("typekit.net", "Fonts"),
  ];
  const illegal = findIllegalNodes(before);
  assert.deepEqual(illegal.map(n => n.id), [
    "doubleclick.net",
    "google-analytics.com",
    "krxd.net",
  ]);
});

test("findIllegalNodes returns empty for an all-infrastructure page", () => {
  const before = [node("cloudflare.com", "CDN"), node("gstatic.com", "CDN")];
  assert.deepEqual(findIllegalNodes(before), []);
});

test("no banner detected reports NO_BANNER_DETECTED regardless of findings", () => {
  assert.equal(
    computeVerdict({ bannerDetected: false, consentAccepted: false, illegalCount: 0 }),
    VERDICTS.NO_BANNER_DETECTED,
  );
  assert.equal(
    computeVerdict({ bannerDetected: false, consentAccepted: false, illegalCount: 12 }),
    VERDICTS.NO_BANNER_DETECTED,
  );
});

// This is the regression test for the inverted-branch bug: a banner we could
// not click must never be reported as a failing site.
test("banner detected but accept click failed is INCONCLUSIVE, never NON_COMPLIANT", () => {
  assert.equal(
    computeVerdict({ bannerDetected: true, consentAccepted: false, illegalCount: 9 }),
    VERDICTS.INCONCLUSIVE,
  );
  assert.equal(
    computeVerdict({ bannerDetected: true, consentAccepted: false, illegalCount: 0 }),
    VERDICTS.INCONCLUSIVE,
  );
});

test("accepted consent with no pre-consent trackers is COMPLIANT", () => {
  assert.equal(
    computeVerdict({ bannerDetected: true, consentAccepted: true, illegalCount: 0 }),
    VERDICTS.COMPLIANT,
  );
});

test("accepted consent with pre-consent trackers is NON_COMPLIANT", () => {
  assert.equal(
    computeVerdict({ bannerDetected: true, consentAccepted: true, illegalCount: 1 }),
    VERDICTS.NON_COMPLIANT,
  );
});

test("a single pre-consent tracker is enough to fail — no threshold", () => {
  // CIPA/GDPR exposure does not have a free allowance. One is a finding.
  assert.equal(
    computeVerdict({ bannerDetected: true, consentAccepted: true, illegalCount: 1 }),
    VERDICTS.NON_COMPLIANT,
  );
});

test("countByCategory tallies findings", () => {
  const illegal = [
    node("a.com", "Advertising"),
    node("b.com", "Advertising"),
    node("c.com", "Data Broker"),
  ];
  assert.deepEqual(countByCategory(illegal), { "Advertising": 2, "Data Broker": 1 });
});

test("countByCategory of nothing is an empty object", () => {
  assert.deepEqual(countByCategory([]), {});
});
