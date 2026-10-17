import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const engineDir = __dirname;
  const workspaceDir = process.env.ASSMAN_WORKSPACE_PATH || process.cwd();

  const { app, startServer } = await import("./server");

  const vite = await createViteServer({
    root: engineDir,
    server: {
      middlewareMode: true,
      fs: {
        allow: [engineDir, workspaceDir]
      },
      watch: {
        ignored: ["**/data/**"],
      },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);

  startServer();
}

main().catch((err) => {
  console.error("[ass.man DEV] Fatal error:", err);
  process.exit(1);
});
