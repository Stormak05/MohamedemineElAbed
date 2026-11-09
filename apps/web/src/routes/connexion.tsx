import { PSEUDO_MAX } from "@clausus/auth/pseudo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { MenuButton, Screen } from "@/components/screen";
import { GOOGLE_CLIENT_ID, authClient, siteUrl } from "@/lib/auth-client";
import { authErrorMessage, isPasskeyCancel } from "@/lib/errors";
import { sfx } from "@/lib/game";
import { useGuest } from "@/lib/guest";
import { pseudoProblem } from "@/lib/pseudo";

export const Route = createFileRoute("/connexion")({
  component: ConnexionComponent,
});

type Tab = "code" | "pseudo" | "inscription";
const TABS: { id: Tab; label: string }[] = [
  { id: "code", label: "Code e-mail" },
  { id: "pseudo", label: "Mot de passe" },
  { id: "inscription", label: "Créer" },
];

type AuthError = { code?: string; message?: string; status?: number };
type Attempt = (run: () => Promise<{ error: AuthError | null }>) => Promise<void>;

function ConnexionComponent() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const guest = useGuest();
  const [tab, setTab] = useState<Tab>("code");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in: straight to the game (which sends to /pseudo if needed).
  useEffect(() => {
    if (session) navigate({ to: "/", replace: true });
  }, [session, navigate]);

  // Google One Tap, then the browser's passkey autofill on the pseudo field.
  useEffect(() => {
    if (GOOGLE_CLIENT_ID) void authClient.oneTap({ callbackURL: "/" });
    if (window.PublicKeyCredential?.isConditionalMediationAvailable) {
      void window.PublicKeyCredential.isConditionalMediationAvailable().then((ok) => {
        if (ok) void authClient.signIn.passkey({ autoFill: true });
      });
    }
  }, []);

  /** Runs one sign-in attempt: shows its error, or lets the session effect above open the game. */
  const attempt: Attempt = async (run) => {
    setBusy(true);
    setError(null);
    try {
      const { error: failed } = await run();
      if (failed && !isPasskeyCancel(failed)) {
        sfx("deny");
        setError(authErrorMessage(failed));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Entrer">
      <p>
        Avec un compte, tu peux sauvegarder ta partie et publier ton score. Il n'est pas obligatoire pour jouer.
      </p>
      <div className="acts">
        {GOOGLE_CLIENT_ID && (
          <MenuButton
            disabled={busy}
            onClick={() =>
              attempt(() =>
                authClient.signIn.social({
                  provider: "google",
                  callbackURL: siteUrl("/"),
                  newUserCallbackURL: siteUrl("/pseudo"),
                  errorCallbackURL: siteUrl("/connexion"),
                }),
              )
            }
          >
            <GoogleIcon />
            Continuer avec Google
          </MenuButton>
        )}
        <MenuButton disabled={busy} onClick={() => attempt(() => authClient.signIn.passkey())}>
          Utiliser une passkey
        </MenuButton>
      </div>

      <div className="head">ou</div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "tab on" : "tab"}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onMouseEnter={() => sfx("hover")}
            onClick={() => {
              sfx("click");
              setTab(t.id);
              setError(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "code" && <CodeForm busy={busy} attempt={attempt} onError={setError} />}
      {tab === "pseudo" && <PasswordForm busy={busy} attempt={attempt} />}
      {tab === "inscription" && <SignUpForm busy={busy} attempt={attempt} onError={setError} />}

      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}

      <div className="links center">
        <button className="link" type="button" onClick={() => navigate({ to: "/" })}>
          {guest ? "Retour au jeu" : "Retour à l'accueil"}
        </button>
      </div>
    </Screen>
  );
}

/** Sign in (or sign up) with a 6-digit code sent by e-mail. */
function CodeForm({
  busy,
  attempt,
  onError,
}: {
  busy: boolean;
  attempt: Attempt;
  onError: (m: string | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  if (!sentTo) {
    return (
      <form
        className="acts"
        onSubmit={async (event) => {
          event.preventDefault();
          await attempt(async () => {
            const result = await authClient.emailOtp.sendVerificationOtp({
              email,
              type: "sign-in",
            });
            if (!result.error) setSentTo(email);
            return result;
          });
        }}
      >
        <label className="lbl" htmlFor="otp-email">
          Adresse e-mail
          <input
            id="otp-email"
            className="field"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <MenuButton variant="primary" type="submit" disabled={busy}>
          Recevoir un code
        </MenuButton>
      </form>
    );
  }

  return (
    <form
      className="acts"
      onSubmit={(event) => {
        event.preventDefault();
        void attempt(() => authClient.signIn.emailOtp({ email: sentTo, otp }));
      }}
    >
      <p>
        Code envoyé à <b>{sentTo}</b>. Il expire dans 5 minutes.
      </p>
      <label className="lbl" htmlFor="otp-code">
        Code à 6 chiffres
        <input
          id="otp-code"
          className="field code"
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          minLength={6}
        />
      </label>
      <MenuButton variant="primary" type="submit" disabled={busy || otp.length < 6}>
        Entrer
      </MenuButton>
      <div className="links">
        <button
          className="link"
          type="button"
          onClick={() => {
            setSentTo(null);
            setOtp("");
            onError(null);
          }}
        >
          Changer d'adresse
        </button>
        <button
          className="link"
          type="button"
          disabled={busy}
          onClick={() =>
            attempt(() =>
              authClient.emailOtp.sendVerificationOtp({ email: sentTo, type: "sign-in" }),
            )
          }
        >
          Renvoyer le code
        </button>
      </div>
    </form>
  );
}

/** Pseudo (or e-mail) and password. The pseudo field also offers saved passkeys (autofill). */
function PasswordForm({ busy, attempt }: { busy: boolean; attempt: Attempt }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="acts"
      onSubmit={(event) => {
        event.preventDefault();
        const id = login.trim();
        void attempt(() =>
          id.includes("@")
            ? authClient.signIn.email({ email: id, password })
            : authClient.signIn.username({ username: id, password }),
        );
      }}
    >
      <label className="lbl" htmlFor="login">
        Pseudo ou e-mail
        <input
          id="login"
          className="field"
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          autoComplete="username webauthn"
          required
        />
      </label>
      <label className="lbl" htmlFor="password">
        Mot de passe
        <input
          id="password"
          className="field"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <MenuButton variant="primary" type="submit" disabled={busy}>
        Entrer
      </MenuButton>
    </form>
  );
}

/** New account with a pseudo, an e-mail and a password. */
function SignUpForm({
  busy,
  attempt,
  onError,
}: {
  busy: boolean;
  attempt: Attempt;
  onError: (m: string | null) => void;
}) {
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="acts"
      onSubmit={(event) => {
        event.preventDefault();
        const name = pseudo.trim();
        const problem = pseudoProblem(name);
        if (problem) {
          sfx("deny");
          onError(problem);
          return;
        }
        void attempt(() =>
          authClient.signUp.email({ email, password, name, username: name, displayUsername: name }),
        );
      }}
    >
      <label className="lbl" htmlFor="new-pseudo">
        Pseudo
        <input
          id="new-pseudo"
          className="field"
          value={pseudo}
          onChange={(event) => setPseudo(event.target.value)}
          autoComplete="username"
          maxLength={PSEUDO_MAX}
          required
        />
      </label>
      <label className="lbl" htmlFor="new-email">
        Adresse e-mail
        <input
          id="new-email"
          className="field"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </label>
      <label className="lbl" htmlFor="new-password">
        Mot de passe (8 caractères minimum)
        <input
          id="new-password"
          className="field"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <MenuButton variant="primary" type="submit" disabled={busy}>
        Créer mon compte
      </MenuButton>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
