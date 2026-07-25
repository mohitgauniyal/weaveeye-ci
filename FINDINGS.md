# What we found: consent banners that don't hold trackers back

A short, honest write-up of a scan we ran with [weaveeye-ci](https://github.com/mohitgauniyal/weaveeye-ci).
Read the [methodology](METHODOLOGY.md) for exactly how these numbers were produced
and what they do and don't claim.

## The headline

In a sample of **12 major US sites that show a named consent banner**
(OneTrust / TrustArc), **11 sent data to third-party advertising networks or
data brokers *before* the user consented** — even though the banner was present
and we accepted it.

That is **11 of 12** — and the one exception only loaded a tag that Google
Consent Mode may hold in a "denied" state, so it is honestly a pass.

These are not sites without a consent banner. They *bought* a consent platform.
The banner is there; it just isn't stopping the trackers.

## What "sent data before consent" means

For each site we loaded the page in a real browser, waited, accepted the consent
banner, and recorded which third parties **received a data-carrying request**
(a pixel, beacon, XHR, or a request to an ad exchange) **before** the moment we
accepted consent. We count only advertising, analytics, and data-broker
third parties — not CDNs, fonts, or the consent platform itself — and only when
data actually went out, not when a tag merely loaded a script that Consent Mode
might be gating. Full rules in the [methodology](METHODOLOGY.md).

## The magnitudes

Among the sites that leaked, the number of third parties receiving data before
consent ranged widely:

- a major US technology-news publisher — **106** third parties
- a general-interest news/opinion site — **53**
- a business-technology publisher — **49**
- a consumer-health information site — **42**
- a widely-used e-signature service — **33**, including social-ad pixels
- a Fortune-500 pharmaceutical company — confirmed ad-serving before consent

(Sites are described rather than named: this is aggregate research, not an
accusation against any specific company. If you run the tool on your own site,
you get your own named result.)

## How confident are we in the classifications?

On the heaviest site (106 findings), ~98% of the flagged domains were identified
from a hand-curated list or public tracker databases (Disconnect.me, DuckDuckGo
Tracker Radar); ~2% from hostname heuristics. Every finding carries its source,
so any single one can be checked. Domains we don't recognise are never flagged —
the tool under-reports rather than over-accuses.

## Honest limits of this sample

- **Small and non-random.** 12 sites chosen because they run a visible named
  CMP — a convenience sample, illustrative, not a statistical estimate of the
  whole web.
- **One vantage point, one moment.** Consent banners vary by region and change
  over time; a site's result can differ between runs.
- **Not a legal finding.** We report what the browser did. Whether a given data
  flow is lawful depends on the site's legal basis and jurisdiction — a question
  for their counsel, not for us.

## The point

If a site with a paid consent platform still leaks trackers before consent, the
gap is almost always a deploy that added a tag ahead of the consent check — and
it will keep happening on the next deploy unless something catches it. That is
what [weaveeye-ci](https://github.com/mohitgauniyal/weaveeye-ci) does: it runs in
CI and fails the build when a third party receives data before consent.
