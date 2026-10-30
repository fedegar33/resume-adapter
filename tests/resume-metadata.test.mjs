import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { registerTelemetry } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { extractResumeMetadata } from '@/lib/ai/extract-metadata.server';
import { POST } from '@/app/api/master-resume/analyze/route';
import { makeResumePdf } from './fixtures/resume.mjs';

const pdf = new Uint8Array(makeResumePdf());
const uploadId = randomUUID();
const extracted = { isResume: true, name: 'Alex Example', role: 'Senior Engineer', sections: [{ title: 'Professional Summary' }, { title: 'Experience' }, { title: 'Education' }] };
const generation = (value, reason = 'stop') => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }], finishReason: { unified: reason, raw: reason }, usage: { inputTokens: { total: 10 }, outputTokens: { total: 20 } }, warnings: [] });
const events = [];
registerTelemetry({ name: 'metadata-privacy-test', onStart: e => events.push(e), onEnd: e => events.push(e), onError: e => events.push(e) });

test('full original PDF is attached, metadata is structured, headings deduplicate, and output telemetry is enabled without PDF input recording', async () => {
  const model = new MockLanguageModelV4({ doGenerate: generation({ ...extracted, sections: [...extracted.sections, { title: 'Experience' }] }) });
  const result = await extractResumeMetadata(pdf, uploadId, { model });
  assert.deepEqual(result.candidate, { name: 'Alex Example', role: 'Senior Engineer' });
  assert.deepEqual(result.sections.map(s => s.title), extracted.sections.map(s => s.title));
  assert.equal(new Set(result.sections.map(s => s.id)).size, 3);
  const call = model.doGenerateCalls[0];
  const attachment = call.prompt.find(m => m.role === 'user').content.find(p => p.type === 'file');
  assert.deepEqual(new Uint8Array(attachment.data.data), pdf);
  assert.equal(attachment.mediaType, 'application/pdf');
  assert.equal(attachment.filename, 'resume.pdf');
  assert.equal(call.providerOptions.openai.store, false);
  assert.match(call.prompt[0].content, /untrusted DATA/);
  const start = events.find(event => event.operationId === 'ai.generateText');
  assert.ok(start);
  assert.equal(start.recordInputs, false);
  assert.equal(start.recordOutputs, true);
  assert.equal(start.functionId, 'resume.metadata');
  assert.ok(events.some(event => event.text?.includes('Alex Example')));

});

test('missing facts stay null, non-resumes are rejected and provider/schema failures are safe without retries', async () => {
  const missing = await extractResumeMetadata(pdf, uploadId, { model: new MockLanguageModelV4({ doGenerate: generation({ isResume: true, name: null, role: null, sections: [] }) }) });
  assert.deepEqual(missing.candidate, { name: null, role: null });
  for (const [output, status] of [[generation({ isResume: false, name: null, role: null, sections: [] }), 422], [generation('sensitive invalid output Alex'), 502], [generation(extracted, 'length'), 502], [generation({ ...extracted, role: 7 }), 502]]) {
    const model = new MockLanguageModelV4({ doGenerate: output });
    await assert.rejects(extractResumeMetadata(pdf, uploadId, { model }), e => e.status === status && !e.message.includes('Alex'));
    assert.equal(model.doGenerateCalls.length, 1);
  }
  const failed = new MockLanguageModelV4({ doGenerate: async () => { throw new Error('sensitive provider PDF'); } });
  await assert.rejects(extractResumeMetadata(pdf, uploadId, { model: failed }), /could not be extracted/);
  assert.equal(failed.doGenerateCalls.length, 1);
  assert.ok(events.length > 0);
});

test('analysis endpoint sends the authoritative private PDF as inline file data and checks local access first', async context => {
  const names = ['NODE_ENV', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_STORAGE_BUCKET', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_REASONING_EFFORT'];
  const previous = names.map(name => process.env[name]);
  let publicBucket = false;
  let nonResume = false;
  let providerCalls = 0;
  const calls = [];
  context.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/rest/v1/master_resume_uploads')) return Response.json({ id: uploadId, storage_bucket: 'resumes', storage_path: `masters/${uploadId}.pdf`, size_bytes: pdf.length, original_filename: 'alex-example.pdf' });
    if (url.endsWith('/storage/v1/bucket/resumes')) return Response.json({ id: 'resumes', public: publicBucket });
    if (url.includes('/storage/v1/object/') && url.endsWith(`${uploadId}.pdf`)) return new Response(pdf);
    if (url === 'https://api.openai.com/v1/responses') {
      providerCalls++;
      const body = JSON.parse(init.body);
      assert.equal(body.store, false);
      assert.equal(body.text.format.type, 'json_schema');
      const file = body.input.flatMap(m => m.content ?? []).find(p => p.type === 'input_file');
      assert.deepEqual(Buffer.from(file.file_data.split(',')[1], 'base64'), Buffer.from(pdf));
      return Response.json({ id: 'resp_test', object: 'response', created_at: 1, model: 'synthetic-model', status: 'completed', output: [{ type: 'message', id: 'msg_test', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ ...extracted, isResume: !nonResume }), annotations: [] }] }], usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 } });
    }
    throw new Error('Unexpected external request');
  });
  const request = value => new Request('http://127.0.0.1:3000/api/master-resume/analyze', { method: 'POST', headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: JSON.stringify(value) });
  try {
    Object.assign(process.env, { NODE_ENV: 'development', SUPABASE_URL: 'https://supabase.invalid', SUPABASE_SECRET_KEY: 'test', SUPABASE_STORAGE_BUCKET: 'resumes', OPENAI_API_KEY: 'test', OPENAI_MODEL: 'synthetic-model', OPENAI_REASONING_EFFORT: 'low' });
    assert.equal((await POST(request({ uploadId: 'bad' }))).status, 400);
    assert.equal(calls.length, 0);
    const response = await POST(request({ uploadId }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).metadata.candidate.name, 'Alex Example');
    nonResume = true;
    assert.equal((await POST(request({ uploadId }))).status, 422);
    publicBucket = true;
    assert.equal((await POST(request({ uploadId }))).status, 503);
    process.env.NODE_ENV = 'production';
    const before = calls.length;
    assert.equal((await POST(request({ uploadId }))).status, 403);
    assert.equal(calls.length, before);
    assert.equal(providerCalls, 2);
  } finally { names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; }); }
});
