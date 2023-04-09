use crate::utils::SliceWriter;
use crate::ecc::perform_ecc;

const QR_BUFFER_SIZE: usize = 5000;
const BYTESTREAM_BUFFER_SIZE: usize = 500;

static mut STR_IN: [u16; QR_BUFFER_SIZE] = [0; QR_BUFFER_SIZE];
static mut STR_OUT: [u8; 250] = [0; 250];
static mut BIT_MATRIX: [u8; QR_BUFFER_SIZE] = [0; QR_BUFFER_SIZE];
static mut BIT_STREAM: [u8; QR_BUFFER_SIZE] = [0; QR_BUFFER_SIZE];
static mut DATA_VALS: [u8; BYTESTREAM_BUFFER_SIZE] = [0; BYTESTREAM_BUFFER_SIZE];
static mut ECC_VALS: [u8; BYTESTREAM_BUFFER_SIZE] = [0; BYTESTREAM_BUFFER_SIZE];

#[no_mangle]
pub unsafe extern fn str_in() -> *mut u16 {
	STR_IN.as_mut_ptr()
}

#[no_mangle]
pub unsafe extern fn str_out() -> *mut u8 {
	STR_OUT.as_mut_ptr()
}

#[no_mangle]
pub unsafe extern fn process_str_in(len: usize) -> usize {
	let out = read_qr(&STR_IN[0 .. len], &mut STR_OUT);

	out.len()
}

fn read_qr<'a>(qr: &[u16], out: &'a mut [u8]) -> &'a mut [u8] {
	let mut out = SliceWriter::new(out);

	let qr_lines = qr.split(|&x| x == '\n' as u16);
	let (bit_matrix, qr_size) = qr_to_bitmatrix(
		qr_lines,
		unsafe {&mut BIT_MATRIX},
	);

	let mask = if let Some(x) = get_mask(bit_matrix, qr_size) {
		x
	} else {
		return out.out();
	};

	let mask = get_mask_func(mask);

	let mut bitstream = SliceWriter::new(unsafe {&mut BIT_STREAM});

	static mut ORDER: [[usize; 2]; 10000] = [[0; 2]; 10000];

	let mut order = SliceWriter::new(unsafe {&mut ORDER});

	walk_qr(qr_size, |x, y| {
		order.write([x, y]);
		bitstream.write(bit_matrix[y * qr_size + x] ^ mask(y, x) as u8);
	});

	let bitstream = bitstream.out();

	let (b1_groups, b1_group_len, b2_groups, b2_group_len) = data_block_sizes(qr_size);
	let groups = b1_groups + b2_groups;

	let mut data_vals = SliceWriter::new(unsafe {&mut DATA_VALS});
	let mut ecc_vals = SliceWriter::new(unsafe {&mut ECC_VALS});

	let mut push_data = |index| {
		//dbg!(index);
		data_vals.write(to_byte(&bitstream[8 * index .. 8 * (index + 1)]));
	};

	let mut push_ecc = |index: usize| {
		ecc_vals.write(to_byte(&bitstream[8 * index .. 8 * (index + 1)]));
	};

	for i in 0 .. b1_groups {
		for j in 0 .. b1_group_len {
			push_data(i + groups * j);
		}
	}

	let b2_interleaving_offset = b1_group_len * groups;
	let b2_extra_len = b2_group_len - b1_group_len;

	for i in 0 .. b2_groups {
		for j in 0 .. b1_group_len {
			push_data(b1_groups + i + groups * j);
		}

		for j in 0 .. b2_extra_len {
			push_data(b2_interleaving_offset + i + b2_groups * j);
		}
	}

	let ecc_start = b1_groups * b1_group_len + b2_groups * b2_group_len;
	let ecc_group_len = ecc_block_sizes(qr_size);

	for i in 0 .. groups {
		for j in 0 .. ecc_group_len {
			push_ecc(ecc_start + i + groups * j);
		}
	}

	let data_vals = data_vals.out();
	let ecc_vals = ecc_vals.out();

	let mut corrected_bytes = 0;

	for i in 0 .. groups {
		let data_len = if i < b1_groups {b1_group_len} else {b2_group_len};

		let data = &mut data_vals[corrected_bytes .. corrected_bytes + data_len];
		let ecc = &mut ecc_vals[ecc_group_len * i .. ecc_group_len * (i + 1)];

		perform_ecc(data, ecc);

		corrected_bytes += data_len;
	}

	let len = read_unaligned(&data_vals[0 .. 2]);

	for i in 0 .. len as usize {
		out.write(read_unaligned(&data_vals[i + 1 .. i + 3]));
	}

	//write!(out, "{:?}", len).unwrap();

	out.out()
}

