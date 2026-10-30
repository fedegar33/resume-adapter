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
  const telemetry = braintrustAISDKTelemetry();
  registerTelemetry({
    ...telemetry,
    // Provider errors may include request/response bodies. Keep automatic error
    // status/timing without copying PDF bytes or credentials from exceptions.
    onError(event) {
      return telemetry.onError?.({ ...(event && typeof event === "object" ? event : {}), error: new Error("AI request failed; see application feedback.") });
    },
  });
  initialized = true;
}
