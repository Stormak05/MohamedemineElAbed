import { kitCss, skinCss } from "@clausus/game/ui-kit.js";

// The game's menu kit (packages/game/ui-kit.js) applied to the site's screens, under .cl-menus.
// Same fallback CSS first, then the painted skins of /game/ui/ once ui_spec.json is loaded, exactly as in the game.
export const KIT_SCOPE = ".cl-menus";

export function installKit() {
  const style = document.createElement("style");
  style.textContent = kitCss(KIT_SCOPE, ".mb");
  document.head.append(style);
  fetch("/game/ui/ui_spec.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((spec) => {
      if (spec) style.textContent += skinCss(spec, KIT_SCOPE, ".mb", "/game/ui/");
    })
    .catch(() => {});
}
