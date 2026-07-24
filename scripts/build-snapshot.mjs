// Builds data/trackers.snapshot.json — the tracker database bundled into the
// package so a CI run needs no network and stays deterministic.
//
// Fetches DuckDuckGo Tracker Radar + Disconnect.me fresh, applies the same
// category mapping as weaveeye-api/src/updater.js, and writes a compact,
// sorted JSON. Run `npm run build:snapshot` to refresh it before a release.
//
// This is a build-time script — the shipped package never fetches anything.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../data/trackers.snapshot.json");

// DDG's domain_summary.json (used by the original weaveeye-api) carries no
// categories or owners — only prevalence stats — so DDG never actually
// contributed classifications there. Categories live in thousands of
// per-domain files, impractical to bundle. domain_map.json, however, gives us
// reliable ownership (parent company) for ~38k domains, which is real value
// for the report and for subdomain escalation.
//
// So: categories come from Disconnect (+ the curated map in the classifier),
// ownership is enriched from DDG.
const DDG_OWNERSHIP_URL = "https://raw.githubusercontent.com/duckduckgo/tracker-radar/main/build-data/generated/domain_map.json";
const DISC_URL = "https://raw.githubusercontent.com/disconnectme/disconnect-tracking-protection/master/services.json";

const DISC_CATEGORY_MAP = {
  "Advertising": "Advertising",
  "Analytics": "Analytics",
  "Social": "Social",
  "Content": "CDN",
  "Disconnect": "Infrastructure",
  "Email": "Infrastructure",
  "DataBroker": "Data Broker",
};

async function fetchJson(url, label) {
  process.stdout.write(`  fetching ${label}… `);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${label} fetch failed: ${resp.status}`);
  const json = await resp.json();
  console.log("ok");
  return json;
}

// Ownership only — { parent } with no category.
function parseDDGOwnership(raw) {
  const map = {};
  for (const [domain, data] of Object.entries(raw)) {
    const parent = data.displayName || data.entityName || null;
    if (parent) map[domain] = { category: null, parent };
  }
  return map;
}

// Disconnect's shape:
//   categories: { <CategoryName>: [ { <CompanyName>: { <url>: [<domain>, …] } }, … ] }
// Note each category maps to an ARRAY of single-key company objects — iterating
// it as a plain object gives numeric indices, which is exactly the bug that
// produced numeric "owners". Walk it as an array.
function parseDisconnect(raw) {
  const map = {};
  for (const [categoryName, companyArray] of Object.entries(raw.categories || {})) {
    if (!Array.isArray(companyArray)) continue;
    const category = DISC_CATEGORY_MAP[categoryName] || null;

    for (const companyEntry of companyArray) {
      for (const [companyName, urlMap] of Object.entries(companyEntry)) {
        const parent = companyName && companyName !== "0" ? companyName : null;
        for (const domainList of Object.values(urlMap)) {
          if (!Array.isArray(domainList)) continue;
          for (const domain of domainList) {
            const clean = String(domain).replace(/^https?:\/\//, "").replace(/\/$/, "");
            if (clean && !map[clean] && (category || parent)) {
              map[clean] = { category, parent };
            }
          }
        }
      }
    }
  }
  return map;
}

// Merge one source into the target: fill a missing category or parent without
// ever overwriting a value already set by a higher-priority source.
function mergeInto(target, source) {
  for (const [domain, info] of Object.entries(source)) {
    const existing = target[domain];
    if (!existing) { target[domain] = { ...info }; continue; }
    if (!existing.category && info.category) existing.category = info.category;
    if (!existing.parent && info.parent) existing.parent = info.parent;
  }
}

async function main() {
  console.log("Building tracker snapshot…");
  const [ddgRaw, discRaw] = await Promise.all([
    fetchJson(DDG_OWNERSHIP_URL, "DuckDuckGo ownership map"),
    fetchJson(DISC_URL, "Disconnect.me"),
  ]);

  const ddg = parseDDGOwnership(ddgRaw);
  const disc = parseDisconnect(discRaw);

  // Disconnect first (it has categories), then DDG fills ownership gaps.
  const merged = {};
  mergeInto(merged, disc);
  mergeInto(merged, ddg);

  // Sort keys so diffs between snapshots are readable.
  const sorted = {};
  for (const key of Object.keys(merged).sort()) sorted[key] = merged[key];

  const categorized = Object.values(sorted).filter(v => v.category).length;

  const payload = {
    generatedAt: new Date().toISOString(),
    sources: ["Disconnect.me (categories + ownership)", "DuckDuckGo Tracker Radar (ownership)"],
    count: Object.keys(sorted).length,
    categorized,
    domains: sorted,
  };

  await writeFile(OUT, JSON.stringify(payload));
  console.log(`  ${Object.keys(disc).length} Disconnect + ${Object.keys(ddg).length} DDG ownership`);
  console.log(`  wrote ${payload.count} domains (${categorized} categorized) → ${OUT}`);
}

main().catch(err => {
  console.error("snapshot build failed:", err.message);
  process.exit(1);
});
