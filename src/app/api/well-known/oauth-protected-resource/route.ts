// SPDX-License-Identifier: AGPL-3.0-only
import { NextResponse } from "next/server";
import { siteOrigin } from "@/lib/site-origin";
import { corsHeaders, corsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

// Metadata del recurso protegido (RFC 9728): a este doc apunta el header
// WWW-Authenticate que devuelve /mcp cuando falta/vence el bearer token, para
// que el cliente MCP sepa contra qué authorization server autenticarse.
export async function GET(request: Request) {
  const origin = siteOrigin(request);

  return NextResponse.json(
    {
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
    },
    { headers: corsHeaders() },
  );
}

// Clientes MCP que corren en el navegador (ej. MCP Inspector) hacen el
// discovery desde el browser: sin CORS no pueden leer este JSON.
export function OPTIONS() {
  return corsPreflight();
}
