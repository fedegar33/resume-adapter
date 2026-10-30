# Braintrust tracing

For personal use, Federico authorized recording the original filename and output
JSON on October 29, 2026. Earlier operational-only output restrictions are
superseded by this policy. Personal CVs and exported traces still must not be committed.

## Automatic instrumentation

`src/instrumentation.ts` initializes the Braintrust project once. It registers
`braintrustAISDKTelemetry()` with AI SDK 7. Model calls emit automatic traces;
there is no need for `recordAnalysisOperation` or a new metrics function for each
LLM call. Do not use the older `wrapAISDK` pattern with AI SDK 7.

Each current generation call identifies its purpose with `telemetry.functionId`,
disables input recording with `recordInputs:false`, and enables output recording
with `recordOutputs:true`. Braintrust captures the model result, token metrics
and timing. It does not receive the complete PDF/prompt as recorded input.

The extraction route adds a native Braintrust `traced` parent named
`resume.extractMetadata`. It logs:

- input: original filename only;
- metadata: original filename from the upload record and upload ID;
- output: final JSON returned to the application, including normalized candidate,
  deduplicated sections and server-generated IDs.

Its automatically instrumented model child shows the raw LLM response before
application normalization. This distinguishes model output from the final API
payload and keeps both available without duplicating manual token accounting.
The parent span is application context, not another call to the model.

Provider exception bodies can contain request data, so the globally registered
integration replaces the error details with a generic failure before delegating
to Braintrust. The parent receives the application's safe error message. The
OpenAI `store:false` option controls OpenAI response storage separately.

A future model call only needs its trace ID and input/output recording settings;
no separate recorder function.

## Verification

Tests use synthetic PDFs and mocked model/provider calls. They verify input/output
flags, automatic telemetry events, original PDF transport and safe application
errors. They do not initialize a live Braintrust logger or send traces externally.
Live trace delivery is checked by using the application with configured credentials.

Reference: [Braintrust AI SDK 7 integration](https://www.braintrust.dev/docs/integrations/sdk-integrations/vercel).
