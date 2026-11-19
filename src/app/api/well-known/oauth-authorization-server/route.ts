// SPDX-License-Identifier: AGPL-3.0-only
import { NextResponse } from "next/server";
import { siteOrigin } from "@/lib/site-origin";
import { corsHeaders, corsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

// Metadata de descubrimiento (RFC 8414) para que cualquier cliente MCP
// estándar encuentre solo los endpoints de abajo. Server público: sin auth.
// Sin revocation_endpoint a propósito — no se implementa un endpoint RFC 7009
// en v1, y declarar uno sin implementarlo rompe clientes bien comportados
// que intenten llamarlo al desconectar.
export async function GET(request: Request) {
  const origin = siteOrigin(request);

  return NextResponse.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["full_access"],
    },
    { headers: corsHeaders() },
  );
}

// Clientes MCP que corren en el navegador (ej. MCP Inspector) hacen el
// discovery desde el browser: sin CORS no pueden leer este JSON.
export function OPTIONS() {
  return corsPreflight();
}
