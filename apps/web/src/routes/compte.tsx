import { PSEUDO_MAX } from "@clausus/auth/pseudo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { MenuButton, Screen } from "@/components/screen";
import { authClient, pseudoOf } from "@/lib/auth-client";
import { authErrorMessage, isPasskeyCancel } from "@/lib/errors";
import { sfx } from "@/lib/game";
import { setGuest } from "@/lib/guest";
import { savePseudo } from "@/lib/pseudo";
import { usePlayer } from "@/lib/use-player";

export const Route = createFileRoute("/compte")({
  component: CompteComponent,
});

// Account, as a screen over the game (opened from the game's main menu): the game is not reloaded.
function CompteComponent() {
  const navigate = useNavigate();
  const player = usePlayer("pseudo");
  if (!player) return <Loader />;

  const email =
    player.user.email && !player.user.email.endsWith(".invalid") ? player.user.email : null;

  return (
    <Screen title="Ton compte">
      <p>
        Connecté en tant que <b>{pseudoOf(player.user)}</b>
        {email ? ` (${email})` : ""}.
      </p>

      <div className="head">Pseudo</div>
      <PseudoSection current={pseudoOf(player.user)} />

      <div className="head">Passkeys</div>
      <PasskeySection />

      <div className="acts row">
        <MenuButton variant="primary" onClick={() => navigate({ to: "/" })}>
          Retour au jeu
        </MenuButton>
      </div>
      <div className="acts row">
        <MenuButton
          variant="small"
          onClick={() =>
            authClient.signOut().finally(() => {
              setGuest(false);
              navigate({ to: "/", replace: true });
            })
          }
        >
          Se déconnecter
        </MenuButton>
      </div>
    </Screen>
  );
}

function PseudoSection({ current }: { current: string }) {
  const [pseudo, setPseudo] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="acts"
      onSubmit={async (event) => {
        event.preventDefault();
        const next = pseudo.trim();
        if (next === current) return;
        setBusy(true);
        const problem = await savePseudo(next);
        setBusy(false);
        setError(problem);
        if (problem) sfx("deny");
        else toast.success(`Ton pseudo est maintenant ${next}.`);
      }}
    >
      <input
        id="pseudo"
        className="field"
        aria-label="Pseudo"
        value={pseudo}
        onChange={(event) => {
          setPseudo(event.target.value);
          setError(null);
        }}
        autoComplete="username"
        maxLength={PSEUDO_MAX}
        required
      />
      {error && <p className="err">{error}</p>}
      <MenuButton type="submit" disabled={busy || pseudo.trim() === current}>
        Changer de pseudo
      </MenuButton>
    </form>
  );
}

function PasskeySection() {
  const { data: passkeys, isPending, refetch } = authClient.useListPasskeys();
  const [busy, setBusy] = useState(false);

  return (
    <div className="acts">
      <p className="note">
        Une passkey te connecte avec l'empreinte, le visage ou le code de ton appareil, sans mot de
        passe.
      </p>
      {!isPending && passkeys && passkeys.length > 0 && (
        <ul className="list">
          {passkeys.map((key) => (
            <li key={key.id}>
              <span>
                {key.name || "Passkey"}
                {key.createdAt ? ` · ${new Date(key.createdAt).toLocaleDateString("fr-FR")}` : ""}
              </span>
              <button
                className="link"
                type="button"
                onClick={async () => {
                  const { error } = await authClient.passkey.deletePasskey({ id: key.id });
                  if (error) toast.error(authErrorMessage(error));
                  else refetch();
                }}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      <MenuButton
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const result = await authClient.passkey.addPasskey({ name: deviceName() });
          setBusy(false);
          if (result?.error) {
            if (!isPasskeyCancel(result.error)) toast.error(authErrorMessage(result.error));
          } else {
            toast.success("Passkey ajoutée.");
            refetch();
          }
        }}
      >
        Ajouter une passkey
      </MenuButton>
    </div>
  );
}

function deviceName() {
  const ua = navigator.userAgent;
  const known: [RegExp, string][] = [
    [/iPhone/, "iPhone"],
    [/iPad/, "iPad"],
    [/Android/, "Android"],
    [/Mac OS X/, "Mac"],
    [/Windows/, "Windows"],
    [/Linux/, "Linux"],
  ];
  return known.find(([re]) => re.test(ua))?.[1] ?? "Appareil";
}
