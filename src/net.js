// A hung fetch (blocked domain, dead wifi, corporate proxy) never rejects
// on its own — without an explicit timeout, callers wait forever and the
// page just sits on its initial dark background with nothing visible.
export function fetchWithTimeout(url, options = {}, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}
