// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Novedades por versión. Es la fuente de verdad de la versión de la app: no se
 * lee `package.json` a propósito (está en 0.1.0 y no lo consume nadie, así que
 * acoplarlos sólo agrega una segunda cosa que se olvida de actualizar).
 *
 * Al agregar un release, ponelo PRIMERO en el array. `notable: true` sólo si
 * vale la pena interrumpir a alguien con un popup: los arreglos chicos entran
 * igual a la lista pero no lo disparan. Ver WhatsNewModal.
 */
export interface Release {
  version: string;
  /** ISO YYYY-MM-DD. */
  date: string;
  /** Dispara el popup de novedades. Sin esto, la entrada sólo queda listada. */
  notable?: boolean;
  items: string[];
}

/** Más nueva primero. `CHANGELOG[0].version` es la versión actual. */
export const CHANGELOG: Release[] = [
  {
    version: "0.4.1",
    date: "2026-11-25",
    notable: true,
    items: [
      "La conexión con tu IA ya no se corta cada hora: una vez que la autorizás, queda conectada sin que tengas que volver a iniciar sesión.",
      "Si tu IA dejó de responder en estos días, reconectala una vez desde los conectores de tu asistente y listo.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-11-18",
    notable: true,
    items: [
      "Ya podés conectar tu propia IA (Claude, ChatGPT, etc.) a WOLF: entrá a Mi perfil, copiá el link y pegalo en los conectores de tu asistente. Te va a pedir iniciar sesión y confirmar el acceso.",
      "Una vez conectada, tu IA puede ver tu catálogo de ejercicios y tu progreso, armar o editar tus rutinas, y registrar tus entrenamientos por vos — reemplaza tener que descargar el Excel y volver a subirlo a mano.",
      "Desde Mi perfil vas a ver qué IA están conectadas a tu cuenta, y podés desconectarlas cuando quieras.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-09-20",
    notable: true,
    items: [
      "La sugerencia de carga ahora cruza reps y RIR: te dice si subir el peso, bajarlo, o si el peso está bien y lo que faltó fueron las reps.",
      "Cada objetivo tiene su rango de reps y de RIR; los ves en el ⓘ de cada serie.",
      "Si el plan de una serie queda fuera del rango de tu objetivo, la app lo avisa en vez de acompañarlo — en la sesión y en el editor de rutina.",
      "El cronómetro de descanso ya no se pierde: sobrevive a salir de la pantalla, recargar y cerrar la app. Sólo lo corta el botón, que ahora dice “Comenzar”.",
      "Los ejercicios por tiempo se cargan en dos campos, minutos y segundos, sin depender de que el teclado tenga “:”.",
      "Los músculos de cada ejercicio se muestran igual en la ficha, en la rutina y en las métricas; los que creaste vos se pueden corregir a mano.",
      "“Proximidad al fallo” pasa a listar sólo los músculos fuera de la zona de RIR, y dice qué porcentaje de tus series tiene el RIR cargado.",
      "El Excel exporta tus comentarios y notas, y trae una pestaña que explica cada columna.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-09-03",
    notable: true,
    items: [
      "Los campos de peso y reps arrancan vacíos: lo que escribís es lo que hiciste, y en gris ves lo de la última vez.",
      "El plan de cada serie queda visible toda la sesión en el chip ⓘ, incluso después de cargar el peso.",
      "La caja del peso se pinta si las reps se alejan del plan, y te dice si conviene subir o bajar la carga.",
      "El ejercicio se marca en dorado cuando superás lo de la última vez.",
      "Las zonas de RIR y las series efectivas ahora dependen de tu objetivo: para fuerza no hace falta llegar al fallo.",
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0]?.version ?? "0.0.0";

/** Clave de localStorage, con el prefijo `wot-` del resto de la app. */
export const SEEN_VERSION_KEY = "wot-seen-version";

/** Orden de versiones semver simple ("0.10.0" > "0.9.0", que un compare de strings invierte). */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Releases notables posteriores a `seen`. Si el usuario se salteó versiones se
 * juntan en un solo popup en vez de encadenarse de a uno.
 */
export function releasesSince(seen: string): Release[] {
  return CHANGELOG.filter(
    (r) => r.notable && compareVersions(r.version, seen) > 0,
  );
}
