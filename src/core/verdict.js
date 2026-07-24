// Consent audit verdict logic. Pure — no I/O.
//
// The core measurement: which third parties fired BEFORE the user gave consent.
// Everything a report or a CI gate asserts flows through this file, so it is
// deliberately small and fully covered by tests.

// Categories that legally require prior consent under GDPR/ePrivacy, and which
// carry the most exposure under CIPA-style wiretapping claims in the US.
// Note: this is intentionally the strict rule — it is the safest posture in
// both regimes, so one rule serves both.
export const CONSENT_REQUIRED_CATEGORIES = ["Advertising", "Analytics", "Data Broker"];

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

export function findIllegalNodes(beforeNodes) {
  return beforeNodes.filter(n => CONSENT_REQUIRED_CATEGORIES.includes(n.category));
}

export function countByCategory(nodes) {
  return nodes.reduce((acc, n) => {
    acc[n.category] = (acc[n.category] || 0) + 1;
    return acc;
  }, {});
}

export function computeVerdict({ bannerDetected, consentAccepted, illegalCount }) {
  if (!bannerDetected) return VERDICTS.NO_BANNER_DETECTED;
  if (!consentAccepted) return VERDICTS.INCONCLUSIVE;
  return illegalCount === 0 ? VERDICTS.COMPLIANT : VERDICTS.NON_COMPLIANT;
}
