#!/usr/bin/env node
// weaveeye-scan — command-line consent gate.
//
//   npx weaveeye-scan <url> [options]
//
// Exit codes:
//   0  passed (no violations, or warn-only)
//   1  failed (consent-requiring trackers fired before consent)
//   2  usage or runtime error (never conflated with a policy failure)

import { parseArgs } from "node:util";
import { existsSync, writeFileSync } from "node:fs";
import { consentScan } from "./core/scan.js";
import { loadPolicy, normalizePolicy, evaluate, DEFAULT_POLICY } from "./policy.js";
import { formatTerminal, formatJson, formatMarkdown } from "./report.js";
import { snapshotMeta } from "./core/trackers.js";

const EXIT_OK = 0, EXIT_VIOLATION = 1, EXIT_ERROR = 2;

const HELP = `
weaveeye-scan — fail your build when a tracker fires before consent

Usage:
  weaveeye-scan <url> [options]

Options:
  --policy <path>        Policy file (.yml/.yaml/.json). Default: .weaveeye.yml if present.
  --format <fmt>         terminal | json | markdown          (default: terminal)
  --output <path>        Write the formatted report to a file as well.
  --json-out <path>      Write the machine-readable JSON result to a file.
  --allow <domains>      Comma-separated domains to exempt (added to the policy).
  --fail-on <categories> Comma-separated categories that fail the build (overrides policy).
  --inconclusive <act>   How to treat INCONCLUSIVE: fail | warn | pass.
  --timeout <ms>         Navigation timeout (default: 30000).
  --no-color             Disable ANSI colour.
  --headful              Show the browser (debugging).
  --version              Print version.
  -h, --help             This help.

Examples:
  weaveeye-scan https://staging.example.com
  weaveeye-scan example.com --format markdown --output comment.md
  weaveeye-scan example.com --allow onetrust.com,cookielaw.org --inconclusive fail
`;

function parse(argv) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      policy: { type: "string" },
      format: { type: "string", default: "terminal" },
      output: { type: "string" },
      "json-out": { type: "string" },
      allow: { type: "string" },
      "fail-on": { type: "string" },
      inconclusive: { type: "string" },
      timeout: { type: "string" },
      // parseArgs has no built-in boolean negation, so --no-color is its own flag.
      "no-color": { type: "boolean", default: false },
      headful: { type: "boolean", default: false },
      version: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
}

async function main() {
  let parsed;
  try {
    parsed = parse(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n${HELP}`);
    return EXIT_ERROR;
  }
  const { values, positionals } = parsed;

  if (values.help) { process.stdout.write(HELP); return EXIT_OK; }
  if (values.version) {
    const meta = snapshotMeta();
    process.stdout.write(`weaveeye-scan (tracker snapshot: ${meta.count} domains, ${meta.generatedAt || "unbundled"})\n`);
    return EXIT_OK;
  }

  const url = positionals[0];
  if (!url) {
    process.stderr.write(`Error: a URL is required.\n${HELP}`);
    return EXIT_ERROR;
  }

  if (!["terminal", "json", "markdown"].includes(values.format)) {
    process.stderr.write(`Error: unknown --format "${values.format}". Use terminal, json or markdown.\n`);
    return EXIT_ERROR;
  }

  // Build the effective policy: file (or defaults), then CLI overrides.
  let policy;
  try {
    const policyPath = values.policy || (existsSync(".weaveeye.yml") ? ".weaveeye.yml"
      : existsSync(".weaveeye.yaml") ? ".weaveeye.yaml"
      : existsSync(".weaveeye.json") ? ".weaveeye.json" : null);
    policy = policyPath ? loadPolicy(policyPath) : { ...DEFAULT_POLICY, _source: "defaults" };
    policy = applyOverrides(policy, values);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    return EXIT_ERROR;
  }

  const isTty = values.format === "terminal";
  let scan;
  try {
    scan = await consentScan(url, {
      timeout: values.timeout ? parseInt(values.timeout) : undefined,
      headless: !values.headful,
      onEvent: isTty ? (phase) => process.stderr.write(`  … ${phase}\n`) : null,
    });
  } catch (err) {
    process.stderr.write(`Error: scan failed — ${err.message}\n`);
    return EXIT_ERROR;
  }

  const result = evaluate(scan, policy);

  const rendered =
    values.format === "json" ? formatJson(scan, result)
    : values.format === "markdown" ? formatMarkdown(scan, result)
    : formatTerminal(scan, result, { color: !values["no-color"] && process.stdout.isTTY });

  process.stdout.write(rendered + "\n");

  if (values.output) writeFileSync(values.output, rendered);
  if (values["json-out"]) writeFileSync(values["json-out"], formatJson(scan, result));

  return result.passed ? EXIT_OK : EXIT_VIOLATION;
}

function applyOverrides(policy, values) {
  const next = normalizePolicy({
    fail_on_categories: values["fail-on"]
      ? values["fail-on"].split(",").map(s => s.trim()).filter(Boolean)
      : policy.failOnCategories,
    allow: [
      ...policy.allow,
      ...(values.allow ? values.allow.split(",").map(s => s.trim()).filter(Boolean) : []),
    ],
    verdicts: {
      ...policy.verdicts,
      ...(values.inconclusive ? { inconclusive: values.inconclusive } : {}),
    },
  }, policy._source);
  return next;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    process.stderr.write(`Fatal: ${err.stack || err.message}\n`);
    process.exit(EXIT_ERROR);
  });
