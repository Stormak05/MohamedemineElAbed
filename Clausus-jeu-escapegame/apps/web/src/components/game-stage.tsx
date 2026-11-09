import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";

import { authClient, pseudoOf } from "@/lib/auth-client";
import { game } from "@/lib/game";
import { setGuest, useGuest } from "@/lib/guest";
import { client } from "@/utils/orpc";
import { toast } from "sonner";

type SaveData = Record<string, unknown>;
type Save = { data: SaveData; savedAt: Date } | null;

/**
 * The game (packages/game, static files under /game/), always mounted full screen behind the site's screens, so the
 * room renders behind welcome, sign-in, pseudo and account, and the game is not reloaded when they open or close.
 * Messages: the game sends clausus:ready / clausus:account / clausus:login / clausus:leaderboard / clausus:logout, and
 * clausus:publish (an escape to put on the leaderboard); the site sends clausus:player (pseudo, empty for a guest),
 * clausus:cover (one of its screens is over the game: menus hidden, nothing starts; `start` on the way out opens the
 * notice before the game instead of the main menu) and clausus:published (the answer to clausus:publish).
 * Saved games (signed-in players only, see the API's save.*): the site sends clausus:save (the player's save, or null);
 * the game sends clausus:save with a snapshot to keep (or data: null to drop it), the site answers clausus:saved (ok).
 * The site keeps the latest one in memory, so the game finds it again after reloading itself (main menu).
 */
type Run = {
  runId: string;
  ticket: string;
};

const PENDING = "clausus-pending-run";
const PENDING_SAVE = "clausus-pending-save";
const PENDING_SAVE_TTL = 30 * 60 * 1000; // a sign-in (OAuth, e-mail code) takes a few minutes at most

function savePending(run: Run) {
  try {
    sessionStorage.setItem(PENDING, JSON.stringify(run));
  } catch {
    // Lost with the page, then.
  }
}

function takePending(): Run | null {
  try {
    const raw = sessionStorage.getItem(PENDING);
    sessionStorage.removeItem(PENDING);
    return raw ? (JSON.parse(raw) as Run) : null;
  } catch {
    return null;
  }
}

