// URL and image-source validation helpers shared across corpus loading,
// Markdown rendering, Plate Workbench, and HTML report export.

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const SAFE_DATA_IMAGE_RE =
  /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/**
 * Validate a hyperlink href for rendering in `<a href>`.
 * Allows relative paths (not protocol-relative `//`), `#` fragments, and
 * `http:` / `https:` URLs. Rejects `javascript:`, `data:`, `vbscript:`,
 * `file:`, and control-character-obfuscated schemes.
 */
export function safeHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || CONTROL_CHARS.test(trimmed)) return null;
  if (trimmed.startsWith("#")) return trimmed;
  if (trimmed.startsWith("//")) return null;
  // Relative URL without a scheme (no colon before first / ? #)
  const colon = trimmed.indexOf(":");
  const slash = trimmed.search(/[/?#]/);
  if (colon === -1 || (slash !== -1 && slash < colon)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.href;
    }
  } catch {
    return null;
  }
  return null;
}

export type CorpusUrlCheck =
  | { ok: true; url: string; external: boolean }
  | { ok: false; error: string };

/**
 * Validate a `?corpus=<url>` parameter before passing it to `fetch()`.
 * Allows same-origin relative URLs (e.g. `/api/local/corpus.json` served by
 * `aegean workbench`), `https:` URLs, and loopback `http://127.0.0.1` /
 * `http://localhost` URLs for local tooling. Rejects `data:`, `javascript:`,
 * `file:`, and non-loopback plaintext `http:`.
 */
export function safeCorpusUrl(raw: string): CorpusUrlCheck {
  const trimmed = raw.trim();
  if (!trimmed || CONTROL_CHARS.test(trimmed)) {
    return { ok: false, error: "Invalid corpus URL." };
  }
  if (trimmed.startsWith("//")) {
    return { ok: false, error: "Protocol-relative corpus URLs are not allowed." };
  }
  const colon = trimmed.indexOf(":");
  const slash = trimmed.search(/[/?#]/);
  if (colon === -1 || (slash !== -1 && slash < colon)) {
    return { ok: true, url: trimmed, external: false };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:") {
      const sameOrigin =
        typeof window !== "undefined" && parsed.origin === window.location.origin;
      return { ok: true, url: parsed.href, external: !sameOrigin };
    }
    if (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "::1" ||
        parsed.hostname === "[::1]")
    ) {
      const sameOrigin =
        typeof window !== "undefined" && parsed.origin === window.location.origin;
      return { ok: true, url: parsed.href, external: !sameOrigin };
    }
    return {
      ok: false,
      error: `Blocked corpus URL scheme "${parsed.protocol}" — only https: or same-origin URLs are permitted.`,
    };
  } catch {
    return { ok: false, error: "Malformed corpus URL." };
  }
}

/** Strict allowlist for raster base64 image data URLs embedded in reports. */
export function safeDataImageUri(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return SAFE_DATA_IMAGE_RE.test(trimmed) ? trimmed : null;
}

/**
 * Validate an image `src` attribute used in exported HTML reports: either a
 * verified base64 raster data URL or a relative asset path inside `images/`.
 */
export function safeReportImageSrc(raw: unknown): string | null {
  const dataUri = safeDataImageUri(raw);
  if (dataUri) return dataUri;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || CONTROL_CHARS.test(trimmed)) return null;
  if (/^images\/[A-Za-z0-9._/@+\- %]+$/.test(trimmed) && !trimmed.includes("..")) {
    return trimmed;
  }
  return null;
}
