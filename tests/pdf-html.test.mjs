import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convertPdfToHtml } from '@/lib/pdf/html.server';
import { makeResumePdf } from './fixtures/resume.mjs';
import { mockDocker } from './fixtures/docker.mjs';

const pdf = new Uint8Array(makeResumePdf());
const html = '<!doctype html><html><head><style>.pc{display:none}</style></head><body><div class="pc">Alex Example</div></body></html>';

test('conversion pipes the unchanged PDF and returns raw HTML without host mounts or CV arguments', async context => {
  const { calls, removals } = mockDocker(context, () => ({ html }));
  assert.equal(await convertPdfToHtml(pdf), html);
  assert.deepEqual(calls[0].bytes, Buffer.from(pdf));
  assert.equal(calls[0].args.includes('--volume'), false);
  assert.equal(calls[0].args.includes('-v'), false);
  assert.equal(JSON.stringify(calls[0].args).includes('Alex Example'), false);
  assert.equal(calls[0].args[calls[0].args.indexOf('--network') + 1], 'none');
  assert.deepEqual(removals, []);
});

test('unavailable Docker, missing image, invalid output and converter errors stay safe and remove only their container', async context => {
  let output;
  const { calls, removals } = mockDocker(context, () => output);
  for (const [result, expected] of [
    [{ error: 'sensitive CV contents', code: 1 }, /Docker could not be started/],
    [{ stderr: 'Cannot connect to the Docker daemon', code: 125 }, /Start Docker Desktop/],
    [{ stderr: 'No such image: synthetic-image', code: 125 }, /pnpm pdf:setup/],
    [{ stderr: 'sensitive CV contents', code: 1 }, /could not convert/],
    [{ html: 'partial sensitive CV contents' }, /incomplete/],
    [{ html: 'x'.repeat(33 * 1024 * 1024) }, /too large/],
  ]) {
    output = result;
    await assert.rejects(convertPdfToHtml(pdf), error => expected.test(error.message) && !error.message.includes('sensitive'));
  }
  assert.equal(removals.length, calls.length);
  removals.forEach((removal, index) => {
    assert.deepEqual(removal.args.slice(0, 2), ['rm', '--force']);
    assert.equal(removal.args[2], calls[index].args[calls[index].args.indexOf('--name') + 1]);
  });
});

test('empty input is rejected before starting Docker', async context => {
  const { calls } = mockDocker(context, () => ({ html }));
  await assert.rejects(convertPdfToHtml(new Uint8Array()), /10 MB/);
  assert.deepEqual(calls, []);
});
