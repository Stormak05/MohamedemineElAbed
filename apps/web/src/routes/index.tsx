import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import Loader from "@/components/loader";
import { MenuButton, Screen } from "@/components/screen";
import { authClient } from "@/lib/auth-client";
import { game, sfx } from "@/lib/game";
import { setGuest, useGuest } from "@/lib/guest";

export const Route = createFileRoute("/")({
  component: PlayComponent,
});

// The game itself is in the root layout (components/game-stage.tsx). Here: the welcome screen for a visitor (what the
// game is, how to play, then play with or without an account), nothing once signed in with a pseudo or playing as a
// guest, /pseudo for a signed-in player without one.
function PlayComponent() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const guest = useGuest();
  const needsPseudo = Boolean(session && !session.user.username);

  useEffect(() => {
    if (needsPseudo) navigate({ to: "/pseudo", replace: true });
  }, [needsPseudo, navigate]);

  if (session ? !needsPseudo : guest) return null;
  if (isPending || needsPseudo) return <Loader />;
  return <Welcome />;
}

const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

function Welcome() {
  return (
    <Screen title="Chambre 104" wide>
      <p>
        Tu te réveilles en pleine nuit, enfermé dans la chambre 104 d'un hôpital psychiatrique.{" "}
        <b>Clausus</b> est un jeu d'horreur psychologique à la première personne, sur ordinateur ou
        sur téléphone.
      </p>

      <div className="head">Comment jouer</div>
      <ol className="cl-steps">
        <li>Fouille la chambre, puis l'hôpital : clés, codes et pièces sont cachés dans le décor.</li>
        <li>Ta santé mentale baisse avec le temps. Un cachet la fait remonter, et il y en a peu.</li>
        <li>Une pièce glissée dans un téléphone payant te donne un indice.</li>
        <li>Résous les énigmes pour sortir de l'hôpital.</li>
      </ol>

      <p className="note">
        {touch
          ? "Pouce gauche pour marcher, pouce droit pour regarder, toucher un objet pour l'utiliser."
          : "ZQSD ou WASD pour marcher, la souris pour regarder, E ou clic pour interagir, Échap pour la pause."}{" "}
        Avec un casque, c'est mieux.
      </p>

      <div className="acts">
        <MenuButton
          variant="primary"
          onClick={() => {
            game.startNext = true;
            setGuest(true);
          }}
        >
          Jouer
        </MenuButton>
        <Link
          to="/connexion"
          className="mb"
          onMouseEnter={() => sfx("hover")}
          onClick={() => sfx("click")}
        >
          Se connecter
        </Link>
      </div>
      <p className="note">
        Pas besoin de compte pour jouer. Avec un compte, tu peux sauvegarder ta partie et publier ton score.
      </p>
    </Screen>
  );
}
