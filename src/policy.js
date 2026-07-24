// Policy: what turns a scan into a pass or a failed build.
//
// The gate's core question is single: did any consent-requiring third party
// fire before valid consent? The policy decides which categories count, which
// domains are exempt, and how to treat each verdict.

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { CONSENT_REQUIRED_CATEGORIES } from "./core/verdict.js";

// How each verdict maps to a build outcome, by default. Overridable per policy.
//   fail — a build-breaking violation when there are findings
//   warn — report findings but do not break the build
//   pass — never break the build on this verdict
export const DEFAULT_POLICY = {
  // Categories that must not appear before consent.
  failOnCategories: [...CONSENT_REQUIRED_CATEGORIES],
  // Domains (and their subdomains) exempt from findings — e.g. a CMP, or a
  // tracker the org has a documented lawful basis for.
  allow: [],
  verdicts: {
    non_compliant: "fail",       // trackers fired before an accepted banner
    no_banner_detected: "fail",  // tracking with no consent mechanism at all
    inconclusive: "warn",        // banner present but the scanner couldn't accept it
    compliant: "pass",
  },
};

const VERDICT_KEY = {
  NON_COMPLIANT: "non_compliant",
  NO_BANNER_DETECTED: "no_banner_detected",
  INCONCLUSIVE: "inconclusive",
  COMPLIANT: "compliant",
};

const VALID_ACTIONS = new Set(["fail", "warn", "pass"]);

// Load and validate a policy file (.yml/.yaml/.json). Returns a policy merged
// over the defaults. Throws with a clear message on malformed input.
export function loadPolicy(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return { ...DEFAULT_POLICY, _source: "defaults" };
    throw new Error(`Could not read policy at ${path}: ${err.message}`);
  }

  let parsed;
  try {
    parsed = path.endsWith(".json") ? JSON.parse(raw) : parseYaml(raw);
  } catch (err) {
    throw new Error(`Policy at ${path} is not valid ${path.endsWith(".json") ? "JSON" : "YAML"}: ${err.message}`);
  }

  return normalizePolicy(parsed || {}, path);
}

export function normalizePolicy(input, source = "inline") {
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Policy must be a mapping of options.");
  }

  const policy = {
    failOnCategories: input.fail_on_categories ?? DEFAULT_POLICY.failOnCategories,
    allow: input.allow ?? DEFAULT_POLICY.allow,
    verdicts: { ...DEFAULT_POLICY.verdicts, ...(input.verdicts || {}) },
    _source: source,
  };

  if (!Array.isArray(policy.failOnCategories) || policy.failOnCategories.some(c => typeof c !== "string")) {
    throw new Error("`fail_on_categories` must be a list of category names.");
  }
  if (!Array.isArray(policy.allow) || policy.allow.some(d => typeof d !== "string")) {
    throw new Error("`allow` must be a list of domains.");
  }
  for (const [key, action] of Object.entries(policy.verdicts)) {
    if (!VALID_ACTIONS.has(action)) {
      throw new Error(`Invalid action "${action}" for verdict "${key}". Use fail, warn or pass.`);
    }
  }

  // Normalise allowlist entries to bare hostnames.
  policy.allow = policy.allow.map(d => d.trim().toLowerCase().replace(/^www\./, ""));
  return policy;
}

// Is `host` covered by the allowlist (exact or as a subdomain of an entry)?
export function isAllowed(host, allow) {
  const h = host.replace(/^www\./, "").toLowerCase();
  return allow.some(entry => h === entry || h.endsWith(`.${entry}`));
}

/**
 * Evaluate a scan result against a policy.
 *
 * Returns:
 *   {
 *     passed,        // false only when a fail-action verdict has real violations
 *     action,        // fail | warn | pass — the verdict's configured action
 *     verdict,       // the raw scan verdict
 *     violations,    // findings that count, after category filter + allowlist
 *     allowed,       // findings suppressed by the allowlist
 *     reason,        // one-line human explanation
 *   }
 */
export function evaluate(scan, policy = DEFAULT_POLICY) {
  // A blocked scan saw a challenge page, not the real site. Its findings are
  // unreliable in both directions, so it can neither fail the build nor certify
  // the site clean. Surface it as a warning, never a confident verdict.
  if (scan.blocked) {
    return {
      passed: true, action: "blocked", verdict: scan.verdict,
      violations: [], allowed: [],
      reason: `Scanner was blocked (${scan.blockReason}). Result is unreliable — re-run, or scan from an allowlisted IP.`,
    };
  }

  const action = policy.verdicts[VERDICT_KEY[scan.verdict]] ?? "fail";

  // Findings = before-consent third parties in a failing category, minus allowlist.
  const inScope = (scan.illegal?.nodes || []).filter(n =>
    policy.failOnCategories.includes(n.category),
  );
  const violations = inScope.filter(n => !isAllowed(n.id, policy.allow));
  const allowed = inScope.filter(n => isAllowed(n.id, policy.allow));

  if (action === "pass") {
    return { passed: true, action, verdict: scan.verdict, violations, allowed,
      reason: reasonFor(scan.verdict, violations.length, "pass") };
  }

  if (violations.length === 0) {
    return { passed: true, action, verdict: scan.verdict, violations, allowed,
      reason: reasonFor(scan.verdict, 0, action) };
  }

  // There are violations.
  if (action === "warn") {
    return { passed: true, action, verdict: scan.verdict, violations, allowed,
      reason: reasonFor(scan.verdict, violations.length, "warn") };
  }

  return { passed: false, action, verdict: scan.verdict, violations, allowed,
    reason: reasonFor(scan.verdict, violations.length, "fail") };
}

function reasonFor(verdict, count, action) {
  if (count === 0) {
    if (verdict === "COMPLIANT") return "No consent-requiring trackers fired before consent.";
    if (verdict === "INCONCLUSIVE") return "Banner could not be operated, but no in-scope trackers fired first.";
    return "No in-scope trackers fired before consent.";
  }
  const noun = `${count} consent-requiring ${count === 1 ? "tracker" : "trackers"}`;
  if (action === "warn") return `${noun} fired before consent (warning — not failing the build).`;
  if (verdict === "NO_BANNER_DETECTED") return `${noun} fired with no consent banner present.`;
  if (verdict === "INCONCLUSIVE") return `${noun} fired before a banner the scanner could not accept.`;
  return `${noun} fired before consent was given.`;
}
