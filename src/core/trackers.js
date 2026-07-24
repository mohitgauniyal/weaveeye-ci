// Loads the bundled tracker snapshot and exposes the same lookup surface the
// classifier expects. Unlike the server's updater.js this fetches nothing —
// the data ships with the package so a CI run is offline and deterministic.
//
// Refresh the snapshot with `npm run build:snapshot` before a release.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SNAPSHOT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../data/trackers.snapshot.json",
);

let trackerMap = {};
let meta = { generatedAt: null, count: 0, categorized: 0 };

try {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  trackerMap = snapshot.domains || {};
  meta = {
    generatedAt: snapshot.generatedAt || null,
    count: snapshot.count || Object.keys(trackerMap).length,
    categorized: snapshot.categorized || 0,
  };
} catch (err) {
  // Missing snapshot is not fatal — the curated map in the classifier still
  // classifies the high-value trackers. Warn once so a broken build is visible.
  console.warn(`[weaveeye] tracker snapshot unavailable (${err.code || err.message}); using curated map only`);
}

export function lookupTrackerExact(hostname) {
  return trackerMap[hostname.replace(/^www\./, "")] || null;
}

export function lookupTrackerRegistered(hostname) {
  const parts = hostname.replace(/^www\./, "").split(".");
  if (parts.length <= 2) return null;
  return trackerMap[parts.slice(-2).join(".")] || null;
}

export function snapshotMeta() {
  return { ...meta };
}

// Test seam, mirroring updater.js so the vendored classifier is unchanged.
export function setTrackerMap(map) {
  trackerMap = map;
}
