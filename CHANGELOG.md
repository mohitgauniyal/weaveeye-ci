# Changelog

## v0.3.0

- **Provenance for every finding.** Each flagged domain now records how it was
  classified (curated map / public tracker database / heuristic), exposed as
   in JSON and summarised in reports. On a representative site
  ~98% of findings come from data, ~2% from heuristics; unknown domains are
  never flagged (the tool under-reports rather than over-accuses).
- **Honest framing.** Output wording scoped to observable facts ("received data
  before consent") rather than legal conclusions. Added METHODOLOGY.md
  documenting exactly what is and is not claimed, and what NON_COMPLIANT means
  (fails your configured policy, not a legal ruling).

## v0.2.0

- **Distinguish confirmed data transfers from Consent-Mode-gated tags.** The
  gate now fails only on third parties that actually received data before
  consent — ad exchanges/data brokers (which Consent Mode never gates), or any
  tag that sent a pixel/beacon/XHR. A tag that merely loaded a script before
  consent (e.g. googletagmanager.com, which Consent Mode can hold in a denied
  state) is reported separately as an advisory "gated tag", not a violation.
  This neutralizes the main technical objection and removes false positives
  (e.g. a site whose only pre-consent tag is a gated GTM is now COMPLIANT).

## v0.1.2

- **Blocked scans are never a confident verdict.** A scan served a bot-wall
  challenge no longer returns pass/fail from unreliable data — it reports a
  distinct `blocked` outcome that does not break the build.

## v0.1.1

- **Surface lazy-loaded trackers.** Every scan path now scrolls and settles, so
  ad/tracker scripts that load on scroll or idle are captured. Previously only
  the post-consent path scrolled, undercounting sites with no banner.
- **Detect bot walls.** Pages served an anti-automation challenge (Cloudflare,
  PerimeterX/HUMAN, DataDome, Incapsula) or a near-empty body are now flagged
  `blocked`, so a scan the site blocked is never reported as a clean pass.
  Reflected in all report formats and the JSON output.

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
