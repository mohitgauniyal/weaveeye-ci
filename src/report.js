// Report formatting: terminal (CI logs), JSON (artifact), Markdown (PR comment).
// The measurement lives in scan.js/policy.js — this module only renders it.

const ANSI = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};

const VERDICT_LABEL = {
  COMPLIANT: "COMPLIANT",
  NON_COMPLIANT: "NON-COMPLIANT",
  NO_BANNER_DETECTED: "NO CONSENT BANNER",
  INCONCLUSIVE: "INCONCLUSIVE",
};

function fmtMs(ms) {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function fmtBytes(b) {
  if (!b) return "—";
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)}MB`;
  if (b >= 1000) return `${Math.round(b / 1000)}KB`;
  return `${b}B`;
}

// How each classification was decided, grouped into a confidence story. Used to
// show that findings rest on data, not guesswork.
const STRONG_SOURCES = new Set([
  "curated-exact", "curated-registered", "trackerdb-exact", "trackerdb-registered", "suffix-rule",
]);

function provenanceSummary(violations) {
  if (!violations.length) return null;
  const strong = violations.filter(n => STRONG_SOURCES.has(n.source)).length;
  const pct = Math.round((strong / violations.length) * 100);
  const weak = violations.length - strong;
  return { pct, strong, weak };
}

// ── Terminal ─────────────────────────────────────────────────────────────────

export function formatTerminal(scan, result, { color = true } = {}) {
  const c = color ? ANSI : new Proxy({}, { get: () => "" });
  const lines = [];

  lines.push("");
  lines.push(`${c.bold}WEAVEEYE${c.reset} consent scan — ${c.cyan}${scan.hostname}${c.reset}`);
  lines.push(`${c.dim}${scan.url}${c.reset}`);
  lines.push("");

  const statusColor = result.passed
    ? (result.action === "warn" ? c.yellow : c.green)
    : c.red;
  const mark = result.passed ? (result.action === "warn" ? "!" : "✓") : "✗";
  lines.push(`${statusColor}${c.bold}${mark} ${VERDICT_LABEL[scan.verdict] || scan.verdict}${c.reset}  ${result.reason}`);

  const meta = [];
  if (scan.cmpName) meta.push(`CMP: ${scan.cmpName}`);
  if (scan.consentAccepted) meta.push(`consent accepted at ${fmtMs(scan.consentClickedAt)}`);
  meta.push(`${scan.before.count} before / ${scan.after.count} after`);
  lines.push(`${c.dim}${meta.join("   ")}${c.reset}`);

  if (scan.blocked) {
    lines.push(`${c.yellow}⚠ Scanner may have been blocked — ${scan.blockReason}. Result is unreliable.${c.reset}`);
  }

  if (result.violations.length) {
    lines.push("");
    lines.push(`${c.bold}Data sent to third parties before consent:${c.reset}`);
    const rows = result.violations.map(n => [
      fmtMs(n.time),
      n.category,
      n.id,
      n.parent || "—",
      fmtBytes(n.bytes),
    ]);
    lines.push(...renderTable(["FIRED", "CATEGORY", "DOMAIN", "OWNER", "DATA"], rows, c));
  }

  // Advisory: tags that loaded before consent but may be Consent-Mode-gated.
  const gated = scan.gatedTags?.count || 0;
  if (gated) {
    const names = scan.gatedTags.nodes.slice(0, 5).map(n => n.id).join(", ");
    lines.push("");
    lines.push(`${c.dim}Plus ${gated} tag${gated !== 1 ? "s" : ""} that loaded before consent but may be gated by Consent Mode (not counted as violations): ${names}${gated > 5 ? ", …" : ""}${c.reset}`);
  }

  const prov = provenanceSummary(result.violations);
  if (prov) {
    lines.push("");
    lines.push(`${c.dim}Classification: ${prov.pct}% of these domains identified from curated data or public tracker databases (Disconnect.me, DuckDuckGo)${prov.weak ? `, ${prov.weak} by hostname heuristic` : ""}. Unknown domains are never flagged.${c.reset}`);
  }

  if (result.allowed.length) {
    lines.push("");
    lines.push(`${c.dim}${result.allowed.length} allowlisted domain(s) suppressed: ${result.allowed.map(n => n.id).join(", ")}${c.reset}`);
  }

  lines.push("");
  return lines.join("\n");
}

function renderTable(headers, rows, c) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i]).length)));
  const line = cells => cells.map((cell, i) => String(cell).padEnd(widths[i])).join("  ");
  const out = [`${c.dim}${line(headers)}${c.reset}`];
  for (const row of rows) {
    const color = row[1] === "Data Broker" ? c.red : row[1] === "Advertising" ? c.red : c.yellow;
    out.push(`${color}${line(row)}${c.reset}`);
  }
  return out.map(l => "  " + l);
}

// ── JSON ─────────────────────────────────────────────────────────────────────

export function formatJson(scan, result) {
  return JSON.stringify({
    hostname: scan.hostname,
    url: scan.url,
    scannedAt: scan.scannedAt,
    verdict: scan.verdict,
    passed: result.passed,
    action: result.action,
    reason: result.reason,
    blocked: scan.blocked || false,
    blockReason: scan.blockReason || null,
    cmp: scan.cmpName,
    consentAccepted: scan.consentAccepted,
    counts: {
      before: scan.before.count,
      after: scan.after.count,
      violations: result.violations.length,
      gatedTags: scan.gatedTags?.count || 0,
      allowed: result.allowed.length,
    },
    violations: result.violations.map(n => ({
      domain: n.id, category: n.category, owner: n.parent || null,
      firedAtMs: n.time, bytes: n.bytes,
      classifiedBy: n.source, // provenance — how this domain was identified
    })),
  }, null, 2);
}

// ── Markdown (PR comment) ────────────────────────────────────────────────────

export function formatMarkdown(scan, result) {
  const icon = result.passed ? (result.action === "warn" ? "⚠️" : "✅") : "❌";
  const title = result.passed
    ? (result.action === "warn" ? "Consent check passed with warnings" : "Consent check passed")
    : "Consent check failed";

  const out = [];
  out.push(`### ${icon} ${title}`);
  out.push("");
  out.push(`**\`${scan.hostname}\`** — ${VERDICT_LABEL[scan.verdict] || scan.verdict}. ${result.reason}`);
  out.push("");
  if (scan.blocked) {
    out.push(`> ⚠️ The scanner may have been blocked (${scan.blockReason}). Treat this result as unreliable.`);
    out.push("");
  }

  const meta = [];
  if (scan.cmpName) meta.push(`CMP detected: **${scan.cmpName}**`);
  meta.push(`${scan.before.count} third parties before consent`);
  meta.push(`${scan.after.count} after`);
  out.push(meta.join(" · "));

  if (result.violations.length) {
    out.push("");
    out.push(`<details open><summary><b>${result.violations.length} third part${result.violations.length === 1 ? "y" : "ies"} received data before consent</b></summary>`);
    out.push("");
    out.push("| Fired at | Category | Domain | Owner | Data |");
    out.push("|---|---|---|---|---|");
    for (const n of result.violations) {
      out.push(`| ${fmtMs(n.time)} | ${n.category} | \`${n.id}\` | ${n.parent || "—"} | ${fmtBytes(n.bytes)} |`);
    }
    out.push("</details>");
  }

  const gated = scan.gatedTags?.count || 0;
  if (gated) {
    out.push("");
    out.push(`<sub>Plus ${gated} tag${gated !== 1 ? "s" : ""} that loaded before consent but may be gated by Consent Mode — not counted as violations.</sub>`);
  }

  if (result.allowed.length) {
    out.push("");
    out.push(`<sub>${result.allowed.length} allowlisted domain(s) suppressed: ${result.allowed.map(n => `\`${n.id}\``).join(", ")}</sub>`);
  }

  out.push("");
  out.push(`<sub>🕸 Scanned by weaveeye-ci at ${scan.scannedAt}</sub>`);
  return out.join("\n");
}
