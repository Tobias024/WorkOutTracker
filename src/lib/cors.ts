// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Headers CORS compartidos por los endpoints server-to-server del bridge
 * OAuth/MCP (/oauth/register, /oauth/token, /mcp): pueden ser llamados desde
 * clientes MCP basados en browser (ej. claude.ai), no sólo desde apps nativas.
 * Mcp-Session-Id va en Expose-Headers a propósito: sin eso, un cliente en el
 * browser no puede LEER ese header de respuesta aunque el CORS lo permita.
 */
export function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
  };
}

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
