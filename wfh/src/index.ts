import Md5FileHasher, { Md5FileHasherOptions } from "./Md5FileHasher";
import Md5WasmHasher, { Md5WasmHasherOptions } from "./Md5WasmHasher";

// Initialize a buffer of 2.1MB to start with. This number is based on
// observing what seems to be the max size a chunk can be when using a
// `TransformStream` in Chrome. See
// `Md5WasmHasherOptions.initialBufferSizeBytes`.
const defaultInitialBufferSizeBytes = 2_100_000;

// Digest files smaller than 1MB, files that are 1MB or larger will be
// streamed. See `Md5FileHasherOptions.streamThresholdSizeBytes`.
const defaultStreamThresholdSizeBytes = 1_000_000;

/**
 * Configures and creates a `Md5FileHasher` instance with the given options.
 *
 * Example:
 *
 * ```js
 * let wasmUrl = 'https://my-site.com/assets/wfh_wasm.wasm';
 *
 * // Create a hasher with default options.
 * try {
 *   let hasher = await createFileHasher(wasmUrl);
 * } catch (err) {
 *   console.error('failed to create hasher', err);
 * }
 *
 * // Create a hasher with custom options.
 * try {
 *   let hasher = await createFileHasher(wasmUrl, {
 *     initialBufferSizeBytes: 3_000_000, // 3MB
 *     streamThresholdSizeBytes: 1_000_000, // Stream files equal to or larger than 1MB
 *   });
 * } catch (err) {
 *   console.error('failed to create hasher', err);
 * }
 * ```
 */
export default async function createFileHasher(
  wasm: string | WebAssembly.WebAssemblyInstantiatedSource,
  options: CreateFileHasherOptions | undefined = {},
): Promise<Md5FileHasher> {
  if (typeof wasm === 'string') {
    wasm = await WebAssembly.instantiateStreaming(fetch(wasm));
  }

  let {
    initialBufferSizeBytes = defaultInitialBufferSizeBytes,
    streamThresholdSizeBytes = defaultStreamThresholdSizeBytes,
  } = options;

  let hasher = new Md5WasmHasher(wasm, {
    initialBufferSizeBytes: Math.max(initialBufferSizeBytes, 0),
  });

  return new Md5FileHasher(hasher, {
    streamThresholdSizeBytes: Math.max(streamThresholdSizeBytes, 0),
  });
}

// -- Types -------------------------------------------------------------------

type CreateFileHasherOptions = Partial<Md5FileHasherOptions & Md5WasmHasherOptions>;

export type FileHasher = InstanceType<typeof Md5FileHasher>;
