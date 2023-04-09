use crate::random::{next_random, raw_random};

const TARGET: usize = 8;
const MIN: f64 = 126.0 / 360.0;
const MAX: f64 = (126.0 + 209.0) / 360.0;

unsafe fn relock_random() {
	for _ in 0 .. TARGET.max(TARGET_ALT) {
		raw_random();
	}

	let barrier = raw_random();

	while next_random() != barrier {}
}

#[no_mangle]
pub unsafe extern fn anticorrupt() {
	relock_random();

	let mut count = 0;
	let mut i = 0;

	while count < TARGET {
		let rand = next_random();

		if MIN <= rand && rand < MAX {
			count = 0;
		} else {
			count += 1;
		}

		i += 1;
	}

	for _ in 0 .. i - TARGET {
		raw_random();
	}
}

const TARGET_ALT: usize = 7;
const CUTOFF_ALT: f64 = 0.4;

#[no_mangle]
pub unsafe extern fn anticorrupt_alt() {
	relock_random();

	let mut count = 0;
	let mut i = 0;

	while count < TARGET_ALT {
		let rand = next_random();

		if rand >= CUTOFF_ALT {
			count = 0;
		} else {
			count += 1;
		}

		i += 1;
	}

	for _ in 0 .. i - TARGET_ALT {
		raw_random();
	}
}
