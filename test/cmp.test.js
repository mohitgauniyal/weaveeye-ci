import { test } from "node:test";
import assert from "node:assert/strict";
import { CMP_DEFINITIONS, detectCMP } from "../src/core/cmp.js";

/**
 * Minimal stand-in for a Playwright Page. `present` is the set of CSS
 * selectors that "exist"; `visible` is the subset that is also visible.
 * Matching is by exact selector-string membership, which is enough because
 * detectCMP only ever passes the definition strings verbatim.
 */
function fakePage({ present = [], visible = [] } = {}) {
  return {
    async $(selector) {
      if (!present.includes(selector)) return null;
      return { isVisible: async () => visible.includes(selector) };
    },
  };
}

const def = name => CMP_DEFINITIONS.find(c => c.name === name);

test("finds a CMP by its accept button and marks it actionable", () => {
  const onetrust = def("OneTrust");
  return detectCMP(fakePage({ present: [onetrust.selector] })).then(cmp => {
    assert.equal(cmp.name, "OneTrust");
    assert.equal(cmp.actionable, true);
  });
});

test("an accept button does not need to be visible", async () => {
  // Fides renders its button hidden before revealing the banner, and we
  // click via JS, so DOM presence is the correct signal.
  const fides = def("Fides");
  const cmp = await detectCMP(fakePage({ present: [fides.selector], visible: [] }));
  assert.equal(cmp.name, "Fides");
  assert.equal(cmp.actionable, true);
});

// The regression test for the OneTrust false positive. The SDK container is
// injected on every page load, including in regions where no banner is shown.
test("an invisible container with no accept button is not a banner", async () => {
  const onetrust = def("OneTrust");
  const cmp = await detectCMP(fakePage({ present: [onetrust.detect], visible: [] }));
  assert.equal(cmp, null, "SDK container alone must not count as a banner");
});

test("a visible container with no accept button is detected but not actionable", async () => {
  const onetrust = def("OneTrust");
  const cmp = await detectCMP(fakePage({
    present: [onetrust.detect],
    visible: [onetrust.detect],
  }));
  assert.equal(cmp.name, "OneTrust");
  assert.equal(cmp.actionable, false);
});

// The generic container selectors match any element with "cookie" in a class
// name — including a footer "Cookie preferences" link.
test("the generic fallback never reports a container-only banner", async () => {
  const generic = def("Generic");
  const cmp = await detectCMP(fakePage({
    present: [generic.detect],
    visible: [generic.detect],
  }));
  assert.equal(cmp, null);
});

test("the generic fallback matches only with a container AND a visible button", async () => {
  const generic = def("Generic");
  // Button + consent container + visible → a real generic banner.
  const cmp = await detectCMP(fakePage({
    present: [generic.selector, generic.detect],
    visible: [generic.selector],
  }));
  assert.equal(cmp.name, "Generic");
  assert.equal(cmp.actionable, true);
});

test("a stray accept button with no consent container is not a generic banner", async () => {
  // e.g. an "Accept terms" button on a page with no cookie/consent context.
  const generic = def("Generic");
  const cmp = await detectCMP(fakePage({
    present: [generic.selector],
    visible: [generic.selector],
  }));
  assert.equal(cmp, null);
});

test("a generic button inside a container but hidden does not match", async () => {
  const generic = def("Generic");
  const cmp = await detectCMP(fakePage({
    present: [generic.selector, generic.detect],
    visible: [], // button present but not visible
  }));
  assert.equal(cmp, null);
});

test("returns null when the page has no consent machinery at all", async () => {
  assert.equal(await detectCMP(fakePage()), null);
});

test("a named CMP wins over the generic fallback", async () => {
  const cookiebot = def("Cookiebot");
  const generic = def("Generic");
  const cmp = await detectCMP(fakePage({ present: [generic.selector, cookiebot.selector] }));
  assert.equal(cmp.name, "Cookiebot");
});

test("Generic is defined last so it cannot shadow a named CMP", () => {
  assert.equal(CMP_DEFINITIONS.at(-1).name, "Generic");
  assert.equal(CMP_DEFINITIONS.at(-1).genericFallback, true);
  // Exactly one fallback definition.
  assert.equal(CMP_DEFINITIONS.filter(c => c.genericFallback).length, 1);
});

test("every definition has the fields detectCMP relies on", () => {
  for (const cmp of CMP_DEFINITIONS) {
    assert.ok(cmp.name, "missing name");
    assert.ok(cmp.detect, `${cmp.name} missing detect`);
    assert.ok(cmp.selector, `${cmp.name} missing selector`);
  }
});

test("detectCMP survives a page that throws on query", async () => {
  const throwingPage = { async $() { throw new Error("navigation destroyed context"); } };
  assert.equal(await detectCMP(throwingPage), null);
});
