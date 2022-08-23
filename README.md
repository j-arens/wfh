# WFH - Web File Hasher

A utility for getting the MD5 hash of files in web browsers. The MD5 hashing is done via WebAssembly, and the utility supports incrementally hashing large files via streaming for memory efficiency.

## Requirements

- [Rust](https://www.rust-lang.org/) >= `1.62`
- [Cargo](https://doc.rust-lang.org/cargo/) >= `1.62`
- The `wasm32-unknown-unknown` target must be installed to compile the `wfh_wasm` crate
- [Node.js](https://nodejs.org/en/) >= `16`
- [pnpm](https://pnpm.io/) >= `7`

## Directories

- [wfh](/wfh) - file hashing library
- [wfh_cf_page](/wfh_cf_page) - example web page using `wfh` to hash files
- [wfh_wasm](/wfh_wasm) - Rust crate wrapping the `md-5` crate, compiled down to WebAssembly

## Scripts

From the root:

```sh
# Develop the example web page locally
pnpm dev

# Build everything
pnpm build

# Test all packages and crates
pnpm test

# Test Rust crates 
pnpm test:rs

# Test TypeScript packages
pnpm test:ts

# Lint all packages and crates
pnpm lint

# Lint Rust crates
pnpm lint:rs

# Lint TypeScript packages
pnpm lint:ts
```
