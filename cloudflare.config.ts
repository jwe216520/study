import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "study",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-07",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      MONITOR_ADMIN_USER_ID: bindings.secret(),
      MONITOR_CF_ACCOUNT_ID: bindings.secret(),
      MONITOR_CF_API_TOKEN: bindings.secret(),
      MONITOR_SUPABASE_TOKEN: bindings.secret(),
    },
  }),
});
