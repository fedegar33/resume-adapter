import "server-only";
import { registerTelemetry } from "ai";
import { braintrustAISDKTelemetry, initLogger } from "braintrust";

let initialized = false;

export function initializeBraintrust() {
  if (initialized) return;
  initLogger({
    projectName: "resume-adapter",
  });
  // AI SDK 7 uses telemetry registration, not the v3-v6 wrapAISDK integration.
  registerTelemetry(braintrustAISDKTelemetry());
  initialized = true;
}
