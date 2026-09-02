// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Copia texto al portapapeles de forma robusta.
 *
 * `navigator.clipboard` no existe en contextos no seguros ni en algunos
 * webviews in-app (donde suele abrirse un link compartido), así que caemos
 * a un fallback con un <textarea> temporal + execCommand. Devuelve true si
 * alguno de los dos métodos funcionó.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Sigue al fallback.
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
