// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Valida el destino `?next=` antes de redirigir (login, callback de auth,
 * onboarding). Sin esto es un open redirect: `//evil.com`, `/\evil.com`,
 * `https://evil.com` en `router.replace`, o `@evil.com` / `.evil.com`
 * concatenados a `${origin}` en el callback, mandan al usuario a otro sitio
 * con la sesión recién creada.
 *
 * Sólo acepta paths internos absolutos ("/rutinas", "/r/abc?x=1"). Cualquier
 * otra cosa cae al fallback.
 */
export const DEFAULT_NEXT = "/rutinas";

export function safeNext(
  next: string | null | undefined,
  fallback: string = DEFAULT_NEXT,
): string {
  if (!next) return fallback;
  // Tiene que ser un path absoluto, no protocol-relative ("//") ni con
  // backslash ("/\", que los navegadores normalizan a "//").
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return fallback;
  // Nada de credenciales, backslashes ni caracteres de control en ningún lado.
  if (/[@\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  // Último chequeo: resuelto contra un origen ficticio tiene que quedarse ahí.
  try {
    const base = "http://wolf.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
