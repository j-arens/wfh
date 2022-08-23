import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

let b64Wasm;

test.beforeAll(async () => {
  let { pathname } = new URL(
    '../../target/wasm32-unknown-unknown/release-wasm/wfh_wasm.wasm',
    import.meta.url,
  );

  let wasm = await readFile(pathname);
  b64Wasm = wasm.toString('base64');
});

test('hashing a file', async ({ page }) => {
  await page.goto('localhost:7474');

  let hash = await page.evaluate(async (wasm) => {
    let bin = Uint8Array.from(atob(wasm), (char) => char.charCodeAt(0));
    let mod = await WebAssembly.compile(bin);
    let instance = await WebAssembly.instantiate(mod);

    let contents = new TextEncoder().encode('abc123');
    let file = new Blob([contents]);

    let { createFileHasher } = window.__wfh;
    let hasher = await createFileHasher({ instance });
    let result = await hasher.hash(file);

    return result;
  }, b64Wasm);


  let expected = createHash('md5').update('abc123').digest('hex');
  expect(hash).toEqual(expected);
});

test('incrementally hashing a file', async ({ page }) => {
  await page.goto('localhost:7474');

  let hash = await page.evaluate(async (wasm) => {
    let bin = Uint8Array.from(atob(wasm), (char) => char.charCodeAt(0));
    let mod = await WebAssembly.compile(bin);
    let instance = await WebAssembly.instantiate(mod);

    let contents = new TextEncoder().encode('abc123');
    let file = new Blob([contents]);

    let { createFileHasher } = window.__wfh;
    let hasher = await createFileHasher({ instance }, {
      streamThresholdSizeBytes: 0, // Force streaming (incremental hashing).
    });

    let result = await hasher.hash(file);
    return result;
  }, b64Wasm);

  let expected = createHash('md5').update('abc123').digest('hex');
  expect(hash).toEqual(expected);
});
