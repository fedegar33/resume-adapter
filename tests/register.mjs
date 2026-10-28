import { registerHooks } from "node:module";

// Run the server business modules with Node's native TypeScript support.
// server-only is a bundler boundary; Next enforces it in the real app.
registerHooks({
  load(url, context, nextLoad) {
    return nextLoad(url, url.endsWith(".ts") ? { ...context, format: "module-typescript" } : context);
  },
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export {};", shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
