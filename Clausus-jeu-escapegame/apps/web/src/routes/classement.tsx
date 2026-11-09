import { formatTime } from "@clausus/game/score.js";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useRef } from "react";

import Loader from "@/components/loader";
import { MenuButton, Screen } from "@/components/screen";
import { usePlayer } from "@/lib/use-player";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/classement")({
  component: ClassementComponent,
  // ?score=<id>: the escape just published, highlighted.
  validateSearch: (search: Record<string, unknown>): { score?: string } =>
    typeof search.score === "string" ? { score: search.score } : {},
});

// The leaderboard, as a screen over the game (from its main menu, pause menu, end screen, or after publishing):
// each player's best escape from the hospital.
function ClassementComponent() {
  const navigate = useNavigate();
  const player = usePlayer("pseudo");
  const { score: published } = Route.useSearch();
  const board = useQuery({ ...orpc.scores.leaderboard.queryOptions(), enabled: Boolean(player) });
  const mineRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (board.data) mineRef.current?.scrollIntoView({ block: "nearest" });
  }, [board.data]);

  if (!player) return <Loader />;

  const rows = board.data?.rows ?? [];
  const mine = rows.find((r) => r.mine);
  const best = published && mine && mine.id !== published;

  return (
    <Screen title="Classement">
      <p>Le meilleur score de chaque joueur.</p>
      {mine && (
        <p>
          Ton meilleur : <b>{mine.rank}ᵉ</b> sur {board.data?.players}, avec{" "}
          <b>{mine.points} pts</b> en {formatTime(mine.seconds)}.
          {best ? " Ton score publié ne bat pas ce record." : ""}
        </p>
      )}

      {board.isPending && <p className="note">Chargement…</p>}
      {board.isError && <p className="err">Le classement n'a pas pu être chargé.</p>}
      {board.data && rows.length === 0 && (
        <p className="note">
          Personne n'a encore publié d'évasion. Sors de l'hôpital, puis publie ton score depuis
          l'écran de fin.
        </p>
      )}
      {rows.length > 0 && (
        <div className="cl-board">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Joueur</th>
                <th>Score</th>
                <th>Temps</th>
                <th title="Indices (appels au téléphone)">Ind.</th>
                <th title="Erreurs">Err.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <Fragment key={r.id}>
                  {i > 0 && r.rank !== rows[i - 1]!.rank + 1 && (
                    <tr className="gap">
                      <td colSpan={6}>…</td>
                    </tr>
                  )}
                  <tr
                    ref={r.mine ? mineRef : undefined}
                    className={[r.mine && "mine", r.rank <= 3 && `podium p${r.rank}`]
                      .filter(Boolean)
                      .join(" ")}
                    title={`${new Date(r.createdAt).toLocaleDateString("fr-FR")} · ${r.pills} cachet(s) · santé ${Math.round(r.sanity * 100)} %`}
                  >
                    <td>{r.rank}</td>
                    <td className="who">{r.pseudo}</td>
                    <td className="pts">{r.points}</td>
                    <td>{formatTime(r.seconds)}</td>
                    <td>{r.hints}</td>
                    <td>{r.errors}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">
        Score : 10 000 − 5 par seconde − 500 par indice − 100 par erreur + 10 par % de santé mentale
        restante. Les parties aidées par les options développeur ne sont pas classées.
      </p>

      <div className="acts row">
        <MenuButton variant="primary" onClick={() => navigate({ to: "/" })}>
          Retour au jeu
        </MenuButton>
      </div>
    </Screen>
  );
}
