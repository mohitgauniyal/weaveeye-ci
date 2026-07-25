// Domain classifier
// Sources: Disconnect.me, DuckDuckGo Tracker Radar, manual curation

const EXACT = {
  // Google
  "google-analytics.com": { category: "Analytics", parent: "Google / Alphabet" },
  "googletagmanager.com": { category: "Analytics", parent: "Google / Alphabet" },
  "doubleclick.net": { category: "Advertising", parent: "Google / Alphabet" },
  "googlesyndication.com": { category: "Advertising", parent: "Google / Alphabet" },
  "googleadservices.com": { category: "Advertising", parent: "Google / Alphabet" },
  "googleapis.com": { category: "Infrastructure", parent: "Google / Alphabet" },
  "gstatic.com": { category: "CDN", parent: "Google / Alphabet" },
  "google.com": { category: "Infrastructure", parent: "Google / Alphabet" },
  "recaptcha.net": { category: "Security", parent: "Google / Alphabet" },
  "youtube.com": { category: "Video", parent: "Google / Alphabet" },
  "ytimg.com": { category: "CDN", parent: "Google / Alphabet" },
  "ggpht.com": { category: "CDN", parent: "Google / Alphabet" },

  // Meta
  "facebook.net": { category: "Advertising", parent: "Meta" },
  "facebook.com": { category: "CDN", parent: "Meta" },
  "fbcdn.net": { category: "CDN", parent: "Meta" },
  "fb.com": { category: "Infrastructure", parent: "Meta" },
  "instagram.com": { category: "Social", parent: "Meta" },
  "whatsapp.com": { category: "Social", parent: "Meta" },
  "cdninstagram.com": { category: "CDN", parent: "Meta" },

  // Amazon
  "amazon-adsystem.com": { category: "Advertising", parent: "Amazon" },
  "cloudfront.net": { category: "CDN", parent: "Amazon" },
  "amazonaws.com": { category: "Infrastructure", parent: "Amazon" },
  "awsstatic.com": { category: "CDN", parent: "Amazon" },

  // Cloudflare
  "cloudflare.com": { category: "CDN", parent: "Cloudflare" },
  "cloudflareinsights.com": { category: "Analytics", parent: "Cloudflare" },
  "cfcdn.net": { category: "CDN", parent: "Cloudflare" },

  // Akamai
  "akamai.net": { category: "CDN", parent: "Akamai" },
  "akamaized.net": { category: "CDN", parent: "Akamai" },
  "akamaicdn.net": { category: "CDN", parent: "Akamai" },
  "edgesuite.net": { category: "CDN", parent: "Akamai" },
  "akamaihd.net": { category: "CDN", parent: "Akamai" },

  // Analytics
  "chartbeat.com": { category: "Analytics", parent: "Chartbeat" },
  "parsely.com": { category: "Analytics", parent: "Automattic" },
  "newrelic.com": { category: "Analytics", parent: "New Relic" },
  "nr-data.net": { category: "Analytics", parent: "New Relic" },
  "hotjar.com": { category: "Analytics", parent: "Hotjar" },
  "sentry.io": { category: "Analytics", parent: "Sentry" },
  "statsig.com": { category: "Analytics", parent: "Statsig" },
  "intercom.io": { category: "Analytics", parent: "Intercom" },
  "intercomcdn.com": { category: "CDN", parent: "Intercom" },
  "mixpanel.com": { category: "Analytics", parent: "Mixpanel" },
  "amplitude.com": { category: "Analytics", parent: "Amplitude" },
  "segment.io": { category: "Analytics", parent: "Twilio Segment" },
  "segment.com": { category: "Analytics", parent: "Twilio Segment" },
  "fullstory.com": { category: "Analytics", parent: "FullStory" },
  "heap.io": { category: "Analytics", parent: "Heap" },
  "logrocket.com": { category: "Analytics", parent: "LogRocket" },
  "clarity.ms": { category: "Analytics", parent: "Microsoft" },

  // Data brokers
  "krxd.net": { category: "Data Broker", parent: "Salesforce" },
  "lotame.com": { category: "Data Broker", parent: "Lotame" },
  "liveramp.com": { category: "Data Broker", parent: "LiveRamp" },
  "bluekai.com": { category: "Data Broker", parent: "Oracle" },
  "addthis.com": { category: "Data Broker", parent: "Oracle" },
  "moatads.com": { category: "Analytics", parent: "Oracle" },
  "demdex.net": { category: "Data Broker", parent: "Adobe" },
  "everesttech.net": { category: "Data Broker", parent: "Adobe" },
  "quantserve.com": { category: "Data Broker", parent: "Quantcast" },
  "quantcount.com": { category: "Analytics", parent: "Quantcast" },
  "scorecardresearch.com": { category: "Analytics", parent: "Comscore" },
  "comscore.com": { category: "Analytics", parent: "Comscore" },
  "nielsen.com": { category: "Analytics", parent: "Nielsen" },
  "exelator.com": { category: "Data Broker", parent: "Nielsen" },

  // Advertising
  "taboola.com": { category: "Advertising", parent: "Taboola" },
  "outbrain.com": { category: "Advertising", parent: "Outbrain" },
  "criteo.com": { category: "Advertising", parent: "Criteo" },
  "criteo.net": { category: "Advertising", parent: "Criteo" },
  "pubmatic.com": { category: "Advertising", parent: "PubMatic" },
  "rubiconproject.com": { category: "Advertising", parent: "Magnite" },
  "openx.net": { category: "Advertising", parent: "OpenX" },
  "casalemedia.com": { category: "Advertising", parent: "Index Exchange" },
  "indexww.com": { category: "Advertising", parent: "Index Exchange" },
  "33across.com": { category: "Advertising", parent: "33Across" },
  "spotxchange.com": { category: "Advertising", parent: "Magnite" },
  "sharethrough.com": { category: "Advertising", parent: "Sharethrough" },
  "adsrvr.org": { category: "Advertising", parent: "The Trade Desk" },
  "adnxs.com": { category: "Advertising", parent: "Microsoft/Xandr" },
  "appnexus.com": { category: "Advertising", parent: "Microsoft/Xandr" },
  "advertising.com": { category: "Advertising", parent: "Yahoo" },
  "yahoo.com": { category: "Advertising", parent: "Yahoo" },
  "yimg.com": { category: "CDN", parent: "Yahoo" },
  "zemanta.com": { category: "Advertising", parent: "Outbrain" },
  "bidswitch.net": { category: "Advertising", parent: "IPONWEB" },
  "amazon.com": { category: "Infrastructure", parent: "Amazon" },

  // Social
  "twitter.com": { category: "Social", parent: "X Corp" },
  "t.co": { category: "Social", parent: "X Corp" },
  "twimg.com": { category: "CDN", parent: "X Corp" },
  "linkedin.com": { category: "Social", parent: "Microsoft" },
  "licdn.com": { category: "CDN", parent: "Microsoft" },
  "pinterest.com": { category: "Social", parent: "Pinterest" },
  "pinimg.com": { category: "CDN", parent: "Pinterest" },
  "tiktok.com": { category: "Social", parent: "ByteDance" },
  "tiktokcdn.com": { category: "CDN", parent: "ByteDance" },
  "reddit.com": { category: "Social", parent: "Reddit" },
  "redd.it": { category: "CDN", parent: "Reddit" },
  "snapchat.com": { category: "Social", parent: "Snap" },
  "spotify.com": { category: "Social", parent: "Spotify" },

  // Fonts & Media
  "typekit.net": { category: "Fonts", parent: "Adobe" },
  "adobe.com": { category: "Infrastructure", parent: "Adobe" },
  "fonts.googleapis.com": { category: "Fonts", parent: "Google / Alphabet" },
  "fonts.gstatic.com": { category: "Fonts", parent: "Google / Alphabet" },
  "use.typekit.net": { category: "Fonts", parent: "Adobe" },
  "p.typekit.net": { category: "Fonts", parent: "Adobe" },
  "jwplayer.com": { category: "Video", parent: "LiquidX" },
  "jwpcdn.com": { category: "CDN", parent: "LiquidX" },
  "brightcove.com": { category: "Video", parent: "Brightcove" },
  "brightcove.net": { category: "CDN", parent: "Brightcove" },
  "vimeo.com": { category: "Video", parent: "Vimeo" },
  "vimeocdn.com": { category: "CDN", parent: "Vimeo" },

  // CDNs
  "fastly.net": { category: "CDN", parent: "Fastly" },
  "fastly.com": { category: "CDN", parent: "Fastly" },
  "stackpathcdn.com": { category: "CDN", parent: "StackPath" },
  "bootstrapcdn.com": { category: "CDN", parent: "StackPath" },
  "jsdelivr.net": { category: "CDN", parent: "jsDelivr" },
  "unpkg.com": { category: "CDN", parent: "Cloudflare" },
  "cdnjs.cloudflare.com": { category: "CDN", parent: "Cloudflare" },
  "wp.com": { category: "CDN", parent: "Automattic" },

  // Security / Auth
  "hcaptcha.com": { category: "Security", parent: "Intuition Machines" },
  "akismet.com": { category: "Security", parent: "Automattic" },
  // NB: recaptcha.net and cloudflareinsights.com are defined above.
  // cloudflareinsights.com is Analytics, not Security — it reports visitor
  // data back to Cloudflare, so it requires consent.

  // Payment
  "stripe.com": { category: "Payment", parent: "Stripe" },
  "js.stripe.com": { category: "Payment", parent: "Stripe" },
  "paypal.com": { category: "Payment", parent: "PayPal" },
  "paypalobjects.com": { category: "CDN", parent: "PayPal" },
  "braintreegateway.com": { category: "Payment", parent: "PayPal" },

  "github.githubassets.com": { category: "CDN", parent: "Microsoft" },
  "avatars.githubusercontent.com": { category: "CDN", parent: "Microsoft" },
  "images.ctfassets.net": { category: "CDN", parent: "Contentful" },
  "ctfassets.net": { category: "CDN", parent: "Contentful" },
  "alive.github.com": { category: "Infrastructure", parent: "Microsoft" },
  "copilot.github.com": { category: "Infrastructure", parent: "Microsoft" },
  "collector.github.com": { category: "Analytics", parent: "Microsoft" },
  "api.github.com": { category: "Infrastructure", parent: "Microsoft" },

  // Ad tech
  // Tracking endpoints whose leftmost label gives no hint, so the general
  // escalation rule cannot reach them. Verified by hand.
  "snap.licdn.com": { category: "Advertising", parent: "Microsoft" },
  "bing.com": { category: "Infrastructure", parent: "Microsoft" },
  "ampproject.org": { category: "CDN", parent: "Google / Alphabet" },
  "branch.io": { category: "Analytics", parent: "Branch Metrics" },
  "app-measurement.com": { category: "Analytics", parent: "Google / Alphabet" },

  "media.net": { category: "Advertising", parent: "Media.net" },
  "datadoghq-browser-agent.com": { category: "Analytics", parent: "Datadog" },
  "datadoghq.com": { category: "Analytics", parent: "Datadog" },
  "geoedge.be": { category: "Security", parent: "GeoEdge" },
  "3lift.com": { category: "Advertising", parent: "TripleLift" },
  "rfihub.com": { category: "Data Broker", parent: "Resonate" },
  "contextweb.com": { category: "Advertising", parent: "Pulsepoint" },
  "deepintent.com": { category: "Advertising", parent: "DeepIntent" },
  "mfadsrvr.com": { category: "Advertising", parent: "Media Force" },
  "1rx.io": { category: "Advertising", parent: "1RX" },
  "ladsp.com": { category: "Advertising", parent: "LA DSP" },
  "liadm.com": { category: "Advertising", parent: "LiveIntent" },
  "bidr.io": { category: "Advertising", parent: "Beeswax" },
  "adroll.com": { category: "Advertising", parent: "AdRoll" },
  "sportradarserving.com": { category: "Advertising", parent: "Sportradar" },
  "lijit.com": { category: "Advertising", parent: "Sovrn" },
  "stackadapt.com": { category: "Advertising", parent: "StackAdapt" },
  "tapad.com": { category: "Data Broker", parent: "Tapad" },
  "rlcdn.com": { category: "Data Broker", parent: "LiveRamp" },
  "pippio.com": { category: "Data Broker", parent: "LiveRamp" },
  "primis.tech": { category: "Advertising", parent: "Primis" },
  "dotomi.com": { category: "Advertising", parent: "Conversant" },
  "turn.com": { category: "Data Broker", parent: "Amobee" },
  "creativecdn.com": { category: "CDN", parent: "RTB House" },
  "unrulymedia.com": { category: "Advertising", parent: "Tremor International" },
};

