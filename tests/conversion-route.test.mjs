import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { POST as convert } from '@/app/api/master-resume/convert/route';
import { makeResumePdf } from './fixtures/resume.mjs';
import { mockDocker } from './fixtures/docker.mjs';

const pdf = makeResumePdf();
const uploadId = randomUUID();
const html = '<html><head></head><body>Alex Example</body></html>';
const request = value => new Request('http://127.0.0.1:3000/api/master-resume/convert', { method: 'POST', headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: JSON.stringify(value) });

test('local conversion downloads the private original and returns HTML without AI calls or content writes', async context => {
  const names = ['NODE_ENV', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_STORAGE_BUCKET'];
  const previous = names.map(name => process.env[name]);
  const calls = [];
  let failConversion = false;
  let publicBucket = false;
  const docker = mockDocker(context, () => failConversion ? { code: 1, stderr: 'private provider CV contents' } : { html });
  context.mock.method(globalThis, 'fetch', async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/rest/v1/master_resume_uploads')) return Response.json({ id: uploadId, storage_bucket: 'resumes', storage_path: `masters/${uploadId}.pdf`, size_bytes: pdf.length });
    if (url.endsWith('/storage/v1/bucket/resumes')) return Response.json({ id: 'resumes', public: publicBucket });
    if (url.includes('/storage/v1/object/') && url.endsWith(`${uploadId}.pdf`)) return new Response(pdf, { headers: { 'content-type': 'application/pdf' } });
    throw new Error(`External requests are forbidden in tests: ${url}`);
  });
  try {
    Object.assign(process.env, { NODE_ENV: 'development', SUPABASE_URL: 'https://supabase.invalid', SUPABASE_SECRET_KEY: 'test', SUPABASE_STORAGE_BUCKET: 'resumes' });
    assert.equal((await convert(request({ uploadId: 'invalid' }))).status, 400);
    assert.equal(calls.length, 0);
    const response = await convert(request({ uploadId }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { uploadId, html });
    assert.deepEqual(docker.calls[0].bytes, pdf);
    failConversion = true;
    const error = await convert(request({ uploadId }));
    assert.equal(error.status, 502);
    assert.equal(JSON.stringify(await error.json()).includes('private provider'), false);
    publicBucket = true;
    assert.equal((await convert(request({ uploadId }))).status, 503);
    const before = calls.length;
    process.env.NODE_ENV = 'production';
    assert.equal((await convert(request({ uploadId }))).status, 403);
    assert.equal(calls.length, before);
    assert.equal(docker.calls.length, 2);
  } finally {
    names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; });
  }
});
