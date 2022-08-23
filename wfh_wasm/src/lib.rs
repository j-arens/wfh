#![allow(clippy::missing_safety_doc)]

use std::alloc::{alloc, dealloc, Layout};
use std::mem;
use std::slice;

use md5::{Digest, Md5};

const ALIGN_OF_U8: usize = mem::align_of::<u8>();

/// Allocates a region of memory of the given `size` to store bytes (`u8`) and
/// returns a pointer to the beginning of the allocation. The caller is
/// responsible for the allocated memory.
#[no_mangle]
pub unsafe extern "C" fn md5_alloc_buffer(size: usize) -> *mut u8 {
  let layout = Layout::from_size_align_unchecked(size, ALIGN_OF_U8);
  alloc(layout)
}

/// Deallocates the region of memory beginning at `offset` up to `size`. It's
/// expected that this memory has been aligned for bytes (`u8`). This function
/// should only be called to deallocate memory that was allocated with
/// `md5_alloc_buffer()`, or to deallocate memory representing a `hash` created
/// by calling `md5_finalize()` or `md5_digest()`.
#[no_mangle]
pub unsafe extern "C" fn md5_dealloc_buffer(offset: *mut u8, size: usize) {
  let layout = Layout::from_size_align_unchecked(size, ALIGN_OF_U8);
  dealloc(offset, layout);
}

/// Creates a new `Md5` instance on the heap and prevents it from being
/// automatically dropped. Returns a pointer to the location of the `Md5`
/// instance, making the caller responsible for the memory.
#[no_mangle]
pub extern "C" fn md5_create_hasher() -> *mut Md5 {
  Box::into_raw(Box::new(Md5::new()))
}

/// Append bytes beginning at `bytes_offset` up to `bytes_len` to the given
/// `hasher` instance. Use this for incrementally digesting chunks of data,
/// calling `md5_finalize()` to complete the operation.
#[no_mangle]
pub unsafe extern "C" fn md5_update(hasher: *mut Md5, bytes_offset: *mut u8, bytes_len: usize) {
  let mut hasher = Box::from_raw(hasher);

  // Gather the bytes to hash from raw memory into a `slice`. Note that this
  // doesn't take ownership, meaning there's no need to explicitly forget
  // `bytes`, the caller remains responsible for this memory.
  let bytes = slice::from_raw_parts(bytes_offset, bytes_len);

  hasher.update(bytes);

  // Prevent `hasher` from being dropped. The caller is responsible for
  // managing this memory - but note that calling `md5_finalize()` with the
  // same `hasher` will take ownership of it, and automatically drop it.
  mem::forget(hasher);
}

/// Finalizes the given `hasher` instance and returns a pointer to the
/// resulting hash. Note that `finalize()` takes ownership of `hasher` and
/// moves it, meaning that even though the caller was previously responsible
/// for `hasher`'s memory, they are relieved of it. However, the caller is
/// responsible for the memory representing the finalized `hash`.
#[no_mangle]
pub unsafe extern "C" fn md5_finalize(hasher: *mut Md5) -> *const u8 {
  let hasher = Box::from_raw(hasher);
  // Note that `finalize()` takes ownership and moves `hasher`, no need to
  // manually forget it.
  let digest = hasher.finalize().to_vec();
  let offset = digest.as_ptr();

  // Prevent `digest` from being dropped. The caller is responsible for
  // managing this memory.
  mem::forget(digest);

  offset
}

/// Digests the bytes starting at the given `offset` up to `size` and returns
/// a pointer to the resulting `hash`. The caller is responsible for the memory
/// representing the `hash`.
#[no_mangle]
pub unsafe extern "C" fn md5_digest(offset: *mut u8, size: usize) -> *const u8 {
  // Gather the bytes to hash from raw memory into a `slice`. Note that this
  // doesn't take ownership, meaning there's no need to explicitly forget
  // `bytes`, the caller remains responsible for this memory.
  let bytes = slice::from_raw_parts(offset, size);

  let digest = Md5::digest(bytes).to_vec();
  let offset = digest.as_ptr();

  // Prevent `digest` from being dropped. The caller is responsible for
  // managing this memory.
  mem::forget(digest);

  offset
}

#[cfg(test)]
mod tests {
  use crate::*;
  use std::slice;

  #[test]
  fn test_hashing() {
    let data = b"abc123";
    let data_ptr = data.as_ptr();

    let hash = unsafe {
      let hash_ptr = md5_digest(data_ptr as *mut u8, data.len());
      slice::from_raw_parts(hash_ptr, 16)
    };

    assert_eq!(
      format!("{:02x?}", hash),
      "[e9, 9a, 18, c4, 28, cb, 38, d5, f2, 60, 85, 36, 78, 92, 2e, 03]"
    );
  }

  #[test]
  fn test_incremental_hashing() {
    let data_1 = b"abc";
    let data_1_ptr = data_1.as_ptr();

    let data_2 = b"123";
    let data_2_ptr = data_2.as_ptr();

    let hash = unsafe {
      let hasher = md5_create_hasher();

      md5_update(hasher, data_1_ptr as *mut u8, data_1.len());
      md5_update(hasher, data_2_ptr as *mut u8, data_2.len());

      slice::from_raw_parts(md5_finalize(hasher), 16)
    };

    assert_eq!(
      format!("{:02x?}", hash),
      "[e9, 9a, 18, c4, 28, cb, 38, d5, f2, 60, 85, 36, 78, 92, 2e, 03]"
    );
  }
}