// ── Consent Management Platforms ─────────────────────────────────────────────
// These load before consent by necessity — they ARE the consent mechanism.
// They must never appear in pre-consent findings, or every site with a working
// cookie banner reads as non-compliant.
const CMP_DOMAINS = {
  "cookielaw.org": "OneTrust",
  "onetrust.com": "OneTrust",
  "cookiebot.com": "Usercentrics",
  "usercentrics.eu": "Usercentrics",
  "consensu.org": "IAB Europe",
  "didomi.io": "Didomi",
  "trustarc.com": "TrustArc",
  "truste.com": "TrustArc",
  "osano.com": "Osano",
  "cookieyes.com": "CookieYes",
  "iubenda.com": "iubenda",
  "privacy-mgmt.com": "Sourcepoint",
  "ethyca.com": "Ethyca (Fides)",
  "civiccomputing.com": "Civic",
  "termly.io": "Termly",
};

for (const [domain, parent] of Object.entries(CMP_DOMAINS)) {
  EXACT[domain] = { category: "Consent", parent };
}

// ── Tracking subdomains on otherwise-benign parents ──────────────────────────
// The generated tracker lists are keyed mostly by registered domain, so a
// tracking endpoint inherits its parent's classification: bat.bing.com became
// "Infrastructure", px.ads.linkedin.com became "Social". Both are consent-
// requiring tracking endpoints. This escalates them by leftmost label.
//
// The rule only ever escalates out of a benign category — it never downgrades
// anything, and never touches a domain that a curated map already classified
// as tracking. A false positive here is visible and correctable; a false
// negative is invisible and is what gets a customer sued.
const TRACKING_LABELS = {
  adservice: "Advertising", ads: "Advertising", adserver: "Advertising",
  adsystem: "Advertising", bat: "Advertising", bid: "Advertising",
  match: "Advertising", pixel: "Advertising", px: "Advertising",
  rtb: "Advertising", sync: "Advertising", track: "Advertising",
  tracker: "Advertising", tracking: "Advertising",

  analytics: "Analytics", beacon: "Analytics", collect: "Analytics",
  collector: "Analytics", insight: "Analytics", insights: "Analytics",
  metrics: "Analytics", stats: "Analytics", tag: "Analytics",
  telemetry: "Analytics",
};

