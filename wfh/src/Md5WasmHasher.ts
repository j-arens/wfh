/**
 * Wrapper around a `wfh_wasm` WebAssembly instance that makes working with it
 * a little more ergonomic. Memory and interop with the instance are handled
 * internally, exposing an easy to use API to consumers.
 */
export default class Md5WasmHasher {
  /**
   * The region of WebAssembly memory which file contents are written to and
   * read from for hashing.
   */
  #buffer: Uint8Array;

  /**
   * A "pointer" or offset into the WebAssembly instance's memory that points
   * to a `Md5` instance.
   *
   * A hasher should only be used for incremental hashing. Care needs to be
   * taken to ensure that this always points to a valid `Md5` instance, or is
   * otherwise `null`.
   */
  #hasher: Pointer | null = null;

  /**
   * A `wfh_wasm` WebAssembly instance.
   */
  #wasm: WebAssembly.WebAssemblyInstantiatedSource;

  constructor(
    wasm: WebAssembly.WebAssemblyInstantiatedSource,
    opts: Md5WasmHasherOptions,
  ) {
    this.#wasm = wasm;

    let size = opts.initialBufferSizeBytes;

    // Note: `alloc()` needs to be called before accessing `memory` because it
    // will detach the current backing `ArrayBuffer` that `memory` references
    // and attach a new one.
    let offset = this.#exports.alloc(size);

    this.#buffer = new Uint8Array(
      this.#exports.memory,
      offset,
      size,
    );
  }

  // -- Public ----------------------------------------------------------------

  append(data: Uint8Array) {
    if (!this.#hasher) {
      this.#hasher = this.#exports.createHasher();
    }

    this.#memSet(data);

    this.#exports.update(
      this.#hasher,
      this.#buffer.byteOffset,
      data.byteLength,
    );
  }

  digest(data: Uint8Array): Uint8Array {
    this.#memSet(data);

    let offset = this.#exports.digest(
      this.#buffer.byteOffset,
      data.byteLength,
    );

    let slice = this.#memGet(offset, offset + 16);

    this.#exports.dealloc(offset, 16);

    return new Uint8Array(slice);
  }

  finalize(): Uint8Array {
    if (!this.#hasher) {
      return new Uint8Array();
    }

    let offset = this.#exports.finalize(this.#hasher);

    // Immediately set `#hasher` to `null` because the WASM instance's
    // `finalize()` function takes ownership and drops it, meaning `#hasher` no
    // longer points to a valid `Md5` instance.
    this.#hasher = null;

    let slice = this.#memGet(offset, offset + 16);

    this.#exports.dealloc(offset, 16);

    return new Uint8Array(slice);
  }

  // -- Private ---------------------------------------------------------------

  get #exports() {
    let exports = this.#wasm.instance.exports as WasmExports;

    return {
      alloc: exports.md5_alloc_buffer,
      createHasher: exports.md5_create_hasher,
      dealloc: exports.md5_dealloc_buffer,
      digest: exports.md5_digest,
      finalize: exports.md5_finalize,
      memory: exports.memory.buffer,
      update: exports.md5_update,
    };
  }

  #memGet(offset: number, size: number): ArrayBuffer {
    return this.#exports.memory.slice(offset, size);
  }

  #memGrow(size: number) {
    this.#exports.dealloc(
      this.#buffer.byteOffset,
      this.#buffer.byteLength,
    );

    // Note: `alloc()` needs to be called before accessing `memory` because it
    // will detach the current backing `ArrayBuffer` that `memory` references
    // and attach a new one.
    let offset = this.#exports.alloc(size);

    this.#buffer = new Uint8Array(
      this.#exports.memory,
      offset,
      size,
    );
  }

  #memSet(data: Uint8Array) {
    if (data.byteLength > this.#buffer.byteLength) {
      this.#memGrow(data.byteLength);
    }

    this.#buffer.set(data);
  }
}

// -- Types -------------------------------------------------------------------

export interface Md5WasmHasherOptions {
  /**
   * Initial size of the buffer that file contents will be written to and read
   * from for hashing.
   *
   * Supplying a large initial size will prevent the need to dynamically grow
   * the buffer size on demand, which can result in a small performance hit,
   * but will hog more memory. Supplying a small initial size will result in
   * the opposite, less memory hogging but a higher chance of having to grow the
   * buffer.
   */
  initialBufferSizeBytes: number;
}

// A "pointer" to some location in a WebAssembly instance's memory is really
// just a number offset into an `ArrayBuffer`, but I find that using a more
// explicit alias is a helpful distinction.
type Pointer = number;

interface WasmExports extends WebAssembly.Exports {
  md5_alloc_buffer: (size: number) => Pointer;
  md5_create_hasher: () => Pointer;
  md5_dealloc_buffer: (offset: Pointer, size: number) => void;
  md5_digest: (offset: Pointer, size: number) => Pointer;
  md5_finalize: (hasher: Pointer) => Pointer;
  md5_update: (hasher: Pointer, offset: Pointer, size: number) => void;
  memory: WebAssembly.Memory;
}
