// SPDX-License-Identifier: AGPL-3.0-only
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAnonClient } from "@/lib/supabase/anon";
import { corsHeaders, corsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

// Dynamic Client Registration (RFC 7591). Sin auth: cualquier cliente MCP
// estándar se registra solo, antes de que exista ningún login humano.
// Clientes públicos (sin secret) — sólo PKCE, por eso no se pide ni guarda
// client_secret acá.
const RegisterSchema = z.object({
  client_name: z.string().trim().min(1).max(200),
  redirect_uris: z.array(z.string().url()).min(1).max(10),
  // El resto de los campos que puede mandar un cliente conforme (grant_types,
  // response_types, token_endpoint_auth_method, scope, etc.) se ignoran: este
  // server sólo soporta una forma de operar (authorization_code+refresh_token,
  // code, none), así que no hay nada que negociar.
});

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: "invalid_client_metadata", error_description: message },
    { status, headers: corsHeaders() },
  );
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Body inválido: se espera JSON", 400);
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
  }

  const supabase = createAnonClient();
  const { data: clientId, error } = await supabase.rpc("register_oauth_client", {
    p_client_name: parsed.data.client_name,
    p_redirect_uris: parsed.data.redirect_uris,
  });

  if (error || !clientId) {
    return errorResponse(error?.message ?? "No se pudo registrar el cliente", 400);
  }

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: parsed.data.client_name,
      redirect_uris: parsed.data.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: corsHeaders() },
  );
}