// Categories weak enough that a tracking-intent label should override them.
const ESCALATABLE = new Set(["Infrastructure", "CDN", "Social", "Fonts", "Video"]);

// Suffix-based fallback rules — covers subdomains and unknown CDNs
const SUFFIX_RULES = [
  [".googlesyndication.com", { category: "Advertising", parent: "Google / Alphabet" }],
  [".doubleclick.net", { category: "Advertising", parent: "Google / Alphabet" }],
  [".google.com", { category: "Infrastructure", parent: "Google / Alphabet" }],
  [".googleapis.com", { category: "Infrastructure", parent: "Google / Alphabet" }],
  [".gstatic.com", { category: "CDN", parent: "Google / Alphabet" }],
  [".fbcdn.net", { category: "CDN", parent: "Meta" }],
  [".facebook.com", { category: "Infrastructure", parent: "Meta" }],
  [".cloudfront.net", { category: "CDN", parent: "Amazon" }],
  [".amazonaws.com", { category: "Infrastructure", parent: "Amazon" }],
  [".akamaized.net", { category: "CDN", parent: "Akamai" }],
  [".fastly.net", { category: "CDN", parent: "Fastly" }],
  [".cloudflare.com", { category: "CDN", parent: "Cloudflare" }],
];


import { lookupTrackerExact, lookupTrackerRegistered } from "./trackers.js";

