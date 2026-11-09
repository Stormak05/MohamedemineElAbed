import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { authClient } from "./auth-client";

type Need = "session" | "pseudo";

/**
 * The signed-in player, or a redirect: to /connexion without a session, to /pseudo without a pseudo (need = "pseudo").
 * Once a session has been seen, a background refetch never hides the page again.
 */
export function usePlayer(need: Need) {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const last = useRef(session);
  if (session) last.current = session;
  const current = session ?? (isPending ? last.current : null);

  useEffect(() => {
    if (isPending) return;
    if (!session) navigate({ to: "/connexion", replace: true });
    else if (need === "pseudo" && !session.user.username)
      navigate({ to: "/pseudo", replace: true });
  }, [isPending, session, need, navigate]);

  if (!current || (need === "pseudo" && !current.user.username)) return null;
  return current;
}
