// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Traducción de errores de Supabase Auth al español. Se usa en login y en
 * reset-password. Nunca devuelve el texto crudo: si no reconoce el mensaje,
 * cae a un genérico en español.
 */

const RATE_LIMIT_ES =
  "Se enviaron demasiados mails a esta dirección. Esperá unos minutos y volvé a intentar.";
const EXPIRED_ES = "El link venció o ya se usó. Pedí uno nuevo.";

export const AUTH_ERROR_ES: Record<string, string> = {
  // El callback redirige con ?error=auth cuando no pudo canjear el código.
  auth: "No pudimos validar el link. Pedí uno nuevo.",
  otp_expired: EXPIRED_ES,
  expired: EXPIRED_ES,
  "Token has expired or is invalid": EXPIRED_ES,
  "Email link is invalid or has expired": EXPIRED_ES,
  "Invalid login credentials": "Mail o contraseña incorrectos.",
  "User already registered": "Ya existe una cuenta con ese mail. Iniciá sesión.",
  "Password should be at least 6 characters.":
    "La contraseña tiene que tener al menos 6 caracteres.",
  "Email not confirmed":
    "Confirmá tu mail antes de entrar (revisá tu bandeja).",
  "Auth session missing": "Tu sesión venció. Pedí un link nuevo.",
  "Auth session missing!": "Tu sesión venció. Pedí un link nuevo.",
  "Email rate limit exceeded": RATE_LIMIT_ES,
  "email rate limit exceeded": RATE_LIMIT_ES,
};

export const AUTH_GENERIC_ERROR_ES =
  "Algo salió mal. Probá de nuevo en un momento.";

export function translateError(message: string): string {
  if (AUTH_ERROR_ES[message]) return AUTH_ERROR_ES[message];
  if (/rate limit exceeded/i.test(message)) return RATE_LIMIT_ES;
  const cooldown = message.match(/after (\d+) seconds/i);
  if (cooldown) {
    return `Por seguridad, esperá ${cooldown[1]} segundos antes de volver a pedir el mail.`;
  }
  if (/new password should be different/i.test(message)) {
    return "La contraseña nueva tiene que ser distinta de la anterior.";
  }
  // El link se abrió en otro navegador que el que lo pidió (típico: el
  // navegador interno de la app de mail en el celular): el code_verifier de
  // PKCE vive en las cookies del navegador original.
  if (/code verifier not found/i.test(message)) {
    return "Abrí el link en el mismo navegador donde lo pediste (no en la app del mail), o pedí uno nuevo desde ahí.";
  }
  if (/auth session missing/i.test(message)) {
    return AUTH_ERROR_ES["Auth session missing"];
  }
  if (/expired|invalid or has expired/i.test(message)) return EXPIRED_ES;
  if (/email not confirmed/i.test(message)) {
    return AUTH_ERROR_ES["Email not confirmed"];
  }
  if (/failed to fetch|network/i.test(message)) {
    return "No pudimos conectarnos. Revisá tu conexión.";
  }
  return AUTH_GENERIC_ERROR_ES;
}