// Last-resort keyword matching. Only consulted when nothing else knows the
// domain, because it is by far the weakest signal here.
function heuristic(h) {
  if (h.includes("analytics") || h.includes("tracking") || h.includes("telemetry"))
    return { category: "Analytics", parent: null };
  if (h.includes("ads") || h.includes("adserver") || h.includes("advertising"))
    return { category: "Advertising", parent: null };
  if (h.includes("cdn") || h.includes("static") || h.includes("assets"))
    return { category: "CDN", parent: null };
  if (h.includes("pay") || h.includes("checkout"))
    return { category: "Payment", parent: null };
  return null;
}

function suffixRule(h) {
  for (const [suffix, info] of SUFFIX_RULES) {
    if (h.endsWith(suffix) || h === suffix.slice(1)) return info;
  }
  return null;
}

/**
 * Resolve a hostname to { category, parent }.
 *
 * Order is "most specific wins, and at equal specificity hand-curation beats
 * the generated tracker lists":
 *
 *   1. EXACT[host]                hand-curated, exact host
 *   2. tracker DB [host]          generated (DDG + Disconnect), exact host
 *   3. EXACT[registered]          hand-curated, registered domain
 *   4. tracker DB [registered]    generated, registered domain
 *   5. SUFFIX_RULES               hand-curated, broad suffix
 *   6. keyword heuristics         last resort
 *
 * Placing exact-host lookups above registered-domain lookups is the point of
 * this ordering: it stops adservice.google.com from inheriting google.com's
 * "Infrastructure" classification and being under-reported as non-tracking.
 *
 * A rule that supplies a parent but no category (an unmapped tracker-list
 * category) contributes its parent and defers the category to the next rule.
 */
