// The game's frame (components/game-stage.tsx), shared so the site's screens can play the menus' sounds.
// `startNext`: the next time the game is uncovered, open the notice before the game rather than the main menu
// (the welcome screen's "Jouer" already stands for the main menu's "Commencer").
export const game: { frame: HTMLIFrameElement | null; startNext: boolean } = {
  frame: null,
  startNext: false,
};

type GameWindow = Window & { __clausus?: { audio?: { ui?: (kind: string) => void } } };

/** Menu sound of the game ("hover", "click", "deny"...); silent until the game has loaded or if audio is blocked. */
export function sfx(kind: "hover" | "click" | "deny") {
  try {
    (game.frame?.contentWindow as GameWindow | null)?.__clausus?.audio?.ui?.(kind);
  } catch {
    // Audio is a nicety here.
  }
}
