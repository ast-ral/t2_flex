#![no_std]

#![feature(panic_info_message)]

#[cfg(not(target_arch = "wasm32"))]
compile_error!("only builds for wasm32-unknown-unknown");

// TODO: figure out --remap-path-prefix if necessary

#[macro_use]
mod utils;

mod anticorrupt;
mod print;
mod ecc;
mod galois;
mod autogen;
mod random;
mod qr;
mod panic;

use dbg;

pub fn no_use() {
	dbg!();
}
