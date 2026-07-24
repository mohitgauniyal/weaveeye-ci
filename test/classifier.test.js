import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { classifyDomain } from "../src/core/classifier.js";
import { setTrackerMap } from "../src/core/trackers.js";

// A stand-in for the merged DDG + Disconnect map, so these tests never touch
// the network. Shape matches what parseDDG/parseDisconnect produce.
const FAKE_TRACKER_DB = {
  "adservice.google.com": { category: "Advertising", parent: "Google / Alphabet" },
  "some-obscure-tracker.io": { category: "Analytics", parent: "Obscure Inc" },
  "tracker-network.example": { category: "Data Broker", parent: "Example Data Co" },
  // An entry whose DDG category did not map to one of ours: parent only.
  "unmapped-category.example": { category: null, parent: "Mystery Corp" },
};

beforeEach(() => setTrackerMap({ ...FAKE_TRACKER_DB }));

test("hand-curated EXACT map wins for an exact host", () => {
  assert.deepEqual(classifyDomain("doubleclick.net"), {
    category: "Advertising",
    parent: "Google / Alphabet",
  });
});

test("www. prefix is stripped before lookup", () => {
  assert.deepEqual(classifyDomain("www.doubleclick.net"), {
    category: "Advertising",
    parent: "Google / Alphabet",
  });
});

// The regression test for the deleted step 3. Before this fix the entire
// ~200k-domain tracker database was downloaded nightly and never consulted.
test("tracker database is actually consulted for unknown domains", () => {
  assert.deepEqual(classifyDomain("some-obscure-tracker.io"), {
    category: "Analytics",
    parent: "Obscure Inc",
  });
  assert.deepEqual(classifyDomain("tracker-network.example"), {
    category: "Data Broker",
    parent: "Example Data Co",
  });
});

// The reason exact-host lookups sit above registered-domain lookups.
test("exact-host tracker entry beats a registered-domain EXACT entry", () => {
  // EXACT has google.com => Infrastructure. Without exact-host priority,
  // adservice.google.com would inherit it and be under-reported as benign.
  assert.deepEqual(classifyDomain("adservice.google.com"), {
    category: "Advertising",
    parent: "Google / Alphabet",
  });
});

test("registered-domain EXACT entry still applies to ordinary subdomains", () => {
  assert.deepEqual(classifyDomain("mail.google.com"), {
    category: "Infrastructure",
    parent: "Google / Alphabet",
  });
});

test("suffix rules catch subdomains of known ad networks", () => {
  assert.deepEqual(classifyDomain("stats.g.doubleclick.net"), {
    category: "Advertising",
    parent: "Google / Alphabet",
  });
});

test("a tracker-list entry with an unmapped category contributes only its parent", () => {
  // Must not be claimed as a category; falls through to the heuristics/default
  // but keeps the ownership information.
  assert.deepEqual(classifyDomain("unmapped-category.example"), {
    category: "Infrastructure",
    parent: "Mystery Corp",
  });
});

test("keyword heuristics are the last resort", () => {
  assert.equal(classifyDomain("some-random-analytics.example").category, "Analytics");
  assert.equal(classifyDomain("cdn.unknown-host.example").category, "CDN");
  assert.equal(classifyDomain("checkout.unknown-host.example").category, "Payment");
});

test("completely unknown domains default to Infrastructure with no parent", () => {
  assert.deepEqual(classifyDomain("zzz-nothing-known.example"), {
    category: "Infrastructure",
    parent: null,
  });
});

test("classification works before the tracker DB has loaded", () => {
  // Server boots and can be hit before updateTrackerLists() resolves.
  setTrackerMap({});
  assert.deepEqual(classifyDomain("doubleclick.net"), {
    category: "Advertising",
    parent: "Google / Alphabet",
  });
  assert.equal(classifyDomain("zzz-nothing-known.example").category, "Infrastructure");
});

test("returned object is a copy — callers cannot poison the maps", () => {
  const first = classifyDomain("doubleclick.net");
  first.category = "MUTATED";
  assert.equal(classifyDomain("doubleclick.net").category, "Advertising");
});

test("cloudflareinsights.com is Analytics, not Security", () => {
  // It reports visitor data back to Cloudflare, so it requires consent.
  // A duplicate key previously made it Security and excluded it from findings.
  assert.equal(classifyDomain("cloudflareinsights.com").category, "Analytics");
});

// ── Tracking subdomains on benign parents ────────────────────────────────────
// The generated lists are keyed by registered domain, so these inherit a
// benign classification and get silently excluded from findings.

test("tracking subdomains are escalated off benign parents", () => {
  // Microsoft UET — would otherwise be Infrastructure via bing.com
  assert.equal(classifyDomain("bat.bing.com").category, "Advertising");
  // LinkedIn ads pixel — would otherwise be Social via linkedin.com
  assert.equal(classifyDomain("px.ads.linkedin.com").category, "Advertising");
  // Google ad server — would otherwise be Infrastructure via google.com
  assert.equal(classifyDomain("adservice.google.com").category, "Advertising");
  // TikTok analytics — would otherwise be Social via tiktok.com
  assert.equal(classifyDomain("analytics.tiktok.com").category, "Analytics");
});

test("escalation preserves the parent company", () => {
  assert.equal(classifyDomain("px.ads.linkedin.com").parent, "Microsoft");
  assert.equal(classifyDomain("analytics.tiktok.com").parent, "ByteDance");
});

test("escalation never downgrades an already-tracking classification", () => {
  // "stats" maps to Analytics, but this is already Advertising and must stay.
  assert.equal(classifyDomain("stats.g.doubleclick.net").category, "Advertising");
});

test("escalation does not fire on a bare registered domain", () => {
  // "ads.com" style hosts have no subdomain to signal intent.
  setTrackerMap({});
  assert.equal(classifyDomain("track.example").category, "Infrastructure");
});

test("escalation does not fire on unrelated subdomains", () => {
  setTrackerMap({});
  assert.equal(classifyDomain("images.example.com").category, "Infrastructure");
  assert.equal(classifyDomain("shop.example.com").category, "Infrastructure");
});

// ── Consent Management Platforms ─────────────────────────────────────────────

test("CMP domains are classified as Consent, not as trackers", () => {
  // A site must not be marked non-compliant because its cookie banner loaded.
  for (const host of ["cookielaw.org", "onetrust.com", "cookiebot.com", "didomi.io"]) {
    assert.equal(classifyDomain(host).category, "Consent", `${host} should be Consent`);
  }
});

test("CMP subdomains inherit the Consent classification", () => {
  assert.equal(classifyDomain("cdn.cookielaw.org").category, "Consent");
  assert.equal(classifyDomain("geolocation.onetrust.com").category, "Consent");
});

test("Consent is not a consent-requiring category", async () => {
  const { CONSENT_REQUIRED_CATEGORIES } = await import("../src/core/verdict.js");
  assert.ok(!CONSENT_REQUIRED_CATEGORIES.includes("Consent"));
});

test("consent-requiring categories survive a full round trip", () => {
  // The domains that most commonly appear in pre-consent findings.
  const expected = {
    "google-analytics.com": "Analytics",
    "googletagmanager.com": "Analytics",
    "doubleclick.net": "Advertising",
    "facebook.net": "Advertising",
    "amazon-adsystem.com": "Advertising",
    "krxd.net": "Data Broker",
    "demdex.net": "Data Broker",
  };
  for (const [host, category] of Object.entries(expected)) {
    assert.equal(classifyDomain(host).category, category, `${host} should be ${category}`);
  }
});
