// Standalone consent scan. Same measurement as weaveeye-api's
// scanWithConsentTest, decoupled from Express, Redis and BullMQ so it can run
// inside a CI job with no infrastructure.
//
// Loads a page in a real browser, records every third party, detects and
// accepts the consent banner, and splits third parties into what fired BEFORE
// consent vs AFTER. The "before" tracking domains are the finding.

import { chromium } from "playwright";
import { classifyDomain } from "./classifier.js";
import { detectCMP, acceptCMP } from "./cmp.js";
import { buildLabel, sizeFromBytes } from "./labels.js";
import { computeVerdict, countByCategory, findConfirmedViolations, findGatedTags } from "./verdict.js";

const SKIP_PROTOCOLS = ["data:", "blob:", "chrome-extension:"];

// Resource types that represent data actually being sent/received, as opposed
// to a script/document/style/font merely loading. A pixel, beacon, XHR, fetch,
// websocket or media request to a tracker is a real data flow.
const DATA_RESOURCE_TYPES = new Set([
  "image", "media", "xhr", "fetch", "eventsource", "websocket", "ping",
]);

function isDataRequest(resourceType, method) {
  if (method && method.toUpperCase() === "POST") return true;
  return DATA_RESOURCE_TYPES.has(resourceType);
}

const DEFAULTS = {
  timeout: 30000,        // navigation timeout
  bannerWait: 6000,      // wait for a banner to appear
  postConsentWait: 8000, // wait for post-consent requests to fire after accepting
  noConsentWait: 3500,   // settle time when no consent was accepted
  headless: true,
  chromiumPath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  onEvent: null,         // optional progress callback (phase, detail)
};

// Signatures of a bot-detection / anti-automation challenge page. Matched
// case-insensitively against the page title and a slice of visible text.
const BLOCK_SIGNATURES = [
  "pardon our interruption",          // HUMAN / PerimeterX
  "verify you are a human",
  "verifying you are human",
  "are you a human",
  "just a moment",                    // Cloudflare
  "attention required",               // Cloudflare
  "access denied",
  "access to this page has been denied",
  "you have been blocked",
  "enable javascript and cookies to continue", // DataDome
  "please enable js",
  "request unsuccessful. incapsula",  // Imperva Incapsula
  "checking your browser before",
  "ddos protection by",
];

// Pure classification of a page's title + text. Exported for testing.
export function classifyBlock(title = "", text = "") {
  const haystack = `${title}\n${text}`.toLowerCase();
  const hit = BLOCK_SIGNATURES.find(sig => haystack.includes(sig));
  if (hit) return { blocked: true, reason: `challenge page ("${hit}")` };
  if (text.trim().length < 40) {
    return { blocked: true, reason: "empty page after load (likely challenge or block)" };
  }
  return { blocked: false, reason: null };
}

async function detectBlock(page) {
  try {
    const { title, text } = await page.evaluate(() => ({
      title: document.title || "",
      text: (document.body?.innerText || "").slice(0, 2000),
    }));
    return classifyBlock(title, text);
  } catch {
    return { blocked: false, reason: null };
  }
}

function normalizeUrl(rawUrl) {
  let url = String(rawUrl).trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  return { url, hostname };
}

