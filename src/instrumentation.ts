export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeBraintrust } = await import("@/lib/observability/braintrust.server");
    initializeBraintrust();
  }
}
