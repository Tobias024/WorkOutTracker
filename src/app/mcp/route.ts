// SPDX-License-Identifier: AGPL-3.0-only
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createAnonClient } from "@/lib/supabase/anon";
import { buildMcpServer } from "@/lib/mcp/tools";
import { corsHeaders, corsPreflight } from "@/lib/cors";
import { siteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";

function unauthorized(request: Request): Response {
  const origin = siteOrigin(request);
  return new Response(JSON.stringify({ error: "invalid_token" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      // Le dice al cliente MCP contra qué authorization server autenticarse.
      "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      ...corsHeaders(),
    },
  });
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

async function handle(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (!token) return unauthorized(request);

  // Chequeo temprano (antes de levantar el server/transport): un token
  // inválido no debería ni intentar negociar MCP. Cada tool igual vuelve a
  // pasar el token a su RPC, que re-valida con mcp_authenticate — esto sólo
  // evita el trabajo de más si ya sabemos que va a fallar.
  const supabase = createAnonClient();
  const { data: userId, error } = await supabase.rpc("mcp_authenticate", {
    p_access_token: token,
  });
  if (error || !userId) return unauthorized(request);

  const server = buildMcpServer(token);
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Sin sessionIdGenerator: modo stateless, acorde a un runtime serverless
    // (cada invocación puede caer en una instancia distinta, no hay forma de
    // mantener sesión en memoria entre requests de todas formas).
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  return withCors(response);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function DELETE(request: Request) {
  return handle(request);
}

export async function OPTIONS() {
  return corsPreflight();
}
