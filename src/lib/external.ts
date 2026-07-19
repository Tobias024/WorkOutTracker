/**
 * Abre un enlace externo en una pestaña nueva, pero pide confirmación antes
 * (la app no navega sola fuera del sitio). Se usa para las citas de papers.
 */
export function openExternal(url: string) {
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    // url sin protocolo válido → se muestra tal cual en el confirm
  }
  if (
    typeof window !== "undefined" &&
    window.confirm(`Vas a salir de la app hacia ${host}. ¿Continuar?`)
  ) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
