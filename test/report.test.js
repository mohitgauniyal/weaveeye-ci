import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTerminal, formatJson, formatMarkdown } from "../src/report.js";

function fixture(overrides = {}) {
  const scan = {
    hostname: "example.com", url: "https://example.com",
    scannedAt: "2026-01-01T00:00:00Z",
    verdict: "NON_COMPLIANT", cmpName: "OneTrust",
    consentAccepted: true, consentClickedAt: 4200,
    before: { count: 12 }, after: { count: 3 },
    ...overrides.scan,
  };
  const result = {
    passed: false, action: "fail", verdict: scan.verdict,
    reason: "1 consent-requiring tracker fired before consent was given.",
    violations: [
      { id: "doubleclick.net", category: "Advertising", parent: "Google", time: 340, bytes: 68000 },
    ],
    allowed: [],
    ...overrides.result,
  };
  return { scan, result };
}

// ── Terminal ─────────────────────────────────────────────────────────────────

test("terminal report names the domain and the finding", () => {
  const { scan, result } = fixture();
  const out = formatTerminal(scan, result, { color: false });
  assert.match(out, /example\.com/);
  assert.match(out, /NON-COMPLIANT/);
  assert.match(out, /doubleclick\.net/);
  assert.match(out, /Google/);
});

test("terminal report with no colour contains no ANSI escapes", () => {
  const { scan, result } = fixture();
  const out = formatTerminal(scan, result, { color: false });
  assert.doesNotMatch(out, /\x1b\[/);
});

test("terminal report shows a passing state", () => {
  const { scan, result } = fixture({
    scan: { verdict: "COMPLIANT" },
    result: { passed: true, action: "pass", violations: [], reason: "clean" },
  });
  const out = formatTerminal(scan, result, { color: false });
  assert.match(out, /✓/);
});

// ── JSON ─────────────────────────────────────────────────────────────────────

test("JSON report is valid and machine-readable", () => {
  const { scan, result } = fixture();
  const parsed = JSON.parse(formatJson(scan, result));
  assert.equal(parsed.hostname, "example.com");
  assert.equal(parsed.passed, false);
  assert.equal(parsed.verdict, "NON_COMPLIANT");
  assert.equal(parsed.violations.length, 1);
  assert.equal(parsed.violations[0].domain, "doubleclick.net");
  assert.equal(parsed.violations[0].firedAtMs, 340);
});

// ── Markdown ─────────────────────────────────────────────────────────────────

test("markdown report renders a table and a failure header", () => {
  const { scan, result } = fixture();
  const md = formatMarkdown(scan, result);
  assert.match(md, /❌/);
  assert.match(md, /Consent check failed/);
  assert.match(md, /\| Fired at \| Category \| Domain \| Owner \| Data \|/);
  assert.match(md, /`doubleclick\.net`/);
});

test("markdown passing report has no violation table", () => {
  const { scan, result } = fixture({
    scan: { verdict: "COMPLIANT" },
    result: { passed: true, action: "pass", violations: [], reason: "clean" },
  });
  const md = formatMarkdown(scan, result);
  assert.match(md, /✅/);
  assert.doesNotMatch(md, /Fired at/);
});

test("markdown warn state is distinct from pass and fail", () => {
  const { scan, result } = fixture({
    scan: { verdict: "INCONCLUSIVE" },
    result: { passed: true, action: "warn", reason: "warned" },
  });
  const md = formatMarkdown(scan, result);
  assert.match(md, /⚠️/);
  assert.match(md, /warnings/);
});

test("allowlisted suppressions are disclosed, not hidden", () => {
  const { scan, result } = fixture({
    result: {
      passed: true, action: "fail", reason: "clean after allowlist",
      violations: [],
      allowed: [{ id: "onetrust.com", category: "Analytics" }],
    },
  });
  const md = formatMarkdown(scan, result);
  assert.match(md, /allowlisted/);
  assert.match(md, /onetrust\.com/);
});
