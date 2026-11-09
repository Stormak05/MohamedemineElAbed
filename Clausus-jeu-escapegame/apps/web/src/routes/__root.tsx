import { Toaster } from "@clausus/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";

import GameStage from "@/components/game-stage";
import type { orpc } from "@/utils/orpc";

import "../index.css";

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      { title: "Clausus" },
      {
        name: "description",
        content:
          "Clausus, jeu d'horreur psychologique : un patient enfermé dans la chambre 104, la nuit.",
      },
    ],
  }),
});

// The game stays mounted behind every page; each page is a screen over it (or nothing, at /).
function RootComponent() {
  return (
    <>
      <HeadContent />
      <GameStage />
      <Outlet />
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{ classNames: { toast: "cl-toast" } }}
      />
    </>
  );
}
