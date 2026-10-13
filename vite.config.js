import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import process from "node:process";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "FIREBASE_ADMIN_");
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  return {
    plugins: [react(), tailwindcss(), {
      name: "local-password-recovery",
      configureServer(server) {
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
