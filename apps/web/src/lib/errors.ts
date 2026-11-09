// Better Auth error codes, in French. Anything else falls back to the server's message.
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou mot de passe incorrect.",
  INVALID_USERNAME_OR_PASSWORD: "Pseudo ou mot de passe incorrect.",
  INVALID_EMAIL: "Cette adresse e-mail n'est pas valide.",
  PASSWORD_TOO_SHORT: "Le mot de passe doit faire au moins 8 caractères.",
  PASSWORD_TOO_LONG: "Le mot de passe est trop long.",
  USER_ALREADY_EXISTS: "Un compte existe déjà avec cette adresse e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Un compte existe déjà avec cette adresse e-mail.",
  USERNAME_IS_ALREADY_TAKEN: "Ce pseudo est déjà pris.",
  USERNAME_TOO_SHORT: "Ce pseudo est trop court.",
  USERNAME_TOO_LONG: "Ce pseudo est trop long.",
  INVALID_USERNAME: "Ce pseudo contient des caractères non autorisés.",
  INVALID_DISPLAY_USERNAME: "Ce pseudo contient des caractères non autorisés.",
  INVALID_OTP: "Code incorrect.",
  OTP_EXPIRED: "Ce code a expiré. Demande un nouveau code.",
  TOO_MANY_ATTEMPTS: "Trop d'essais. Demande un nouveau code.",
  CHALLENGE_NOT_FOUND: "La demande de passkey a expiré. Réessaie.",
  PASSKEY_NOT_FOUND: "Cette passkey n'est liée à aucun compte.",
  AUTHENTICATION_FAILED: "La passkey n'a pas pu être vérifiée.",
};

export function authErrorMessage(
  error: { code?: string; message?: string; status?: number } | null | undefined,
) {
  if (!error) return "Une erreur est survenue.";
  if (error.status && error.status >= 500)
    return "Le serveur n'a pas pu répondre. Réessaie dans un instant.";
  return (error.code && MESSAGES[error.code]) || error.message || "Une erreur est survenue.";
}

/** The browser cancelled the WebAuthn prompt (user closed it): not worth an error message. */
export function isPasskeyCancel(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "AUTH_CANCELLED" || /abort|cancel|not allowed/i.test(error?.message ?? "");
}
