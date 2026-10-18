import { defineConfig } from "vitest/config";

/* Config mínima para los tests: sin plugins de Vite (no hacen falta) */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