// TODO: reduce the code duplication here
fn get_mask<'a>(
	bit_matrix: &[u8],
	size: usize,
) -> Option<(bool, bool, bool)> {
	let mask_a = if bit_matrix[8 * size + 2] & 2 == 0 {
		bit_matrix[8 * size + 2]
	} else if bit_matrix[(size - 3) * size + 8] & 2 == 0 {
		bit_matrix[(size - 3) * size + 8]
	} else {
		return None;
	};

	let mask_b = if bit_matrix[8 * size + 3] & 2 == 0 {
		bit_matrix[8 * size + 3]
	} else if bit_matrix[(size - 4) * size + 8] & 2 == 0 {
		bit_matrix[(size - 4) * size + 8]
	} else {
		return None;
	};

	let mask_c = if bit_matrix[8 * size + 4] & 2 == 0 {
		bit_matrix[8 * size + 4]
	} else if bit_matrix[(size - 5) * size + 8] & 2 == 0 {
		bit_matrix[(size - 5) * size + 8]
	} else {
		return None;
	};

	Some((mask_a != 0, mask_b != 0, mask_c != 0))
}

fn qr_to_bitmatrix<'a>(
	lines: impl Iterator<Item = &'a [u16]>,
	bits: &mut [u8],
) -> (&mut [u8], usize) {
	let mut size = 0;
	let mut base = 0;

	for line in lines {
		size = line.len();

		for (i, &x) in line.iter().enumerate() {
			let (top, bot) = match char::from_u32(x as u32).unwrap() {
				' ' => (0, 0),
				'▀' => (1, 0),
				'▄' => (0, 1),
				'█' => (1, 1),
				_ => (2, 2),
			};

			bits[base + i] = top;
			bits[base + size + i] = bot;
		}

		base += 2 * size;
	}

	// we need to slice off the last line, which is all zeros
	// I'm not sure if this is actually necessary
	(&mut bits[.. size * size], size)
}

fn walk_qr(size: usize, mut f: impl FnMut(usize, usize)) {
	let mut x = size - 1;
	let mut y = size - 1;
	let mut direction = -1;

	let (m0, m1, m2) = module_locations(size);

	loop {
		if is_valid_spot(size, x, y, m0, m1, m2) {
			f(x, y);
		}

		if is_valid_spot(size, x - 1, y, m0, m1, m2) {
			f(x - 1, y);
		}

		if x == 8 && y == 0 {
			x -= 1;
		}

		if x == 1 && y == size - 1 {
			break;
		}

		if y == 0 && direction == -1 {
			x -= 2;
			direction = 1;
		} else if y == size - 1 && direction == 1 {
			x -= 2;
			direction = -1;
		} else {
			y = ((y as isize) + direction) as usize;
		}
	}
}

fn module_locations(size: usize) -> (usize, usize, usize) {
	match size {
		45 => (6, 22, 38),
		49 => (6, 24, 42),
		53 => (6, 26, 46),
		_ => unimplemented!(),
	}
}

fn is_valid_spot(
	size: usize,
	x: usize,
	y: usize,
	m0: usize,
	m1: usize,
	m2: usize,
) -> bool {
	if x < 9 && y < 9 {
		return false;
	}

	if x < 9 && y > size - 9 {
		return false;
	}

	if x > size - 9 && y < 9 {
		return false;
	}

	if x < 6 && y > size - 12 {
		return false;
	}

	if y < 6 && x > size - 12 {
		return false;
	}

	if y == 6 {
		return false;
	}

	if in_module(m0, x) && in_module(m1, y) {
		return false;
	}

	if in_module(m1, x) && (in_module(m0, y) || in_module(m1, y) || in_module(m2, y)) {
		return false;
	}

	if in_module(m2, x) && (in_module(m1, y) || in_module(m2, y)) {
		return false;
	}

	true
}

fn in_module(module: usize, coord: usize) -> bool {
	module - 3 < coord && coord < module + 3
}

fn get_mask_func(mask: (bool, bool, bool)) -> fn(usize, usize) -> bool {
	match mask {
		(false, false, false) => |i, j| (i * j) % 2 + (i * j) % 3 == 0,
		(false, false, true) => |i, j| ((i / 2 | 0) + (j / 3 | 0)) % 2 == 0,
		(false, true, false) => |i, j| ((i * j) % 3 + i + j) % 2 == 0,
		(false, true, true) => |i, j| ((i * j) % 3 + i * j) % 2 == 0,
		(true, false, false) => |i, _j| i % 2 == 0,
		(true, false, true) => |i, j| (i + j) % 2 == 0,
		(true, true, false) => |i, j| (i + j) % 3 == 0,
		(true, true, true) => |_i, j| j % 3 == 0,
	}
}

fn data_block_sizes(size: usize) -> (usize, usize, usize, usize) {
	match size {
		45 => (4, 13, 1, 14),
		49 => (4, 14, 2, 15),
		53 => (4, 12, 4, 13),
		_ => unimplemented!(),
	}
}

fn ecc_block_sizes(size: usize) -> usize {
	match size {
		45 => 26,
		49 => 26,
		53 => 24,
		_ => unimplemented!(),
	}
}

fn to_byte(slice: &[u8]) -> u8 {
	let mut out = 0;

	for x in 0 .. 8 {
		if slice[x] & 2 != 0 {
			return 0;
		}

		out ^= slice[x] << (7 - x);
	}

	out
}

fn read_unaligned(slice: &[u8]) -> u8 {
	if slice[0] == 0 || slice[1] == 0 {
		return b'N';
	}

	slice[0] << 4 | slice[1] >> 4
}
