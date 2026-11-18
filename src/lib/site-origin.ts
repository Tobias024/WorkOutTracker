// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Origin del host real donde está parado el cliente que hizo la request
 * (no NEXT_PUBLIC_SITE_URL): mismo criterio que ya usa src/app/login/page.tsx
 * en el cliente (window.location.origin) — así los endpoints de OAuth/MCP
 * matchean el dominio real aunque esa env var quede mal seteada.
 */
export function siteOrigin(request: Request): string {
  return new URL(request.url).origin;
}
