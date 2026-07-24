// GitHub Action entry point. Reads inputs from INPUT_* env vars (the composite
// action in action.yml maps them), runs the scan, evaluates it, writes outputs
// and a job summary, optionally upserts a PR comment, and exits with the gate's
// code so the build fails on a violation.
//
// Deliberately depends only on `fetch` for the GitHub API — no @actions/* or
// octokit — to keep the install light.

import { readFileSync, appendFileSync } from "node:fs";
import { consentScan } from "./core/scan.js";
import { loadPolicy, normalizePolicy, evaluate, DEFAULT_POLICY } from "./policy.js";
import { formatMarkdown, formatTerminal, formatJson } from "./report.js";

const COMMENT_MARKER = "<!-- weaveeye-ci -->";

function input(name) {
  const v = process.env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`];
  return v && v.trim() ? v.trim() : undefined;
}

function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${name}=${value}\n`);
}

function writeSummary(markdown) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, markdown + "\n");
}

function buildPolicy() {
  const path = input("policy");
  let policy = path ? loadPolicy(path) : { ...DEFAULT_POLICY, _source: "defaults" };
  const failOn = input("fail-on");
  const allow = input("allow");
  const inconclusive = input("inconclusive");
  return normalizePolicy({
    fail_on_categories: failOn ? failOn.split(",").map(s => s.trim()).filter(Boolean) : policy.failOnCategories,
    allow: [...policy.allow, ...(allow ? allow.split(",").map(s => s.trim()).filter(Boolean) : [])],
    verdicts: { ...policy.verdicts, ...(inconclusive ? { inconclusive } : {}) },
  }, policy._source);
}

// Find the PR number from the event payload, if this is a PR-triggered run.
function prNumber() {
  try {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    return event.pull_request?.number ?? event.issue?.number ?? null;
  } catch {
    return null;
  }
}

async function upsertComment(body) {
  const token = input("github-token");
  const repo = process.env.GITHUB_REPOSITORY;
  const pr = prNumber();
  if (!token || !repo || !pr) {
    console.log("… skipping PR comment (no token, repo or pull request context)");
    return;
  }

  const api = `https://api.github.com/repos/${repo}`;
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  const marked = `${COMMENT_MARKER}\n${body}`;

  try {
    // Reuse our own comment if present, so pushes update in place.
    const listed = await fetch(`${api}/issues/${pr}/comments?per_page=100`, { headers });
    if (listed.ok) {
      const comments = await listed.json();
      const mine = comments.find(c => c.body?.includes(COMMENT_MARKER));
      if (mine) {
        await fetch(`${api}/issues/comments/${mine.id}`, {
          method: "PATCH", headers, body: JSON.stringify({ body: marked }),
        });
        console.log("… updated existing PR comment");
        return;
      }
    }
    await fetch(`${api}/issues/${pr}/comments`, {
      method: "POST", headers, body: JSON.stringify({ body: marked }),
    });
    console.log("… posted PR comment");
  } catch (err) {
    console.log(`… could not post PR comment: ${err.message}`);
  }
}

async function main() {
  const url = input("url");
  if (!url) {
    console.error("Error: `url` input is required.");
    return 2;
  }

  let policy;
  try {
    policy = buildPolicy();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return 2;
  }

  let scan;
  try {
    scan = await consentScan(url, { onEvent: (phase) => console.log(`… ${phase}`) });
  } catch (err) {
    console.error(`Error: scan failed — ${err.message}`);
    return 2;
  }

  const result = evaluate(scan, policy);

  // Human-readable log (no colour — Actions logs handle their own).
  console.log(formatTerminal(scan, result, { color: false }));

  setOutput("passed", result.passed);
  setOutput("verdict", scan.verdict);
  setOutput("violations", result.violations.length);
  setOutput("json", encodeURIComponent(formatJson(scan, result)));

  const markdown = formatMarkdown(scan, result);
  writeSummary(markdown);

  if (input("comment") !== "false") {
    await upsertComment(markdown);
  }

  return result.passed ? 0 : 1;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error(`Fatal: ${err.stack || err.message}`);
    process.exit(2);
  });
