/**
 * CMP (Consent Management Platform) detection and interaction library.
 * Each entry defines how to detect the CMP and click "Accept All".
 * 
 * Strategy per CMP:
 * - selector: CSS selector for the accept button
 * - detect: CSS selector that confirms this CMP is present
 * - name: human readable name for the report
 */

export const CMP_DEFINITIONS = [
    // ── OneTrust (most common — NYT, Reuters, many large publishers) ──
    {
        name: "OneTrust",
        detect: "#onetrust-banner-sdk, #onetrust-consent-sdk",
        selector: "#onetrust-accept-btn-handler, .onetrust-accept-btn-handler",
    },

    // ── Cookiebot (very common in EU) ──
    {
        name: "Cookiebot",
        detect: "#CybotCookiebotDialog, #cookiebanner",
        selector: "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept",
    },

    // ── TrustArc ──
    {
        name: "TrustArc",
        detect: "#truste-consent-track, .truste_overlay",
        selector: ".pdynamicbutton .call, #truste-consent-button",
    },

    // ── Quantcast Choice ──
    {
        name: "Quantcast",
        detect: "#qc-cmp2-ui, .qc-cmp2-summary-buttons",
        selector: ".qc-cmp2-summary-buttons button:last-child",
    },

    // ── Didomi ──
    {
        name: "Didomi",
        detect: "#didomi-popup, #didomi-notice",
        selector: "#didomi-notice-agree-button, .didomi-continue-without-agreeing",
    },

    // ── Usercentrics ──
    {
        name: "Usercentrics",
        detect: "[data-testid='uc-banner'], #usercentrics-root",
        selector: "[data-testid='uc-accept-all-button'], .uc-btn-accept-banner",
    },

    // ── Osano ──
    {
        name: "Osano",
        detect: ".osano-cm-window, .osano-cm-dialog",
        selector: ".osano-cm-accept-all, .osano-cm-button--type_accept",
    },

    // ── Borlabs Cookie (WordPress) ──
    {
        name: "Borlabs",
        detect: "#borlabs-cookie, .borlabs-cookie",
        selector: ".borlabs-cookie-btn-accept-all, #CookiePref button.accept-cookie",
    },

    // ── Civic Cookie Control ──
    {
        name: "Civic",
        detect: "#ccc, #ccc-overlay",
        selector: "#ccc-notify-accept, .ccc-notify-link",
    },

    // ── Fides (NYT, many US publishers) ──
    {
        name: "Fides",
        detect: "#fides-accept-all-button, .fides-banner-button",
        selector: "#fides-accept-all-button",
    },

    // ── Generic fallback — common button patterns ──
    // MUST stay last: its selectors are broad enough to match a named CMP's
    // button and mislabel it. `genericFallback` also excludes it from the
    // container-only detection pass, where `[class*='cookie']` would match a
    // footer "Cookie preferences" link and report a banner that isn't there.
    {
        name: "Generic",
        genericFallback: true,
        detect: "[class*='cookie'], [id*='cookie'], [class*='consent'], [id*='consent'], [class*='gdpr'], [id*='gdpr']",
        selector: [
            "button[id*='accept']",
            "button[class*='accept']",
            "button[id*='agree']",
            "button[class*='agree']",
            "a[id*='accept']",
            "a[class*='accept']",
        ].join(", "),
    },
];

/**
 * Detect which CMP is present on the page.
 *
 * Returns `{ ...definition, actionable }` or null.
 *
 * `actionable` is the important part. Several CMPs — OneTrust in particular —
 * inject their SDK container into the DOM on every page load, including in
 * regions where no banner is ever shown to the visitor. Treating the presence
 * of that container as "a consent banner exists" produces a false positive on
 * every geo where the banner is suppressed, and then an unclickable accept
 * button turns the whole scan INCONCLUSIVE for no reason.
 *
 * So we look for the accept button first, because that is the only element
 * that proves the interaction can actually be completed. We fall back to a
 * *visible* container, which means "a banner is being shown but we cannot
 * operate it" — a genuinely inconclusive result. An invisible container alone
 * is not a banner.
 */
export async function detectCMP(page) {
    // Pass 1 — an accept button in the DOM. Deliberately does not require
    // visibility for named CMPs: Fides and others render the button hidden
    // before revealing the banner, and we click via JS anyway.
    for (const cmp of CMP_DEFINITIONS) {
        try {
            const btn = await page.$(cmp.selector);
            if (!btn) continue;

            // The generic selectors are broad enough to match a non-consent
            // "Accept" button (terms, an app modal, a newsletter). Require a
            // consent container to also be present AND the button to be
            // visible, so a stray button can't be mistaken for a banner.
            if (cmp.genericFallback) {
                const container = await page.$(cmp.detect);
                if (!container) continue;
                if (!(await btn.isVisible().catch(() => false))) continue;
            }
            return { ...cmp, actionable: true };
        } catch { }
    }

    // Pass 2 — a visible banner container with no accept button we recognise.
    // Named CMPs only: the generic container selectors are far too loose to
    // prove a banner is present.
    for (const cmp of CMP_DEFINITIONS) {
        if (cmp.genericFallback) continue;
        try {
            const el = await page.$(cmp.detect);
            if (!el) continue;
            if (await el.isVisible().catch(() => false)) {
                return { ...cmp, actionable: false };
            }
        } catch { }
    }

    return null;
}

/**
 * Click the accept button for a detected CMP.
 * Returns true if clicked successfully.
 */
export async function acceptCMP(page, cmp) {
    try {
        // Try JavaScript click first — works for hidden/zero-size buttons like Fides
        const clicked = await page.evaluate((selector) => {
            const btn = document.querySelector(selector);
            if (!btn) return false;
            btn.click();
            return true;
        }, cmp.selector);

        if (!clicked) return false;

        // Wait for banner to disappear and post-consent requests to fire
        await page.waitForTimeout(2000);

        // Verify banner is gone
        try {
            await page.waitForSelector(cmp.detect, { state: "hidden", timeout: 3000 });
        } catch { }

        return true;
    } catch {
        return false;
    }
}