import { cpSync, createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Le jeu Three.js (packages/game) est fait de fichiers statiques : il est servi tel quel sous /game/.
const GAME_DIR = resolve(__dirname, "../../packages/game");
const GAME_BASE = "/game/";
const GAME_TYPES: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

function claususGame(): Plugin {
  let outDir = "dist";
  return {
    name: "clausus-game",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    // Dev : les sources du jeu sont servies directement, sans build.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname === "/game") {
          res.writeHead(301, { Location: GAME_BASE });
          res.end();
          return;
        }
        if (!url.pathname.startsWith(GAME_BASE)) return next();
        let file = resolve(
          join(GAME_DIR, decodeURIComponent(url.pathname.slice(GAME_BASE.length))),
        );
        if (file !== GAME_DIR && !file.startsWith(GAME_DIR + sep)) return next();
        if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
        if (!existsSync(file)) return next();
        res.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": GAME_TYPES[extname(file)] ?? "application/octet-stream",
        });
        createReadStream(file).pipe(res);
      });
    },
    // Build : on recopie le build du jeu (fichiers d'exécution uniquement) dans dist/game.
    closeBundle() {
      const gameDist = join(GAME_DIR, "dist");
      if (!existsSync(gameDist)) {
        throw new Error(
          "packages/game/dist est absent : lancer le build via turbo (bun run build).",
        );
      }
      cpSync(gameDist, join(outDir, "game"), { recursive: true });
    },
  };
}

// Aperçu de lien : Discord et les autres robots exigent des URL absolues dans og:url, og:image et twitter:image.
// - build : préfixées par VITE_SITE_URL, sinon par l'URL publique que donne l'hébergeur (Vercel, Netlify,
//   Cloudflare Pages, Render, Railway) ;
// - dev et preview (vite, vite preview, tunnel) : préfixées par l'hôte de la requête, à chaque chargement.
const SHARE_META =
  /(<meta\s+(?:property|name)="(?:og:url|og:image|twitter:image)"\s+content=")\/([^"]*)"/g;

function absolutize(html: string, site: string) {
  return html.replace(SHARE_META, (_, start: string, path: string) => `${start}${site}/${path}"`);
}

function siteFromEnv(env: Record<string, string | undefined>) {
  const e = { ...process.env, ...env };
  const withProto = (host?: string) => (host ? `https://${host}` : undefined);
  const site =
    e.VITE_SITE_URL ||
    withProto(e.VERCEL_PROJECT_PRODUCTION_URL) ||
    e.URL || // Netlify
    e.CF_PAGES_URL ||
    e.RENDER_EXTERNAL_URL ||
    withProto(e.RAILWAY_PUBLIC_DOMAIN) ||
    "";
  return site.replace(/\/+$/, "");
}

function absoluteShareMeta(): Plugin {
  let site = "";
  // Réécrit le HTML renvoyé par le serveur Vite avec l'adresse vue par le client (derrière un proxy aussi).
  const fromRequest: Parameters<NonNullable<Plugin["configureServer"]>>[0]["middlewares"]["use"] = (
    req,
    res,
    next,
  ) => {
    const host =
      (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0] ?? req.headers.host;
    if (!host) return next();
    const proto =
      (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ??
      (req.headers["x-forwarded-host"] || !/^(localhost|127\.|\[::1\])/.test(host)
        ? "https"
        : "http");
    const origin = `${proto}://${host}`;
    const end = res.end.bind(res) as (...a: unknown[]) => typeof res;
    res.end = ((chunk?: unknown, ...rest: unknown[]) => {
      const type = String(res.getHeader("Content-Type") ?? "");
      if (
        type.includes("text/html") &&
        chunk &&
        (typeof chunk === "string" || Buffer.isBuffer(chunk))
      ) {
        const html = absolutize(chunk.toString(), origin);
        if (!res.headersSent) res.setHeader("Content-Length", Buffer.byteLength(html));
        return end(html, ...rest);
      }
      return end(chunk, ...rest);
    }) as typeof res.end;
    next();
  };
  return {
    name: "clausus-share-meta",
    configResolved(config) {
      site = siteFromEnv(config.env);
    },
    configureServer(server) {
      server.middlewares.use(fromRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(fromRequest);
    },
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        // En dev, c'est fromRequest qui s'en charge (il connaît l'hôte) ; au build, on a besoin de l'URL du site.
        if (ctx.server || !site) return html;
        return absolutize(html, site);
      },
    },
  };
}

export default defineConfig({
  server: {
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    claususGame(),
    absoluteShareMeta(),
    varlockVitePlugin({ ssrInjectMode: "auto-load" }),
    tailwindcss(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
  ],
});
