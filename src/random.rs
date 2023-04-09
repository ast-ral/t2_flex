#[link(wasm_import_module = "js")]
extern {
	pub fn raw_random() -> f64;
}

fn random() -> f64 {
	unsafe {raw_random()}
}

static mut STATE: (u64, u64) = (0, 0);
static mut CACHE: [f64; 64] = [0.0; 64];
static mut CACHE_LEN: usize = 0;

fn float_to_int(float: f64) -> u64 {
	let bytes = (float + 1.0).to_le_bytes();
	let num = u64::from_le_bytes(bytes);

	num & 0x000f_ffff_ffff_ffff
}

fn int_to_float(int: u64) -> f64 {
	let bytes = ((int >> 12) | 0x3ff0_0000_0000_0000).to_le_bytes();
	let float = f64::from_le_bytes(bytes);

	float - 1.0
}

fn derive_unknown(k0: u64, k1: u64, k2: u64) -> u64 {
	let mut x = k2 ^ (k1 >> 26) ^ k1;

	x ^= x >> 17;
	x ^= x >> 34;

	((x ^ k0 ^ (k0 << 23)) >> 11) & 0x0fff
}

#[no_mangle]
pub unsafe extern fn lock_random() {
	let (mut s_back, mut s_forwards) = loop {
		if let Some(states) = try_lock_random() {
			break states;
		}
	};

	loop {
		let (new_s_back, new_s_forwards) = (back(s_forwards, s_back), s_back);

		if random() != int_to_float(new_s_back) {
			break;
		}

		s_back = new_s_back;
		s_forwards = new_s_forwards;
	}

	for _ in 0 .. 64 {
		let (new_s_back, new_s_forwards) = (s_forwards, next(s_back, s_forwards));

		s_back = new_s_back;
		s_forwards = new_s_forwards;
	}

	STATE = (s_back, s_forwards);
	CACHE_LEN = 0;

	next_random();
}

#[no_mangle]
pub unsafe extern fn next_random() -> f64 {
	if CACHE_LEN == 0 {
		refill_cache();
	}

	// for some reason, bounds checking still generated panic handling code
	// even with panic = "abort"
	// so we use unchecked to access arrays

	CACHE_LEN -= 1;
	*CACHE.get_unchecked(CACHE_LEN)
}

unsafe fn refill_cache() {
	let (mut s_back, mut s_forwards) = STATE;
	CACHE_LEN = 64;

	for i in 0 .. 64 {
		*CACHE.get_unchecked_mut(i) = int_to_float(s_back);

		let (new_s_back, new_s_forwards) = (s_forwards, next(s_back, s_forwards));

		s_back = new_s_back;
		s_forwards = new_s_forwards;
	}

	STATE = (s_back, s_forwards);
}

fn try_lock_random() -> Option<(u64, u64)> {
	let [f3, f2, f1, f0] = [
		random(),
		random(),
		random(),
		random(),
	];

	let k0 = float_to_int(f0);
	let k1 = float_to_int(f1);
	let k2 = float_to_int(f2);
	let k3 = float_to_int(f3);

	let s0 = k0 << 12 | derive_unknown(k0, k1, k2);
	let s1 = k1 << 12 | derive_unknown(k1, k2, k3);
	let s2 = next(s0, s1);
	let s3 = next(s1, s2);

	if int_to_float(s0) != f0 {
		return None;
	}

	if int_to_float(s1) != f1 {
		return None;
	}

	if int_to_float(s2) != f2 {
		return None;
	}

	if int_to_float(s3) != f3 {
		return None;
	}

	Some((s0, s1))
}

fn back(s2: u64, s1: u64) -> u64 {
	let mut x = s2 ^ s1 ^ (s1 >> 26);

	x ^= x >> 17;
	x ^= x >> 34;

	x ^= x << 23;
	x ^= x << 46;

	x
}

fn next(s0: u64, s1: u64) -> u64 {
	let mut x = s0;

	x ^= x << 23;
	x ^= x >> 17;

	s1 ^ (s1 >> 26) ^ x
}