export default function GameStage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: session } = authClient.useSession();
  const guest = useGuest();
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const pseudo = session?.user ? pseudoOf(session.user) : "";
  const covered = pathname !== "/" || (!pseudo && !(guest && !session));
  const userId = session?.user?.id ?? null;
  const user = useRef(userId);
  user.current = userId;
  // undefined: still loading. `gen` drops a load overtaken by a newer write or another player.
  const save = useRef<Save | undefined>(undefined);
  const gen = useRef(0);
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  const sendSave = useCallback(() => {
    const win = frame.current?.contentWindow;
    if (!win || save.current === undefined) return;
    win.postMessage({ type: "clausus:save", save: save.current }, window.location.origin);
  }, []);

  // Writes in order (a save then a reload to the main menu, a drop then a new game), each one answered to the game.
  const store = useCallback((data: SaveData | null) => {
    if (!user.current) return;
    const owner = user.current;
    gen.current++;
    save.current = data ? { data, savedAt: new Date() } : null;
    writes.current = writes.current.then(async () => {
      // A queued write belongs to the account that requested it.
      if (user.current !== owner) return;
      let ok = true;
      try {
        if (data) await client.save.put({ data });
        else await client.save.clear();
      } catch {
        ok = false;
      }
      if (user.current !== owner) return;
      frame.current?.contentWindow?.postMessage(
        { type: "clausus:saved", ok },
        window.location.origin,
      );
    });
  }, []);

  useEffect(() => {
    const mine = ++gen.current;
    save.current = userId ? undefined : null;
    if (!userId) return sendSave();
    // A requested guest save survives an OAuth round trip (the iframe itself is reloaded).
    try {
      const raw = sessionStorage.getItem(PENDING_SAVE);
      sessionStorage.removeItem(PENDING_SAVE);
      if (raw) {
        // Only a sign-in started from the game just now: an old abandoned attempt must not replace the account's save.
        const entry = JSON.parse(raw);
        const pending = typeof entry?.at === "number" && Date.now() - entry.at < PENDING_SAVE_TTL ? entry.data : null;
        if (pending && typeof pending === "object" && !Array.isArray(pending)) {
          store(pending);
          sendSave();
          return;
        }
      }
    } catch {
      // Storage unavailable or invalid: load the existing account save instead.
    }
    client.save
      .get()
      .catch(() => null)
      .then((got) => {
        if (mine !== gen.current) return;
        save.current = got;
        sendSave();
      });
  }, [userId, sendSave, store]);

  const send = useCallback(() => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    // `start` only once the game listens (clausus:ready), else it would be lost.
    const start = !covered && game.startNext && ready.current;
    if (start) game.startNext = false;
    win.postMessage({ type: "clausus:cover", on: covered, start }, window.location.origin);
    win.postMessage({ type: "clausus:player", pseudo }, window.location.origin);
  }, [covered, pseudo]);

  useEffect(send, [send]);

  // An escape the player chose to publish: sent with their session, then the leaderboard opens on their row.
  const publish = useCallback(
    async (run: Run) => {
      const answer = (ok: boolean) =>
        frame.current?.contentWindow?.postMessage(
          { type: "clausus:published", runId: run.runId, ok },
          window.location.origin,
        );
      // A guest (or a player without a pseudo yet): kept, sent to sign in, published once there (effect below).
      if (!pseudo) {
        savePending(run);
        answer(false);
        toast("Connecte-toi pour publier ton score. Il sera envoyé dès que tu seras connecté.");
        navigate({ to: "/connexion" });
        return;
      }
      try {
        const saved = await client.scores.publish({ ticket: run.ticket });
        answer(true);
        toast.success(`Score publié : ${saved.points} pts.`);
        navigate({ to: "/classement", search: { score: saved.id } });
      } catch {
        answer(false);
        toast.error("Le score n'a pas pu être publié. Réessaie depuis le menu.");
      }
    },
    [navigate, pseudo],
  );

  // Signed in with a pseudo while an escape waits (kept for the tab, so a Google sign-in's reload keeps it too).
  useEffect(() => {
    if (!pseudo) return;
    const run = takePending();
    if (run) void publish(run);
  }, [pseudo, publish]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow)
        return;
      const data = event.data as {
        type?: string;
        run?: Run;
        data?: unknown;
        requestId?: string;
        action?: string;
        input?: unknown;
      } | null;
      const type = data?.type;
      if (type === "clausus:rank" && typeof data?.requestId === "string") {
        const win = event.source as Window;
        const requestId = data.requestId;
        const request =
          data.action === "begin"
            ? client.scores.begin()
            : data.action === "finish"
              ? client.scores.finish(data.input as Parameters<typeof client.scores.finish>[0])
              : Promise.reject(new Error("Unknown ranking action"));
        void request
          .then(({ ticket }) => {
            win.postMessage({ type: "clausus:ranked", requestId, ticket }, window.location.origin);
          })
          .catch(() => {
            win.postMessage(
              { type: "clausus:ranked", requestId, ticket: null },
              window.location.origin,
            );
          });
      } else if (type === "clausus:ready") {
        ready.current = true;
        send();
        sendSave();
      } else if (type === "clausus:save") {
        const snap = data?.data;
        store(snap && typeof snap === "object" ? (snap as SaveData) : null);
      } else if (type === "clausus:account") navigate({ to: "/compte" });
      else if (type === "clausus:login") {
        try {
          if (data?.data && typeof data.data === "object")
            sessionStorage.setItem(PENDING_SAVE, JSON.stringify({ at: Date.now(), data: data.data }));
          else sessionStorage.removeItem(PENDING_SAVE);
        } catch {
          toast.error("La partie ne pourra pas être conservée si la connexion recharge la page.");
        }
        navigate({ to: "/connexion" });
      } else if (type === "clausus:leaderboard") navigate({ to: "/classement" });
      else if (type === "clausus:publish" && data?.run) publish(data.run);
      else if (type === "clausus:logout") {
        authClient.signOut().finally(() => {
          setGuest(false);
          navigate({ to: "/", replace: true });
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate, send, sendSave, store, publish]);

  // Back to the game: give it the keyboard.
  useEffect(() => {
    if (!covered) frame.current?.focus();
  }, [covered]);

  return (
    <iframe
      ref={(el) => {
        frame.current = el;
        game.frame = el;
      }}
      className="cl-game"
      src={`/game/index.html${window.location.search}`}
      title="Clausus"
      tabIndex={covered ? -1 : 0}
      aria-hidden={covered}
      allow="fullscreen; autoplay; gamepad; screen-wake-lock; clipboard-write"
      allowFullScreen
      onLoad={() => {
        send();
        sendSave();
      }}
    />
  );
}
