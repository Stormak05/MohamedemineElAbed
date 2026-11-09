import { PSEUDO_MAX, PSEUDO_MIN, isValidPseudo } from "@clausus/auth/pseudo";

import { authClient } from "./auth-client";
import { authErrorMessage } from "./errors";

/** Local check before asking the server; null when the pseudo looks fine. */
export function pseudoProblem(pseudo: string) {
  if (pseudo.length < PSEUDO_MIN) return `Au moins ${PSEUDO_MIN} caractères.`;
  if (pseudo.length > PSEUDO_MAX) return `Au plus ${PSEUDO_MAX} caractères.`;
  if (!isValidPseudo(pseudo)) return "Lettres, chiffres, point, tiret et tiret bas uniquement.";
  return null;
}

/** Sets the signed-in player's pseudo. Returns an error message, or null on success. */
export async function savePseudo(pseudo: string) {
  const problem = pseudoProblem(pseudo);
  if (problem) return problem;
  const available = await authClient.isUsernameAvailable({ username: pseudo });
  if (available.data && !available.data.available) return "Ce pseudo est déjà pris.";
  const { error } = await authClient.updateUser({ username: pseudo, displayUsername: pseudo });
  if (error) return authErrorMessage(error);
  // Refetch the session: pages wait for the pseudo to show up in it (see routes/pseudo.tsx).
  authClient.$store.notify("$sessionSignal");
  return null;
}
