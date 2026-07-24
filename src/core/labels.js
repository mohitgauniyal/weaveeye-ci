// Pure helpers that turn a hostname + request stats into a graph node.
// No I/O here — this module is unit tested without launching a browser.

// Subdomains that carry no useful meaning in a label.
const GENERIC_SUBDOMAINS = ["www", "cdn", "static", "img", "api"];

export function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// "collector.github.com" → "Collector (Github)"
// "doubleclick.net"      → "Doubleclick"
// "cdn.example.com"      → "Example"   (generic subdomain dropped)
export function buildLabel(host) {
  const parts = host.split(".");
  const registered = parts.slice(-2, -1)[0] || host;
  const subdomain = parts.length > 2 ? parts[0] : null;

  if (subdomain && !GENERIC_SUBDOMAINS.includes(subdomain)) {
    return `${titleCase(subdomain)} (${titleCase(registered)})`;
  }
  return titleCase(registered.replace(/-/g, " "));
}

export function sizeFromBytes(bytes) {
  if (bytes > 500000) return 22;
  if (bytes > 100000) return 18;
  if (bytes > 10000) return 14;
  if (bytes > 1000) return 11;
  return 9;
}