export async function consentScan(rawUrl, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const emit = (phase, detail) => { try { opts.onEvent?.(phase, detail); } catch { } };
  const { url, hostname: targetHostname } = normalizeUrl(rawUrl);

  const browser = await chromium.launch({
    headless: opts.headless,
    executablePath: opts.chromiumPath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    const pageStart = Date.now();
    const requests = new Map();  // host → { bytes, time, resourceType, count }
    const beforeSet = new Set();
    const afterSet = new Set();
    let consentClickedAt = null;

    const isThirdParty = (host) =>
      host && host !== targetHostname && !host.endsWith(`.${targetHostname}`);

    page.on("request", (req) => {
      try {
        if (SKIP_PROTOCOLS.some(p => req.url().startsWith(p))) return;
        const host = new URL(req.url()).hostname.replace(/^www\./, "");
        if (!isThirdParty(host)) return;

        if (!requests.has(host)) {
          requests.set(host, {
            bytes: 0, time: Date.now() - pageStart,
            resourceType: req.resourceType(), count: 0, dataFlowBefore: false,
          });
        }
        const preConsent = consentClickedAt === null;
        // Record whether real data went to this host *before* consent.
        if (preConsent && isDataRequest(req.resourceType(), req.method())) {
          requests.get(host).dataFlowBefore = true;
        }
        if (preConsent) beforeSet.add(host);
        else if (!beforeSet.has(host)) afterSet.add(host);
      } catch { }
    });

    page.on("requestfinished", async (req) => {
      try {
        if (SKIP_PROTOCOLS.some(p => req.url().startsWith(p))) return;
        const host = new URL(req.url()).hostname.replace(/^www\./, "");
        const existing = requests.get(host);
        if (!existing) return;
        const resp = await req.response();
        if (!resp) return;
        let size = 0;
        const headers = resp.headers();
        if (headers["content-length"]) size = parseInt(headers["content-length"]) || 0;
        else { const body = await resp.body().catch(() => null); size = body ? body.length : 0; }
        existing.bytes += size;
        existing.count += 1;
      } catch { }
    });

    emit("navigate", { url });
    try {
      await page.goto(url, { waitUntil: "load", timeout: opts.timeout });
    } catch (err) {
      if (!/timeout/i.test(err.message)) throw err;
    }

    emit("detect-banner", {});
    await page.waitForTimeout(opts.bannerWait);
    // Give a known accept button a chance to attach (Fides renders hidden first).
    await page.waitForSelector(
      "#fides-accept-all-button, .fides-accept-all-button, #onetrust-accept-btn-handler, .didomi-continue-without-agreeing, #CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
      { timeout: 8000, state: "attached" },
    ).catch(() => { });

    const cmp = await detectCMP(page);

    let bannerDetected = false;
    let consentAccepted = false;
    let cmpName = null;

    // Scroll to trigger lazy-loaded content, then settle. Used in every branch:
    // ad and tracker scripts are very often loaded on scroll/idle rather than at
    // page load. Without this, a site that lazy-loads its tags reads as clean —
    // a false negative, the dangerous direction. When no valid consent was
    // given, everything this surfaces is correctly counted as pre-consent.
    const settleWithScroll = async (initialWait) => {
      await page.waitForTimeout(initialWait);
      await page.evaluate(() => window.scrollTo(0, 600)).catch(() => { });
      await page.waitForTimeout(2500);
      await page.evaluate(() => window.scrollTo(0, 1400)).catch(() => { });
      await page.waitForTimeout(2500);
    };

    if (cmp) {
      bannerDetected = true;
      cmpName = cmp.name;
      emit("consent", { cmp: cmp.name, actionable: cmp.actionable });

      consentClickedAt = Date.now() - pageStart;
      const clicked = cmp.actionable ? await acceptCMP(page, cmp) : false;

      if (clicked) {
        consentAccepted = true;
        // Measures post-consent loading (the "after" set).
        await settleWithScroll(opts.postConsentWait);
      } else {
        // Could not accept — everything recorded stays pre-consent, but we
        // cannot observe post-consent behaviour. Verdict becomes INCONCLUSIVE.
        // Still scroll, so a banner-blocked page doesn't undercount "before".
        consentClickedAt = null;
        await settleWithScroll(opts.noConsentWait);
      }
    } else {
      // No banner: scroll to surface lazy pre-consent trackers. Everything here
      // is "before" — no consent was ever requested.
      emit("no-banner-settle", {});
      await settleWithScroll(opts.noConsentWait);
    }

    // Did we actually see the real page, or a bot-detection challenge? A
    // scanner that reports "clean" on a page it was blocked from produces a
    // false negative — the worst kind of error for a compliance tool — so this
    // is surfaced as a distinct signal rather than swallowed.
    const block = await detectBlock(page).catch(() => null);

    await context.close();

    const buildNodes = (hostSet) =>
      [...hostSet].map(host => {
        const req = requests.get(host) || { bytes: 0, time: 0, dataFlowBefore: false };
        const { category, parent } = classifyDomain(host);
        const bytes = req.bytes || 0;
        return {
          id: host, label: buildLabel(host), category, parent: parent || null,
          bytes, time: req.time, size: sizeFromBytes(bytes),
          dataFlow: req.dataFlowBefore || false,
        };
      }).sort((a, b) => a.time - b.time);

    const beforeNodes = buildNodes(beforeSet);
    const afterNodes = buildNodes(afterSet);
    const violationNodes = findConfirmedViolations(beforeNodes);
    const gatedTagNodes = findGatedTags(beforeNodes);
    const verdict = computeVerdict({ bannerDetected, consentAccepted, violationCount: violationNodes.length });

    return {
      url,
      hostname: targetHostname,
      scannedAt: new Date().toISOString(),
      bannerDetected,
      consentAccepted,
      cmpName,
      consentClickedAt,
      blocked: block?.blocked || false,
      blockReason: block?.reason || null,
      verdict,
      before: { nodes: beforeNodes, count: beforeNodes.length },
      after: { nodes: afterNodes, count: afterNodes.length },
      // Confirmed pre-consent data transfers — the build-failing violations.
      illegal: { nodes: violationNodes, count: violationNodes.length, categories: countByCategory(violationNodes) },
      // Consent-requiring tags that only loaded a script pre-consent — advisory
      // (may be gated by Consent Mode).
      gatedTags: { nodes: gatedTagNodes, count: gatedTagNodes.length, categories: countByCategory(gatedTagNodes) },
    };
  } finally {
    await browser.close();
  }
}
