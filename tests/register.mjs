import { registerHooks } from "node:module";

// Run the server business modules with Node's native TypeScript support.
// server-only is a bundler boundary; Next enforces it in the real app.
registerHooks({
  load(url, context, nextLoad) {
    return nextLoad(url, url.endsWith(".ts") ? { ...context, format: "module-typescript" } : context);
  },
  resolve(specifier, context, nextResolve) {
    // Next executes cache scopes in integration tests. Unit tests exercise the
    // underlying reads without its compiler/runtime.
    if (specifier === "next/cache") return { url: "data:text/javascript,export function cacheLife() {}", shortCircuit: true };
    if (specifier === "server-only" || specifier === "client-only") {
      return { url: "data:text/javascript,export {};", shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
