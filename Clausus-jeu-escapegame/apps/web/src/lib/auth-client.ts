import { passkeyClient } from "@better-auth/passkey/client";
import { emailOTPClient, oneTapClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ENV } from "../env";

export const GOOGLE_CLIENT_ID = ENV.VITE_GOOGLE_CLIENT_ID || "";

export const authClient = createAuthClient({
  baseURL: ENV.VITE_SERVER_URL,
  plugins: [
    usernameClient(),
    emailOTPClient(),
    passkeyClient(),
    // Only prompted when GOOGLE_CLIENT_ID is set (see routes/connexion.tsx).
    oneTapClient({ clientId: GOOGLE_CLIENT_ID, promptOptions: { maxAttempts: 1 } }),
  ],
});

/** The name shown in game: the pseudo as typed, else its lowercase form. */
export function pseudoOf(user: { username?: string | null; displayUsername?: string | null }) {
  return user.displayUsername || user.username || "";
}

/** Absolute URL of a page of this site, for OAuth redirects (the API lives on another domain). */
export function siteUrl(path: string) {
  return new URL(path, window.location.origin).toString();
}
