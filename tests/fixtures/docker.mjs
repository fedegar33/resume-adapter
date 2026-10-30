import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

// Exercise the real converter's stream/lifecycle handling without Docker/network.
export function mockDocker(context, result) {
  const calls = [];
  const removals = [];
  context.mock.method(childProcess, 'spawn', (command, args) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    child.kill = () => { queueMicrotask(() => child.emit('close', null)); return true; };
    const chunks = [];
    child.stdin.on('data', chunk => chunks.push(chunk));
    child.stdin.on('end', () => {
      const bytes = Buffer.concat(chunks);
      calls.push({ command, args, bytes });
      queueMicrotask(() => {
        const output = result();
        if (output.error) child.emit('error', new Error(output.error));
        if (output.stderr) child.stderr.write(output.stderr);
        if (output.html) child.stdout.write(output.html);
        child.emit('close', output.code ?? 0);
      });
    });
    return child;
  });
  context.mock.method(childProcess, 'execFile', (command, args, options, callback) => {
    removals.push({ command, args });
    callback(null, '', '');
    return new EventEmitter();
  });
  syncBuiltinESMExports();
  context.after(() => { context.mock.restoreAll(); syncBuiltinESMExports(); });
  return { calls, removals };
}
