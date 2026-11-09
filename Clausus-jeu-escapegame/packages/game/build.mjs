// Copie dans dist/ les seuls fichiers dont le jeu a besoin à l'exécution : node build.mjs
// Les sources Blockbench, les aperçus et les outils restent hors du build.
// apps/web recopie ensuite dist/ dans son propre build, sous /game/.
import { cpSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'dist');
const EXCLUDE = new Set(['blockbench', 'preview', 'dist', 'node_modules', '.turbo', 'README.md', 'package.json', 'serve.mjs', 'build.mjs']);

rmSync(OUT, { recursive: true, force: true });
for (const entry of readdirSync(ROOT)) {
  if (EXCLUDE.has(entry) || entry.startsWith('.')) continue;
  cpSync(join(ROOT, entry), join(OUT, entry), { recursive: true });
}
console.log(`Jeu copié dans ${OUT}`);
