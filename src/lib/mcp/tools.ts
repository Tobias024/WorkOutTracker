// SPDX-License-Identifier: AGPL-3.0-only
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createAnonClient } from "@/lib/supabase/anon";
import type { McpLogExerciseItem, McpRoutineItem } from "@/lib/types";

// Mismos límites que valida mcp_set_routine_items/mcp_log_workout_session en
// SQL (defensa en profundidad: estas RPCs son alcanzables directo vía
// PostgREST, así que esto es sólo para dar errores más claros ANTES de
// pegarle a la base — la validación real sigue viviendo en la función).
const SetPlan = z.object({
  reps: z.number().int().positive().optional(),
  weight: z.number().positive().optional(),
  duration_seconds: z.number().int().positive().optional(),
  distance_m: z.number().int().positive().optional(),
});

const RoutineItem = z.object({
  slug: z.string().min(1).describe("Slug del ejercicio (ver list_exercises)"),
  sets: z.array(SetPlan).min(1).max(20),
});

const LoggedSet = z.object({
  reps: z.number().int().positive().optional(),
  weight: z.number().positive().optional(),
  duration_seconds: z.number().int().positive().optional(),
  distance_m: z.number().int().positive().optional(),
  comment: z.string().max(500).optional(),
});

const LoggedExercise = z.object({
  slug: z.string().min(1).describe("Slug del ejercicio (ver list_exercises)"),
  notes: z.string().max(500).optional(),
  sets: z.array(LoggedSet).min(1).max(20),
});

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/**
 * Arma un McpServer nuevo por request (modo stateless, acorde a un runtime
 * serverless) con las 8 tools, todas cerrando sobre el access_token ya
 * validado por la route /mcp. Cada llamada de todas formas vuelve a pasar el
 * token a la RPC correspondiente, que re-valida con mcp_authenticate — el
 * check de arriba es sólo para no construir el server si el token ya es
 * inválido.
 */
export function buildMcpServer(accessToken: string): McpServer {
  const server = new McpServer(
    { name: "wolf", version: "1.0.0" },
    {
      instructions:
        "Servidor MCP de WOLF (WorkOut, Logs & Friends). Da acceso de control " +
        "total a la cuenta del usuario conectado: catálogo de ejercicios, su " +
        "progreso, y sus rutinas y entrenamientos. Usá list_exercises antes de " +
        "create_routine/log_workout_session para conocer los slugs válidos.",
    },
  );
  const supabase = createAnonClient();

  server.registerTool(
    "list_exercises",
    {
      title: "Listar ejercicios",
      description:
        "Catálogo completo de ejercicios disponibles, con su slug (clave para " +
        "crear rutinas y registrar entrenamientos), músculos, equipo e instrucciones.",
    },
    async () => {
      const { data, error } = await supabase.rpc("mcp_list_exercises", {
        p_access_token: accessToken,
      });
      if (error) throw new Error(error.message);
      return jsonResult(data);
    },
  );

  server.registerTool(
    "get_progress",
    {
      title: "Ver progreso",
      description:
        "Progreso real del usuario por ejercicio: mejor 1RM estimado, último " +
        "peso/reps usados, fecha de la última vez y cuántas veces lo hizo. " +
        "Útil para proponer cargas realistas al crear una rutina.",
    },
    async () => {
      const { data, error } = await supabase.rpc("mcp_get_progress", {
        p_access_token: accessToken,
      });
      if (error) throw new Error(error.message);
      return jsonResult(data);
    },
  );

  server.registerTool(
    "list_routines",
    {
      title: "Listar rutinas",
      description: "Rutinas del usuario (sin el detalle de ejercicios/series).",
    },
    async () => {
      const { data, error } = await supabase.rpc("mcp_list_routines", {
        p_access_token: accessToken,
      });
      if (error) throw new Error(error.message);
      return jsonResult(data);
    },
  );

  server.registerTool(
    "get_routine",
    {
      title: "Ver el detalle de una rutina",
      description: "Rutina del usuario con todos sus ejercicios y series planeadas.",
      inputSchema: { routine_id: z.string().uuid() },
    },
    async ({ routine_id }) => {
      const { data, error } = await supabase.rpc("mcp_get_routine", {
        p_access_token: accessToken,
        p_routine_id: routine_id,
      });
      if (error) throw new Error(error.message);
      return jsonResult(data);
    },
  );

  server.registerTool(
    "create_routine",
    {
      title: "Crear una rutina",
      description:
        "Crea una rutina nueva del usuario. Cada ejercicio va por su slug " +
        "(ver list_exercises) con una o más series objetivo (reps+peso, o " +
        "duración/distancia para ejercicios que no se miden en reps×peso).",
      inputSchema: {
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        items: z.array(RoutineItem).min(1).max(50),
      },
    },
    async ({ name, description, items }) => {
      const { data, error } = await supabase.rpc("mcp_create_routine", {
        p_access_token: accessToken,
        p_name: name,
        p_description: description ?? null,
        p_items: items as McpRoutineItem[],
      });
      if (error) throw new Error(error.message);
      return jsonResult({ routine_id: data });
    },
  );

  server.registerTool(
    "update_routine",
    {
      title: "Editar una rutina",
      description:
        "Reemplaza por completo los ejercicios/series de una rutina existente " +
        "del usuario (no hace un merge parcial: items reemplaza todo lo anterior).",
      inputSchema: {
        routine_id: z.string().uuid(),
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        items: z.array(RoutineItem).min(1).max(50),
      },
    },
    async ({ routine_id, name, description, items }) => {
      const { error } = await supabase.rpc("mcp_update_routine", {
        p_access_token: accessToken,
        p_routine_id: routine_id,
        p_name: name,
        p_description: description ?? null,
        p_items: items as McpRoutineItem[],
      });
      if (error) throw new Error(error.message);
      return jsonResult({ ok: true });
    },
  );

  server.registerTool(
    "delete_routine",
    {
      title: "Borrar una rutina",
      description: "Borra una rutina del usuario (no se puede deshacer).",
      inputSchema: { routine_id: z.string().uuid() },
    },
    async ({ routine_id }) => {
      const { error } = await supabase.rpc("mcp_delete_routine", {
        p_access_token: accessToken,
        p_routine_id: routine_id,
      });
      if (error) throw new Error(error.message);
      return jsonResult({ ok: true });
    },
  );

  server.registerTool(
    "log_workout_session",
    {
      title: "Registrar un entrenamiento",
      description:
        "Registra un entrenamiento YA REALIZADO (no una sesión en curso), con " +
        "los valores reales de cada serie. routine_id es opcional (vincula el " +
        "registro a una rutina existente del usuario).",
      inputSchema: {
        name: z.string().max(200).optional(),
        started_at: z.string().datetime().optional(),
        ended_at: z.string().datetime().optional(),
        routine_id: z.string().uuid().optional(),
        exercises: z.array(LoggedExercise).min(1).max(50),
      },
    },
    async ({ name, started_at, ended_at, routine_id, exercises }) => {
      const { data, error } = await supabase.rpc("mcp_log_workout_session", {
        p_access_token: accessToken,
        p_name: name ?? null,
        p_started_at: started_at ?? null,
        p_ended_at: ended_at ?? null,
        p_routine_id: routine_id ?? null,
        p_exercises: exercises as McpLogExerciseItem[],
      });
      if (error) throw new Error(error.message);
      return jsonResult({ session_id: data });
    },
  );

  return server;
}