export function classifyDomain(hostname) {
  const { category, parent } = classifyWithSource(hostname);
  return { category, parent };
}

// Like classifyDomain, but also reports WHICH rule decided the category — the
// provenance. Used for transparency ("why was this flagged?") and for auditing
// how much of a result rests on strong data sources vs weak heuristics.
//
// source values, strongest to weakest:
//   curated-exact         hand-curated map, exact host        (very high)
//   curated-registered    hand-curated map, registered domain (very high)
//   trackerdb-exact       Disconnect/DDG, exact host          (high)
//   trackerdb-registered  Disconnect/DDG, registered domain   (high)
//   suffix-rule           hand-curated broad suffix           (high)
//   escalated             subdomain-label heuristic           (medium)
//   heuristic             keyword in hostname                 (low)
//   default               nothing matched → Infrastructure    (benign, not flagged)
export function classifyWithSource(hostname) {
  const h = hostname.replace(/^www\./, "");
  const parts = h.split(".");
  const registered = parts.length > 2 ? parts.slice(-2).join(".") : null;

  const rules = [
    ["curated-exact", () => EXACT[h]],
    ["trackerdb-exact", () => lookupTrackerExact(h)],
    ["curated-registered", () => (registered ? EXACT[registered] : null)],
    ["trackerdb-registered", () => lookupTrackerRegistered(h)],
    ["suffix-rule", () => suffixRule(h)],
    ["heuristic", () => heuristic(h)],
  ];

  let parentHint = null;
  let resolved = null;
  let source = "default";

  for (const [name, rule] of rules) {
    const hit = rule();
    if (!hit) continue;
    if (!parentHint && hit.parent) parentHint = hit.parent;
    if (hit.category) {
      resolved = { category: hit.category, parent: hit.parent || parentHint };
      source = name;
      break;
    }
  }

  if (!resolved) return { category: "Infrastructure", parent: parentHint, source: "default" };

  const escalated = escalateTrackingSubdomain(h, resolved);
  if (escalated.category !== resolved.category) {
    return { ...escalated, source: "escalated" };
  }
  return { ...resolved, source };
}

// Escalate a benign classification when the leftmost label signals tracking
// intent. Only applies to real subdomains, and only escalates — never downgrades.
function escalateTrackingSubdomain(h, resolved) {
  if (!ESCALATABLE.has(resolved.category)) return resolved;

  const parts = h.split(".");
  if (parts.length < 3) return resolved;

  const escalated = TRACKING_LABELS[parts[0]];
  if (!escalated) return resolved;

  return { category: escalated, parent: resolved.parent };
}