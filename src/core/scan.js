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
import { computeVerdict, countByCategory, findIllegalNodes } from "./verdict.js";

const SKIP_PROTOCOLS = ["data:", "blob:", "chrome-extension:"];

const DEFAULTS = {
  timeout: 30000,        // navigation timeout
  bannerWait: 6000,      // wait for a banner to appear
  postConsentWait: 8000, // wait for post-consent requests to fire
  headless: true,
  chromiumPath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  onEvent: null,         // optional progress callback (phase, detail)
};

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
            resourceType: req.resourceType(), count: 0,
          });
        }
        if (consentClickedAt === null) beforeSet.add(host);
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

    if (cmp) {
      bannerDetected = true;
      cmpName = cmp.name;
      emit("consent", { cmp: cmp.name, actionable: cmp.actionable });

      consentClickedAt = Date.now() - pageStart;
      const clicked = cmp.actionable ? await acceptCMP(page, cmp) : false;

      if (clicked) {
        consentAccepted = true;
        await page.waitForTimeout(opts.postConsentWait);
        await page.evaluate(() => window.scrollTo(0, 500)).catch(() => { });
        await page.waitForTimeout(3000);
        await page.evaluate(() => window.scrollTo(0, 1200)).catch(() => { });
        await page.waitForTimeout(3000);
      } else {
        // Could not accept — everything recorded stays pre-consent, but we
        // cannot observe post-consent behaviour. Verdict becomes INCONCLUSIVE.
        consentClickedAt = null;
      }
    }

    await context.close();

    const buildNodes = (hostSet) =>
      [...hostSet].map(host => {
        const req = requests.get(host) || { bytes: 0, time: 0 };
        const { category, parent } = classifyDomain(host);
        const bytes = req.bytes || 0;
        return {
          id: host, label: buildLabel(host), category, parent: parent || null,
          bytes, time: req.time, size: sizeFromBytes(bytes),
        };
      }).sort((a, b) => a.time - b.time);

    const beforeNodes = buildNodes(beforeSet);
    const afterNodes = buildNodes(afterSet);
    const illegalNodes = findIllegalNodes(beforeNodes);
    const verdict = computeVerdict({ bannerDetected, consentAccepted, illegalCount: illegalNodes.length });

    return {
      url,
      hostname: targetHostname,
      scannedAt: new Date().toISOString(),
      bannerDetected,
      consentAccepted,
      cmpName,
      consentClickedAt,
      verdict,
      before: { nodes: beforeNodes, count: beforeNodes.length },
      after: { nodes: afterNodes, count: afterNodes.length },
      illegal: { nodes: illegalNodes, count: illegalNodes.length, categories: countByCategory(illegalNodes) },
    };
  } finally {
    await browser.close();
  }
}
