import "server-only";
import { registerTelemetry } from "ai";
import { braintrustAISDKTelemetry, initLogger } from "braintrust";

let initialized = false;

export function initializeBraintrust() {
  const apiKey = process.env.BRAINTRUST_API_KEY?.trim();
  if (initialized || !apiKey) return;
  initLogger({
    apiKey,
    projectName: process.env.BRAINTRUST_PROJECT_NAME?.trim() || "resume-adapter",
  });
  // AI SDK 7 uses telemetry registration, not the v3-v6 wrapAISDK integration.
  registerTelemetry(braintrustAISDKTelemetry());
  initialized = true;
}
