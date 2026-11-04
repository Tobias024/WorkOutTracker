// SPDX-License-Identifier: AGPL-3.0-only

/**
 * UUID v4 generado en el cliente. `crypto.randomUUID` solo existe en contextos
 * seguros (https/localhost); en http://192.168.x.x desde el celular no está,
 * así que se arma a mano con `crypto.getRandomValues`.
 */
export function newId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; // versión 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h
    .slice(6, 8)
    .join("")}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`;
}
