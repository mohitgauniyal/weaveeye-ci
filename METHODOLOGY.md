# How WEAVEEYE measures, and what it does (and does not) claim

This document exists so that every number the tool reports can be traced to how
it was produced. If we are going to tell someone a tracker fired before consent,
we should be able to show our work.

## What we measure — an observable fact

WEAVEEYE loads a page in a real browser (Chromium via Playwright), records every
network request, detects and accepts the consent banner, and notes which
third parties **received data before consent was accepted**.

The finding is a fact about what the browser did:

> A request carrying data was sent to `doubleclick.net` at 340 ms, before the
> consent banner was accepted at 7,752 ms.

That is all we assert. We do **not** claim a site is "illegal," "non-compliant
with the law," or "in breach of GDPR/CIPA." Whether a given data flow is lawful
depends on the site's legal basis, its jurisdiction, its server-side consent
handling, and facts we cannot observe from the outside. Those are questions for
the site's own counsel. We provide the evidence, not the verdict.

(The word "NON_COMPLIANT" in the CI tool means "non-compliant **with the policy
you configured**" — e.g. a policy that says nothing should fire before consent.
That is a check against your own rule, not a legal determination.)

## What counts as a "confirmed data transfer"

Not every request is counted. A finding must be **consent-requiring** *and* a
**real data transfer**:

- **Consent-requiring categories:** Advertising, Analytics, Data Broker. We do
  not count CDNs, fonts, payment processors, security/bot-defense, the consent
  platform itself, or first-party subdomains.
- **Real data transfer, not just a script load.** A finding is confirmed when
  either:
  - the third party is an **ad exchange or data broker** — a request to one
    transmits the user's cookies and is not covered by Google Consent Mode; or
  - the third party **received a data-carrying request** (a pixel, beacon,
    XHR/fetch, or POST) before consent — i.e. data actually left the browser.

A consent-requiring **tag that only loaded a script** before consent (for
example `googletagmanager.com`) is **not** counted as a violation. Under Google
Consent Mode a tag can load but withhold data until consent, so we report these
separately as advisory "gated tags."

## How we classify a domain — and how sure we are

Each third-party host is classified in this order, strongest source first:

| Order | Source | Confidence |
|---|---|---|
| 1 | Hand-curated map (exact host) | Very high |
| 2 | Public tracker database — exact host (Disconnect.me, DuckDuckGo Tracker Radar) | High |
| 3 | Hand-curated map (registered domain) | Very high |
| 4 | Public tracker database — registered domain | High |
| 5 | Curated suffix rule | High |
| 6 | Subdomain-label heuristic (e.g. `ads.`, `pixel.`, `sync.`) | Medium |
| 7 | Keyword-in-hostname heuristic | Low |
| 8 | Nothing matched → **Infrastructure, never flagged** | — |

Every flagged domain carries the source that decided it (`classifiedBy` in the
JSON output), so any finding can be audited.

**In practice this is overwhelmingly data-backed.** On a representative
tracker-heavy site (theverge.com, 106 confirmed transfers), the breakdown was:

- ~49% curated map, ~49% public tracker database → **~98% from data**
- ~2% from hostname heuristics

**The safety property that matters most:** a domain we do not recognise defaults
to "Infrastructure" and is **never counted**. So the tool **under-reports rather
than over-accuses.** If we are wrong, we miss a tracker — we do not invent one.

Classification data is refreshed from Disconnect.me and DuckDuckGo Tracker Radar
via `npm run build:snapshot`.

## Geography

Consent banners are shown based on the visitor's region. A scan run from outside
the EU will not see an EU-only banner, and a scan of a US site reflects what a US
visitor sees. Run scans from an IP in the jurisdiction you are assessing. A
result can vary between runs when a site changes what it shows by region or over
time; we treat banner display as observed, not assumed.

## Known limits

- **Bot walls.** Some sites serve automated browsers a challenge page
  (Cloudflare, PerimeterX/HUMAN, DataDome, Incapsula). We detect this and mark
  the scan `blocked` — a blocked scan is never reported as clean or as a
  violation, because we did not see the real page.
- **One page load.** We scan the landing page after scroll; behaviour behind
  logins, on other routes, or after specific interactions is out of scope.
- **Classification is not perfect.** The public databases can be stale or wrong
  for the long tail; the provenance field lets you check any single finding.

## In one sentence

We report, with timestamps and a traceable source for every domain, what data a
site sent to third parties before consent — an observable fact, offered as
evidence, not as a legal conclusion.
