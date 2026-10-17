import { createServer as createViteServer } from "vite";

async function main() {
  const { app, startServer } = await import("./server");

  const vite = await createViteServer({
    server: {
      middlewareMode: true,
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
