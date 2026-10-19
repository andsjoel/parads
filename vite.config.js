import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import process from "node:process";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ["FIREBASE_ADMIN_", "PARADS_"]);
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  return {
    plugins: [react(), tailwindcss(), {
      name: "public-release-identity",
      generateBundle() {
        const sha = process.env.VERCEL_GIT_COMMIT_SHA;
        this.emitFile({ type: "asset", fileName: "release.json", source: JSON.stringify({
          commit: typeof sha === "string" && /^[a-f0-9]{40}$/.test(sha) ? sha : null,
          builtAt: new Date().toISOString(),
        }) });
      },
    }, {
      name: "local-password-recovery",
      configureServer(server) {
        server.middlewares.use("/api/access-gateway", async (req, res, next) => {
          if (req.url?.split("?")[0] !== "/") return next();
          try {
            const { default: handler } = await import("./api/access-gateway.js");
            await handler(req, res);
          } catch (error) { next(error); }
        });
        server.middlewares.use("/api/password-recovery", async (req, res, next) => {
          if (req.url?.split("?")[0] !== "/") return next();
          try {
            const { default: handler } = await import("./api/password-recovery.js");
            await handler(req, res);
          } catch (error) {
            next(error);
          }
        });
      },
    }],
  };
});
