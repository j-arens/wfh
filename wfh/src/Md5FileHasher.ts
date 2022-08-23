import type Md5WasmHasher from './Md5WasmHasher';
import Md5Digest from "./Md5Digest";

/**
 * Wrapper around a `Md5WasmHasher` that provides a simple interface for
 * hashing files, though technically it supports hashing any `Blob`.
 *
 * Files larger than a certain threshold will be streamed and hashed
 * incrementally in chunks. Otherwise the entire contents will be read into
 * memory and hashed.
 */
export default class Md5FileHasher {
  /**
   * A `Md5WasmHasher` instance.
   */
  #hasher: Md5WasmHasher;

  /**
   * Number of bytes representing a threshold at which files larger than it
   * should be streamed and hashed incrementally, or read entirely into memory
   * and then hashed.
   */
  #streamThresholdSizeBytes: number;

  constructor(hasher: Md5WasmHasher, opts: Md5FileHasherOptions) {
    this.#hasher = hasher;
    this.#streamThresholdSizeBytes = opts.streamThresholdSizeBytes;
  }

  // -- Public ----------------------------------------------------------------

  /**
   * Hashes the given file and returns the hash as a hexidecimal string.
   *
   * Files larger than `streamThresholdSizeBytes` will be streamed and
   * hashed incrementally, otherwise their entire contents will be read and
   * hashed in one go.
   *
   * Example:
   *
   * ```js
   * function hashFile(hasher, file) {
   *   try {
   *     let hash = await hasher.hash(file);
   *     return hash;
   *   } catch (err) {
   *     console.error('failed to hash file', err);
   *     return '';
   *   }
   * }
   * ```
   */
  async hash(file: Blob): Promise<string> {
    let digest = file.size >= this.#streamThresholdSizeBytes
      ? await this.#stream(file)
      : await this.#digest(file);

    return digest.hex();
  }

  // -- Private ---------------------------------------------------------------

  async #digest(file: Blob): Promise<Md5Digest> {
    let contents = await file.arrayBuffer();
    let result = this.#hasher.digest(new Uint8Array(contents));

    return new Md5Digest(result);
  }

  async #stream(file: Blob): Promise<Md5Digest> {
    let sink = {
      transform: (chunk: Uint8Array) => {
        this.#hasher.append(chunk);
      },

      flush: (controller: TransformStreamDefaultController) => {
        controller.enqueue(this.#hasher.finalize());
      },
    };

    let reader = file
      .stream()
      .pipeThrough(new TransformStream(sink))
      .getReader();

    let done = false;
    let hash = new Uint8Array(16);
    let offset = 0;

    while (!done) {
      let result = await reader.read();

      if (result.value) {
        hash.set(result.value, offset);
        offset += result.value.length;
      }

      done = result.done;
    }

    return new Md5Digest(hash);
  }
}

// -- Types -------------------------------------------------------------------

export interface Md5FileHasherOptions {
  /**
   * Number of bytes representing a threshold at which files larger than it
   * should be streamed and hashed incrementally, or read entirely into memory
   * and then hashed.
   *
   * At a certain point, depending on the hardware, reading an entire file's
   * contents into memory and then hashing will become an expensive operation
   * that will tank a page's performance, or even crash it. In order to avoid
   * this, files larger than the threshold will be streamed in small chunks and
   * hashed incrementally. The downside is that streams have a slight overhead,
   * and for files under the threshold, it may be slightly faster to skip that
   * and read and hash the entire contents in one go.
   *
   * In my testing, the overhead of streaming is actually almost completely
   * neglible, resulting in only maybe a few milliseconds difference, but as
   * always, ymmv.
   */
  streamThresholdSizeBytes: number;
}
