// Programmatic API for weaveeye-ci.
//
//   import { consentScan, evaluate, loadPolicy } from "weaveeye-ci";
//   const scan = await consentScan("https://staging.example.com");
//   const result = evaluate(scan, loadPolicy(".weaveeye.yml"));
//   if (!result.passed) process.exit(1);

export { consentScan } from "./core/scan.js";
export { classifyDomain } from "./core/classifier.js";
export { snapshotMeta } from "./core/trackers.js";
export {
  loadPolicy, normalizePolicy, evaluate, isAllowed, DEFAULT_POLICY,
} from "./policy.js";
export { formatTerminal, formatJson, formatMarkdown } from "./report.js";
export { VERDICTS, CONSENT_REQUIRED_CATEGORIES } from "./core/verdict.js";
