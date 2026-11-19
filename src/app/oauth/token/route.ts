// SPDX-License-Identifier: AGPL-3.0-only
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAnonClient } from "@/lib/supabase/anon";
import { corsHeaders, corsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

const AuthCodeGrant = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(1),
  redirect_uri: z.string().min(1),
  client_id: z.string().min(1),
  code_verifier: z.string().min(1),
  resource: z.string().optional(),
});

const RefreshGrant = z.object({
  grant_type: z.literal("refresh_token"),
  refresh_token: z.string().min(1),
  client_id: z.string().min(1),
});

const TokenRequest = z.discriminatedUnion("grant_type", [AuthCodeGrant, RefreshGrant]);

function errorResponse(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: corsHeaders() },
  );
}

/** Mapea un error de Postgres ("invalid_grant: ...") a la forma OAuth estándar. */
function toOAuthError(message: string) {
  const prefix = "invalid_grant: ";
  if (message.startsWith(prefix)) {
    return errorResponse("invalid_grant", message.slice(prefix.length));
  }
  return errorResponse("invalid_grant", message);
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  let raw: Record<string, string>;
  try {
    const form = await request.formData();
    raw = Object.fromEntries(
      [...form.entries()].map(([k, v]) => [k, String(v)]),
    );
  } catch {
    return errorResponse(
      "invalid_request",
      "Body inválido: se espera application/x-www-form-urlencoded",
    );
  }

  if (!raw.grant_type) {
    return errorResponse("invalid_request", "Falta grant_type");
  }

  const parsed = TokenRequest.safeParse(raw);
  if (!parsed.success) {
    if (raw.grant_type !== "authorization_code" && raw.grant_type !== "refresh_token") {
      return errorResponse(
        "unsupported_grant_type",
        `grant_type no soportado: ${raw.grant_type}`,
      );
    }
    return errorResponse(
      "invalid_request",
      parsed.error.issues[0]?.message ?? "Parámetros inválidos",
    );
  }

  const supabase = createAnonClient();

  if (parsed.data.grant_type === "authorization_code") {
    const { data, error } = await supabase
      .rpc("exchange_oauth_code", {
        p_code: parsed.data.code,
        p_code_verifier: parsed.data.code_verifier,
        p_client_id: parsed.data.client_id,
        p_redirect_uri: parsed.data.redirect_uri,
        p_resource: parsed.data.resource ?? null,
      })
      .single();

    if (error || !data) return toOAuthError(error?.message ?? "invalid_grant: desconocido");

    return NextResponse.json(
      {
        access_token: data.access_token,
        token_type: "Bearer",
        expires_in: data.expires_in,
        refresh_token: data.refresh_token,
      },
      { headers: corsHeaders() },
    );
  }

  const { data, error } = await supabase
    .rpc("refresh_oauth_token", {
      p_refresh_token: parsed.data.refresh_token,
      p_client_id: parsed.data.client_id,
    })
    .single();

  if (error || !data) return toOAuthError(error?.message ?? "invalid_grant: desconocido");

  return NextResponse.json(
    {
      access_token: data.access_token,
      token_type: "Bearer",
      expires_in: data.expires_in,
      refresh_token: data.refresh_token,
    },
    { headers: corsHeaders() },
  );
}
