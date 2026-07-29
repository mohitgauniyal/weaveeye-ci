# weaveeye-ci

**Fail your build when a tracker fires before consent.**

A pre-consent tracking gate for CI. It loads your site in a real browser,
detects and accepts the consent banner, and records every third party that
fired **before** consent was given. If a consent-requiring tracker fired first,
the build fails — with a millisecond-timestamped list of exactly which ones and
who owns them.

This is the enforcement layer for the thing regulators and plaintiffs actually
go after: [pre-consent tracking](https://www.loeb.com/en/insights/publications/2026/04/the-millisecond-problem-how-pre-consent-tracking-is-driving-cipa-lawsuits-in-2026)
under GDPR/ePrivacy in the EU and CIPA-style wiretapping claims in the US. A
CMP tells you that you *have* a banner. This tells you whether the banner is
actually holding trackers back — and keeps the next deploy from silently
regressing it.

> **Two ways to use it, two names:** the CLI/npm package is **`weaveeye-scan`**
> (`npx weaveeye-scan …`); the GitHub Action lives in this repo and is used as
> **`mohitgauniyal/weaveeye-ci`**. The Action does not require the npm package.

---

## Quick start

```bash
npx weaveeye-scan https://staging.example.com
```

```
WEAVEEYE consent scan — example.com

✗ NON-COMPLIANT  3 third parties received data before consent was given.
CMP: OneTrust   consent accepted at 4.2s   14 before / 22 after

Data sent to third parties before consent:
  FIRED  CATEGORY     DOMAIN                          OWNER              DATA
  340ms  Advertising  securepubads.g.doubleclick.net  Google / Alphabet  269KB
  520ms  Analytics    static.chartbeat.com            Chartbeat          100KB
  890ms  Data Broker  api.rlcdn.com                   LiveRamp           —

  Classification: 100% of these domains identified from curated data or public
  tracker databases (Disconnect.me, DuckDuckGo). Unknown domains are never flagged.
```

`NON-COMPLIANT` means "does not pass the policy you configured" (e.g. nothing
before consent) — a check against your rule, not a legal ruling. See
[METHODOLOGY.md](METHODOLOGY.md) for exactly what is and isn't claimed.

Exit code is **0** if clean, **1** on a violation, **2** on an error — so it
drops straight into any pipeline.

---

## GitHub Action

```yaml
# .github/workflows/consent.yml
on: pull_request
permissions:
  contents: read
  pull-requests: write

jobs:
  consent:
    runs-on: ubuntu-latest
    steps:
      - uses: mohitgauniyal/weaveeye-ci@v0
        with:
          url: https://your-preview-deploy.example.com
```

On a pull request it posts (and updates in place) a comment with the verdict
and the full table of pre-consent trackers, and writes the same to the job
summary. See [`.github/workflows/example-consent-gate.yml`](.github/workflows/example-consent-gate.yml).

### Action inputs

| Input | Default | Description |
|---|---|---|
| `url` | — (required) | URL to scan — typically your preview deployment. |
| `policy` | auto | Path to a policy file. `.weaveeye.yml` is picked up automatically. |
| `fail-on` | `Advertising,Analytics,Data Broker` | Categories that fail the build. |
| `allow` | — | Comma-separated domains to exempt. |
| `inconclusive` | `warn` | Treat INCONCLUSIVE as `fail`, `warn`, or `pass`. |
| `comment` | `true` | Post/update a PR comment. |
| `github-token` | `${{ github.token }}` | Token used for the comment. |

Outputs: `passed`, `verdict`, `violations`.

---

## Policy

Drop a `.weaveeye.yml` at your repo root (see the annotated
[`.weaveeye.yml`](.weaveeye.yml) here). Everything is optional.

```yaml
fail_on_categories: [Advertising, Analytics, Data Broker]
allow:
  - onetrust.com          # exempt your CMP or anything with a lawful basis
verdicts:
  non_compliant: fail
  no_banner_detected: fail
  inconclusive: warn      # don't fail a build just because we couldn't click the banner
  compliant: pass
```

### Verdicts

| Verdict | Meaning | Default action |
|---|---|---|
| `COMPLIANT` | Banner accepted, nothing consent-requiring fired first. | pass |
| `NON_COMPLIANT` | Banner accepted, but trackers fired before it. | fail |
| `NO_BANNER_DETECTED` | No consent mechanism; trackers fired anyway. | fail |
| `INCONCLUSIVE` | A banner was present but couldn't be operated. | warn |

`INCONCLUSIVE` defaults to a warning on purpose: the scanner failing to click a
banner is not proof the *site* is broken, and a gate that fails on it would cry
wolf. Set it to `fail` once you trust detection on your stack.

---

## CLI

```
weaveeye-scan <url> [options]

  --policy <path>        Policy file (.yml/.yaml/.json). Default: .weaveeye.yml if present.
  --format <fmt>         terminal | json | markdown       (default: terminal)
  --output <path>        Also write the formatted report to a file.
  --json-out <path>      Write the machine-readable JSON result to a file.
  --allow <domains>      Comma-separated domains to exempt.
  --fail-on <categories> Comma-separated categories that fail the build.
  --inconclusive <act>   fail | warn | pass.
  --timeout <ms>         Navigation timeout (default: 30000).
  --no-color             Disable ANSI colour.
  --headful              Show the browser (debugging).
```

## Programmatic API

```js
import { consentScan, evaluate, loadPolicy } from "weaveeye-scan";

const scan = await consentScan("https://staging.example.com");
const result = evaluate(scan, loadPolicy(".weaveeye.yml"));
if (!result.passed) process.exit(1);
```

---

## How it works, and its limits

- **Real browser.** Playwright loads the page like a visitor would; it does not
  just parse HTML or read the cookie jar.
- **Before vs after.** Third parties are timestamped and split at the moment
  consent is accepted. The "before" set, filtered to consent-requiring
  categories, is the finding.
- **Ownership.** Trackers are attributed to their parent company using a
  bundled snapshot of Disconnect.me + DuckDuckGo Tracker Radar data plus a
  curated map. Regenerate it with `npm run build:snapshot`.

**Geography matters.** Consent banners are shown based on the visitor's region.
To meaningfully test EU behaviour the job must run from an EU IP; for US/CIPA,
a US IP. A runner in the wrong region will see `NO_BANNER_DETECTED` where a real
user sees a banner. Choose your runner region deliberately.

**This is not legal advice.** It reports what the browser did, with timestamps
and a traceable source for every domain flagged. Whether a given data flow is
lawful depends on the site's legal basis and jurisdiction — a call for your
counsel. The evidence is here to inform that, not replace it. Full details of
how classification works and what is and isn't claimed:
[METHODOLOGY.md](METHODOLOGY.md).

---

## Development

```bash
npm install
npx playwright install chromium
npm test                  # unit tests (node:test) — no browser or network
npm run build:snapshot    # refresh the bundled tracker data
node src/cli.js example.com
```

## License

MIT
