// Consent audit verdict logic. Pure — no I/O.
//
// The core measurement: which third parties received data BEFORE the user gave
// consent. Everything a report or a CI gate asserts flows through this file, so
// it is deliberately small and fully covered by tests.

// Categories that require prior consent under GDPR/ePrivacy and carry CIPA
// exposure in the US. The strict rule — the safest posture in both regimes.
export const CONSENT_REQUIRED_CATEGORIES = ["Advertising", "Analytics", "Data Broker"];

// Third-party ad exchanges and data brokers. A request to one of these
// transmits the user's cookies and often an explicit bid/sync payload, and —
// critically — Google Consent Mode does NOT gate them (it only governs Google's
// own tags). So any pre-consent request to these is a confirmed data transfer,
// regardless of resource type.
const AD_TECH_CATEGORIES = ["Advertising", "Data Broker"];

export const VERDICTS = {
  // No consent mechanism was found on the page at all. Anything in `illegal`
  // still fired with no consent — this is a finding, not a clean bill.
  NO_BANNER_DETECTED: "NO_BANNER_DETECTED",

  // A banner was found but we could not complete the accept interaction, so
  // post-consent behaviour is unknown. Pre-consent findings remain valid;
  // we simply cannot say what would have loaded after acceptance.
  // This must never be reported as NON_COMPLIANT — an untested site is not a
  // failing site, and claiming otherwise makes the whole report unciteable.
  INCONCLUSIVE: "INCONCLUSIVE",

  COMPLIANT: "COMPLIANT",
  NON_COMPLIANT: "NON_COMPLIANT",
};

/**
 * Did this third party actually receive data before consent, or did it only
 * load a script that Google Consent Mode may be holding in a "denied" state?
 *
 * Confirmed transfer when either:
 *   - it is a third-party ad exchange / data broker (Consent Mode never
 *     applies), or
 *   - it received a data-carrying request before consent — a pixel, beacon,
 *     XHR/fetch or POST — i.e. data actually went out, not just a <script> load.
 *
 * A pure script load from an analytics/tag vendor (e.g. googletagmanager.com)
 * is NOT a confirmed transfer: under Consent Mode the tag can load but withhold
 * data until consent. Those are reported separately as "gated tags".
 */
export function isConfirmedTransfer(node) {
  if (AD_TECH_CATEGORIES.includes(node.category)) return true;
  return node.dataFlow === true;
}

// Consent-requiring third parties that received data before consent — the
// build-failing violations.
export function findConfirmedViolations(beforeNodes) {
  return beforeNodes.filter(
    n => CONSENT_REQUIRED_CATEGORIES.includes(n.category) && isConfirmedTransfer(n),
  );
}

// Consent-requiring tags that only loaded a script before consent — possibly
// Consent-Mode-gated. Advisory, not build-failing by default.
export function findGatedTags(beforeNodes) {
  return beforeNodes.filter(
    n => CONSENT_REQUIRED_CATEGORIES.includes(n.category) && !isConfirmedTransfer(n),
  );
}

export function countByCategory(nodes) {
  return nodes.reduce((acc, n) => {
    acc[n.category] = (acc[n.category] || 0) + 1;
    return acc;
  }, {});
}

export function computeVerdict({ bannerDetected, consentAccepted, violationCount }) {
  if (!bannerDetected) return VERDICTS.NO_BANNER_DETECTED;
  if (!consentAccepted) return VERDICTS.INCONCLUSIVE;
  return violationCount === 0 ? VERDICTS.COMPLIANT : VERDICTS.NON_COMPLIANT;
}
