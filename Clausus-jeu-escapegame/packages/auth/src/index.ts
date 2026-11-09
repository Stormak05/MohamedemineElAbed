import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { passkey } from "@better-auth/passkey";
import type { Database } from "@clausus/db";
import * as schema from "@clausus/db/schema/auth";
// Re-exported so the declaration of createAuth can name the passkey types (TS2883).
export type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import { betterAuth } from "better-auth";
import { emailOTP, oneTap, username } from "better-auth/plugins";

import { createOtpSender, type EmailConfig } from "./email";
import { PSEUDO_MAX, PSEUDO_MIN, isValidPseudo } from "./pseudo";

export { PSEUDO_MAX, PSEUDO_MIN, isValidPseudo } from "./pseudo";

export type AuthConfig = EmailConfig & {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  /** Public URL of the web app (the game). Also the passkey origin. */
  CORS_ORIGIN: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

export function createAuth(env: AuthConfig, database: Database) {
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      : null;

  return betterAuth({
    appName: "Clausus",
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    socialProviders: google ? { google: { ...google, prompt: "select_account" } } : {},
    account: {
      // A Google account with the same verified e-mail joins the existing player.
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [
      // The player's pseudo: unique, case-insensitive (displayUsername keeps the case they typed).
      username({
        minUsernameLength: PSEUDO_MIN,
        maxUsernameLength: PSEUDO_MAX,
        usernameValidator: isValidPseudo,
      }),
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        sendVerificationOTP: createOtpSender(env),
      }),
      passkey({
        rpID: new URL(env.CORS_ORIGIN).hostname,
        rpName: "Clausus",
        origin: env.CORS_ORIGIN,
      }),
      ...(google ? [oneTap({ clientId: google.clientId })] : []),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
