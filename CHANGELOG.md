# Changelog

## v0.1.0 — first release

Initial public release of **weaveeye-ci** — a pre-consent tracking gate for CI.

Loads a site in a real browser, detects and accepts the consent banner, and
records every third party that fired **before** consent. If a consent-requiring
tracker fired first, the build fails, with a millisecond-timestamped list of
which trackers and who owns them.

### Included

- **CLI** — `npx weaveeye-scan <url>`. Terminal / JSON / Markdown output.
  Exit codes: 0 pass, 1 violation, 2 error.
- **GitHub Action** — composite action that runs the gate, posts/updates a PR
  comment, writes a job summary, and exposes `passed` / `verdict` / `violations`
  outputs.
- **Programmatic API** — `import { consentScan, evaluate, loadPolicy } from "weaveeye-ci"`.
- **Policy** — `.weaveeye.yml`: fail-on categories, domain allowlist, and a
  per-verdict fail/warn/pass action. `INCONCLUSIVE` defaults to a warning.
- **Bundled tracker snapshot** — ~40k domains (Disconnect.me categories +
  DuckDuckGo Tracker Radar ownership). No network at runtime.

### Verdicts

| Verdict | Meaning | Default action |
|---|---|---|
| `COMPLIANT` | Banner accepted, nothing consent-requiring fired first. | pass |
| `NON_COMPLIANT` | Banner accepted, but trackers fired before it. | fail |
| `NO_BANNER_DETECTED` | No consent mechanism; trackers fired anyway. | fail |
| `INCONCLUSIVE` | A banner was present but couldn't be operated. | warn |

### Notes

- Consent banners are region-specific: run the scan from an IP in the
  jurisdiction you want to test (EU for GDPR, US for CIPA).
- Not legal advice — reports what the browser did, with timestamps.

71 tests.
