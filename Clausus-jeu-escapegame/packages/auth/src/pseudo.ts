// Rules for a player's pseudo, shared by the server (username plugin) and the web forms.
export const PSEUDO_MIN = 3;
export const PSEUDO_MAX = 20;
const PSEUDO_RE = /^[a-zA-Z0-9_.-]+$/;

export function isValidPseudo(pseudo: string) {
  return PSEUDO_RE.test(pseudo);
}
