import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mesmo alias do tsconfig, para os testes importarem módulos que usam "@/...".
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
