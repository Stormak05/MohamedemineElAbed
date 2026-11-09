import { PSEUDO_MAX } from "@clausus/auth/pseudo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import Loader from "@/components/loader";
import { MenuButton, Screen } from "@/components/screen";
import { pseudoOf } from "@/lib/auth-client";
import { sfx } from "@/lib/game";
import { savePseudo } from "@/lib/pseudo";
import { usePlayer } from "@/lib/use-player";

export const Route = createFileRoute("/pseudo")({
  component: PseudoComponent,
});

/** A pseudo suggestion from a Google name ("Jean Dupont" → "JeanDupont"). */
function suggest(name: string) {
  return name
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .slice(0, PSEUDO_MAX);
}

function PseudoComponent() {
  const navigate = useNavigate();
  const player = usePlayer("session");
  const [saved, setSaved] = useState(false);
  const hasPseudo = Boolean(player?.user.username);

  // Into the game once the refreshed session carries the pseudo (before that, / would send back here).
  useEffect(() => {
    if (saved && hasPseudo) navigate({ to: "/", replace: true });
  }, [saved, hasPseudo, navigate]);

  if (!player) return <Loader />;
  return (
    <PseudoForm
      initial={pseudoOf(player.user) || suggest(player.user.name ?? "")}
      onDone={() => setSaved(true)}
    />
  );
}

function PseudoForm({ initial, onDone }: { initial: string; onDone: () => void }) {
  const [pseudo, setPseudo] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Screen title="Ton pseudo">
      <form
        className="acts"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const problem = await savePseudo(pseudo.trim());
          setBusy(false);
          if (problem) {
            sfx("deny");
            setError(problem);
          } else onDone();
        }}
      >
        <p>C'est le nom que verront les autres joueurs. Tu pourras le changer dans ton compte.</p>
        <label className="lbl" htmlFor="pseudo">
          Pseudo
          <input
            id="pseudo"
            className="field"
            value={pseudo}
            onChange={(event) => {
              setPseudo(event.target.value);
              setError(null);
            }}
            autoComplete="username"
            autoFocus
            maxLength={PSEUDO_MAX}
            required
          />
        </label>
        {error && <p className="err">{error}</p>}
        <MenuButton variant="primary" type="submit" disabled={busy}>
          Entrer
        </MenuButton>
      </form>
    </Screen>
  );
}
