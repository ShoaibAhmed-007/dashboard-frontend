/**
 * Browser file-download helpers.
 *
 * Downloads that need auth headers can't be a plain `<a href>` — the browser
 * sends no Authorization or workspace header on a top-level navigation. The
 * flow is: fetch through the shared axios instance as a blob, then hand the
 * blob to the browser with `downloadBlob`.
 */

/**
 * Pulls the filename out of a `Content-Disposition` header.
 *
 * Prefers RFC 5987 `filename*=UTF-8''…` over the plain `filename=` form, since
 * only the former can carry non-ASCII names. Returns `null` when the header is
 * absent — which is the common case cross-origin, as `Content-Disposition` is
 * not CORS-safelisted and needs an explicit `Access-Control-Expose-Headers`.
 * Callers should have a reconstructed name ready rather than treating this as
 * the primary source.
 */
export function parseContentDispositionFilename(
  header: string | undefined | null
): string | null {
  if (!header) return null;

  const extended = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (extended?.[1]) {
    try {
      return sanitizeFilename(decodeURIComponent(extended[1].trim()));
    } catch {
      // Malformed percent-encoding — fall through to the plain form.
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(header);
  if (plain?.[1]) return sanitizeFilename(plain[1].trim());

  return null;
}

/**
 * Strips anything that would let a server-supplied name escape the downloads
 * folder or hide the file. The browser also guards this, but a filename that
 * arrives over the network shouldn't be trusted verbatim.
 */
function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/^\.+/, "");
  return base.length > 0 ? base : "download";
}

/** Hands a blob to the browser as a file save, then releases the object URL. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously after click() cancels the download in some Safari
  // builds — defer past the current task so the fetch has started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
