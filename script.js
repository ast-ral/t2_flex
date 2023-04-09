const real_start = Date.now()

let c = 0

const order_cache = {}

function determine_order(size) {
	if (order_cache[size]) {
		return order_cache[size]
	}

	return order_cache[size] = determine_order_impl(size)
}

function determine_order_impl(size) {
	console.log("cache miss")

	let x = size - 1
	let y = size - 1
	let direction = -1

	const [m0, m1, m2] = module_locations[size]

	const order = []

	while (true) {
		if (is_valid_spot(size, x, y, m0, m1, m2)) {
			order.push([x, y])
		}
		if (is_valid_spot(size, x - 1, y, m0, m1, m2)) {
			order.push([x - 1, y])
		}

		if (x == 8 && y == 0) {
			x -= 1
		}

		if (x == 1 && y == size - 1) {
			break
		}

		if (y == 0 && direction == -1) {
			x -= 2
			direction = 1
		} else if (y == size - 1 && direction == 1) {
			x -= 2
			direction = -1
		} else {
			y += direction
		}
	}

	return order
}

let extract_time = 0

function read_qr(qr) {
	const orig_qr = qr.split("\n")
	const bits = qr_to_bitmatrix(orig_qr)

	const mask_a = orig_qr[4][2] == "?" ? bits[bits.length - 3][8] : bits[8][2]
	const mask_b = orig_qr[4][3] == "?" ? bits[bits.length - 4][8] : bits[8][3]
	const mask_c = orig_qr[4][4] == "?" ? bits[bits.length - 5][8] : bits[8][4]

	if (mask_a == "?" || mask_b == "?" || mask_c == "?") {
		return null
	}

	const mask_func = mask(mask_a, mask_b, mask_c)

	const raw_bitstream = []

	const size = bits.length

	const extract_start = Date.now()

	for (const [x, y] of determine_order(size)) {
		raw_bitstream.push(bits[y][x] ^ (mask_func(y, x) == 0))
	}

	extract_time += Date.now() - extract_start

	const [b1_groups, b1_group_len, b2_groups, b2_group_len] = block_sizes[size]
	const groups = b1_groups + b2_groups
	const ecc_start = b1_groups * b1_group_len + b2_groups * b2_group_len
	const [ecc_block_len, ecc_corrects] = ecc_block_sizes[size]

	const data_vals = []
	for (let i = 0; i < groups; i++) {
		const len = i < b1_groups ? b1_group_len : b2_group_len

		for (let j = 0; j < len; j++) {
			const index = i + groups * j
			data_vals.push(to_byte(raw_bitstream, 8 * index))
		}
	}

	const ecc_vals = []
	for (let i = 0; i < groups; i++) {
		for (let j = 0; j < ecc_block_len; j++) {
			const index = ecc_start + i + groups * j
			ecc_vals.push(to_byte(raw_bitstream, 8 * index))
		}
	}

	const corrected_vals = []
	for (let i = 0; i < groups; i++) {
		const start = i >= b1_groups ? b1_groups * b1_group_len + (i - b1_groups) * b2_group_len : i * b1_group_len
		const len = i >= b1_groups ? b2_group_len : b1_group_len

		corrected_vals.push(...verify_ecc(data_vals.slice(start, start + len), ecc_vals.slice(i * ecc_block_len, (i + 1) * ecc_block_len), ecc_corrects))
	}

	const len = read_unaligned(corrected_vals, 0)

	const out = []
	for (let i = 0; i < len; i++) {
		const char_code = read_unaligned(corrected_vals, i + 1)
		out.push(String.fromCharCode(char_code))
	}
	return out.join("")
}

function to_byte(arr, i) {
	return arr[i] << 7 | arr[i + 1] << 6 | arr[i + 2] << 5 | arr[i + 3] << 4 | arr[i + 4] << 3 | arr[i + 5] << 2 | arr[i + 6] << 1 | arr[i + 7]
}

function read_unaligned(arr, i) {
	return arr[i] << 4 & 0xf0 | arr[i + 1] >> 4
}

const block_sizes = {
	45: [4, 13, 1, 14],
	49: [4, 14, 2, 15],
	53: [4, 12, 4, 13],
}

const ecc_block_sizes = {
	45: [26, 13],
	49: [26, 13],
	53: [24, 12],
}

const module_locations = {
	45: [6, 22, 38],
	49: [6, 24, 42],
	53: [6, 26, 46],
}

function is_valid_spot(size, x, y, m0, m1, m2) {
	if (x < 9 && y < 9) {
		return false
	}

	if (x < 9 && y > size - 9) {
		return false
	}

	if (x > size - 9 && y < 9) {
		return false
	}

	if (x < 6 && y > size - 12) {
		return false
	}

	if (y < 6 && x > size - 12) {
		return false
	}

	if (y == 6) {
		return false
	}

	if (in_module(m0, x) && in_module(m1, y)) {
		return false
	}

	if (in_module(m1, x) && (in_module(m0, y) || in_module(m1, y) || in_module(m2, y))) {
		return false
	}

	if (in_module(m2, x) && (in_module(m1, y) || in_module(m2, y))) {
		return false
	}

	return true
}

function in_module(module, coord) {
	return module - 3 < coord && coord < module + 3
}

function qr_to_bitmatrix(qr) {
	const out = []

	for (const line of qr) {
		const upper_line = []
		const lower_line = []

		for (let i = 0; i < line.length; i++) {
			switch (line[i]) {
				case " ": {
					upper_line.push(0)
					lower_line.push(0)
					break
				}

				case "▀": {
					upper_line.push(1)
					lower_line.push(0)
					break
				}

				case "▄": {
					upper_line.push(0)
					lower_line.push(1)
					break
				}

				default: {
					upper_line.push(1)
					lower_line.push(1)
					break
				}
			}
		}

		out.push(upper_line, lower_line)
	}

	// pop the last line of 0s
	out.pop()

	return out
}

function mask(a, b, c) {
	// takes in the three bits in the mask
	// outputs a function that you should == to 0 to determine whether to flip the bit

	const mask_code = a * 4 + b * 2 + c

	switch (mask_code) {
		case 0: return (i, j) => (i * j) % 2 + (i * j) % 3
		case 1: return (i, j) => ((i / 2 | 0) + (j / 3 | 0)) % 2
		case 2: return (i, j) => ((i * j) % 3 + i + j) % 2
		case 3: return (i, j) => ((i * j) % 3 + i * j) % 2
		case 4: return (i, j) => i % 2
		case 5: return (i, j) => (i + j) % 2
		case 6: return (i, j) => (i + j) % 3
		case 7: return (i, j) => j % 3
	}
}

const mod = 0b100011101
const alpha = 2

const mult_table = new Uint8Array(65536)

for (let a = 0; a < 256; a++) {
	for (let b = 0; b < 256; b++) {
		let product = 0

		for (let i = 0; i < 8; i++) {
			if (a & (1 << i)) {
				product ^= b << i
			}
		}

		for (let i = 8; i--;) {
			if (product & (256 << i)) {
				product ^= mod << i
			}
		}

		mult_table[a * 256 + b] = product
	}
}

function mult(a, b) {
	return mult_table[a << 8 | b]
}

const inv = new Uint8Array(256)

for (let p1 = 1; p1 < 256; p1++) {
	const p2 = mult(p1, p1)
	const p4 = mult(p2, p2)
	const p8 = mult(p4, p4)
	const p16 = mult(p8, p8)
	const p32 = mult(p16, p16)
	const p64 = mult(p32, p32)
	const p128 = mult(p64, p64)
	const p192 = mult(p64, p128)
	const p224 = mult(p32, p192)
	const p240 = mult(p16, p224)
	const p248 = mult(p8, p240)
	const p252 = mult(p4, p248)
	const p254 = mult(p2, p252)

	inv[p1] = p254
}

const powers = new Uint8Array(255)

let alpha_powers_accum = 1

for (let i = 0; i < 255; i++) {
	powers[i] = alpha_powers_accum
	alpha_powers_accum = mult(alpha, alpha_powers_accum)
}

/*
function solve_matrix(matrix, size) {
	// downward propagation

	//const size = matrix.length
	const row_len = size + 1

	for (let i = 0; i < size; i++) {
		if (!matrix[i * row_len + i]) {
			for (let j = i + 1; j < size; j++) {
				if (matrix[j * row_len + i]) {
					for (let k = i; k < size + 1; k++) {
						matrix[i * row_len + k] ^= matrix[j * row_len + k]
					}
					break
				}
			}
		}

		const inverted = inv[matrix[i * row_len + i]]

		for (let j = i + 1; j < size; j++) {
			const factor = mult(matrix[j * row_len + i], inverted)
			for (let k = i; k < size + 1; k++) {
				matrix[j * row_len + k] ^= mult(matrix[i * row_len + k], factor)
			}
		}
	}

	// upward propagation

	const solutions = new Uint8Array(size)

	for (let i = size; i--;) {
		const val = mult(matrix[i * row_len + size], inv[matrix[i * row_len + i]])
		solutions[i] = val

		for (let j = i; j--;) {
			matrix[j * row_len + size] ^= mult(val, matrix[j * row_len + i])
		}
	}

	return solutions
}

function verify_ecc(data, ecc, ecc_corrects) {
	const combined = [...data, ...ecc]

	combined.reverse()

	const syndrome = []

	for (let i = 0; i < ecc_corrects * 2; i++) {
		let accum = 0

		for (let j = 0; j < combined.length; j++) {
			accum ^= mult(combined[j], powers[(i * j) % 255])
		}

		syndrome.push(accum)
	}

	const matrix_size = ecc_corrects
	const matrix_row_len = matrix_size + 1
	const matrix = new Uint8Array(matrix_size * matrix_row_len)

	for (let i = 0; i < matrix_size; i++) {
		for (let j = 0; j < matrix_row_len; j++) {
			matrix[i * matrix_row_len + j] = syndrome[i + j]
		}
	}

	const sigmas = solve_matrix(matrix, matrix_size)

	const erroring = []

	for (let i = 0; i < combined.length; i++) {
		let accum = powers[(i * ecc_corrects) % 255]

		for (let j = ecc_corrects; j--;) {
			accum ^= mult(sigmas[j], powers[(i * j) % 255])
		}

		if (!accum) {
			erroring.push(i)
		}
	}

	const correction_matrix_size = erroring.length
	const correction_matrix_row_len = erroring.length + 1
	const correction_matrix = new Uint8Array(correction_matrix_size * correction_matrix_row_len)

	for (let i = 0; i < correction_matrix_size; i++) {
		let j = 0
		for (let loc of erroring) {
			correction_matrix[i * correction_matrix_row_len + j] = powers[(i * loc) % 255]
			j++
		}
		correction_matrix[i * correction_matrix_row_len + j] = syndrome[i]
	}

	const corrections = solve_matrix(correction_matrix, correction_matrix_size)

	for (let i = 0; i < erroring.length; i++) {
		combined[erroring[i]] ^= corrections[i]
	}

	combined.reverse()

	return combined.slice(0, data.length)
}
*/

function solve_matrix(matrix) {
	// downward propagation

	const size = matrix.length

	for (let i = 0; i < size; i++) {
		if (!matrix[i][i]) {
			for (let j = i + 1; j < size; j++) {
				if (matrix[j][i]) {
					for (let k = i; k < size + 1; k++) {
						matrix[i][k] ^= matrix[j][k]
					}
					break
				}
			}
		}

		const inverted = inv[matrix[i][i]]

		for (let j = i + 1; j < size; j++) {
			const factor = mult(matrix[j][i], inverted)
			for (let k = i; k < size + 1; k++) {
				matrix[j][k] ^= mult(matrix[i][k], factor)
			}
		}
	}

	// upward propagation

	const solutions = new Uint8Array(size)

	for (let i = size; i--;) {
		const val = mult(matrix[i][size], inv[matrix[i][i]])
		solutions[i] = val

		for (let j = i; j--;) {
			matrix[j][size] ^= mult(val, matrix[j][i])
		}
	}

	return solutions
}

function verify_ecc(data, ecc, ecc_corrects) {
	const combined = [...data, ...ecc]

	combined.reverse()

	const syndrome = []

	for (let i = 0; i < ecc_corrects * 2; i++) {
		let accum = 0

		for (let j = 0; j < combined.length; j++) {
			accum ^= mult(combined[j], powers[(i * j) % 255])
		}

		syndrome.push(accum)
	}

	const matrix = []

	for (let i = 0; i < ecc_corrects; i++) {
		const line = []

		for (let j = 0; j <= ecc_corrects; j++) {
			line.push(syndrome[i + j])
		}

		matrix.push(line)
	}

	const sigmas = solve_matrix(matrix)

	const erroring = []

	for (let i = 0; i < combined.length; i++) {
		let accum = 0

		accum ^= powers[(i * ecc_corrects) % 255]

		for (let j = ecc_corrects; j--;) {
			accum ^= mult(sigmas[j], powers[(i * j) % 255])
		}

		if (!accum) {
			erroring.push(i)
		}
	}

	const correction_matrix = []

	for (let i = 0; i < erroring.length; i++) {
		const line = []

		for (let loc of erroring) {
			line.push(powers[(i * loc) % 255])
		}

		line.push(syndrome[i])

		correction_matrix.push(line)
	}

	const corrections = solve_matrix(correction_matrix)

	for (let i = 0; i < erroring.length; i++) {
		combined[erroring[i]] ^= corrections[i]
	}

	combined.reverse()

	return combined.slice(0, data.length)
}

const qr = "█▀▀▀▀▀█ ▄▄    ▄ ▀▄█▀  █? █ █ ▀▀▀█▀▄▄ █▄▄█ █▀▀▀▀▀█\n█ ███ █  █ █▀▀▄▄   ?▀█   ▀▄▀ ▄▀ ▀▀▄▄▀▄ █▀ █ ███ █\n█ ▀▀▀ █ ▄▀█▀ ▄ █▀ ▄█▄▀█▀▀▀█▀▄█ ▄█▀▄█▄▄▄   █ ▀▀▀ █\n▀▀▀▀▀▀▀ █▄█ █▄▀▄█ ▀ █▄█ ▀ █ █ █ ▀ █ ▀ █▄█ ▀▀▀▀▀▀▀\n▄  ▄▀▀▀█  ▄▀▀█▄▀▄█▄█▀▄▀██▀▀▄ ▄▀▀▄█ ▄██▄ ▀▄█▀▄  ▀ \n▀▀▀▀▀█▀ ██ ▄  ▀▀ ▄▀    ▄▀▄▄▄▄▄ ▄▄█ █▄ ▀█▄▄▀▀▄█▄?▄\n▄▄█▄█ ▀██▄█▀▄ ▄ ▄███▀ ▄▄█ ▀ ▄ ▀▄▄  █▀█▄ ▀█▄█▀ ▀▀ \n █▄▀█ ▀▀▄▀▄▄ █▄█ █? ▄ ▀ ▄█   ▄██▄  ▀▄███ █▀▄▄▀▄ ▄\n▀ ▄  █▀█▄█▀ █ ▄▀   █▄▄▀▀▀▀█ ▄▄▄██▄█▀▀▀ ▀ ▀█ █▀█ ▀\n ▄ ▀▀ ▀ ▄▀██▄  █▀▄▀▀▀ ▄▀▄▀▀▄ ▄▄█ █▀▄█  ▄█  ▀▄▄▄█▄\n▄▀▄▄ ▄▀▀▀█▄█  ██▄▄▄▀ ██ █▀▄ █  ▀▀█ █▀█▄ ▀ █ █▄█▄▀\n  ███▀▀▀█▄▄▀▀ ▀▄ ▀ ▄▄██▀▀▀█  ▀██ ▀ ██▀▀▀█▀▀▀███? \n ▄ ██ ▀ █▀██▀▀  ▄ ▀██▀█ ▀ █▀  █▀██▀▀▀█▄▄█ ▀ █▄▀  \n █▄███▀██▄ ▄▄▀▄▄▀████▄██▀▀█  ▀▀ ▄? ▀▄▀▀ ?██▀█ ██ \n▀ ▀█▄ ▀▄▄  █ ▀█▄▀ █▄ █▄█▄ ▄▀▄▄  █▄▀▀? █▄ ▄▀▀▀▄█  \n█▀ █▄▀▀▄ ▀▀ ▀▄▀  █ █▄█ █▀▄▄▄█ ▀?▀▀ █▀ ▀▀ ▄▄▄█ ▄█▄\n █ ▄█▀▀ ███ ▀▀▀▀▄▀█▀▀██▀ ▀▀██▀█▄ ▄ ▀ █▄▄ ▀▄▀▄██▀ \n▀▄█▄█▄▀▀▀ ██▀█▀▀█▄▀ █▀▄▀▄▄█ █▀▀██▀▄ █▀█▀ █▄ ▀██ ?\n█▀█▄▄▀▀▄█ ▀?▀▀▄██▀▄▄ ▄ ▄█▀   ▀▄▀██  ▀█▄ █▄▀▀▄▄██ \n █▄▄ ▀▀▀▄▀▀▄▄▀█▀▀▄▀█  █▀  █ ██▀█▄▄▄█▄ ▀▀▄█▄▄ ▄█  \n▀▀▀   ▀ █▀██ ▄█▀  █▀▀▄█▀▀▀█▄  ▄██▀ ▀█▄█ █▀▀▀█  ▀▀\n█▀▀▀▀▀█ █ ▀▀█ ▄▀▀█▀▄▄▄█ ▀ ██▄  █▀ █▄█▀▄▄█ ▀ ?▀▄▀ \n█ ███ █ ▀▀ ▄ ███▄▀██ █▀██▀█  ▄▄ ▀  ?▀██ ▀█▀█▀ ▀▀█\n█ ▀▀▀ █  █ █ ▄▀  ▄ ▀▀▄ ██▄▄▀█ ▀█▄ ▄█▄▀█▄  ▀  ▀▄▄ \n▀▀▀▀▀▀▀  ▀▀▀▀    ▀▀▀    ▀  ▀▀▀  ▀   ▀▀ ▀▀▀  ▀▀▀▀▀"
/*
const qr = `█▀▀▀▀▀█ ███▄▄▀█▄▄▄▀ ▀█▄▀▀▄▀█▀ª▀▀▀█▀ ▄ █ ▀ █▄  █▀▀▀▀▀█
█ █¦█ █ ▄▀█▄▀▄▄▄▄█▄▄  ▀ ██▀ §▄▀▀  ▀▄▀█ ▄ ▀▄▀▄ █ ███ █
█ ▀▀▀ █ ██▄▀  ▀▄▄█▀   ▄ █▀▀▀█▀▀▄▀▄█▀▀▄▀▄▀██   █ ▀▀▀ █
▀▀▀▀▀▀▀ ▀ ▀ ▀▄█▄█ █ ▀ ▀▄█ ▀ █▄▀ ▀ ▀▄█ ▀▄▀ ▀▄▀ ▀▀▀▀▀▀¨
▄ ▄▀▄▄▀▄ ████▄ █ █▄▀ ▄  ▀█▀▀▀▄▀██ ▄██▀▀▀▀ ▀█▀  ▀▀█ ██
 ▄▄▀▀▄▀███▀▄   █  ▀ ▀▀▄▀██▀▄▀█▀ █▄▀ ▄█▄█▄▄▄█▄▄▀▀▄ ▄█▄
█▄▄¦ ▀▀▄▄█▄▀▄ ▀ █▄▀ ▄▄█▀ █▀ ▄██ ▄▀  █   ▀▀ █  ▄▄▀ ▄█ 
▀█ ▀▄▄▀▄▀▀   ▄█▀▄▄▀▀▄▄██ ▀ ▄██▄▀▄▀███▄▀█▄█ ███▄▄█▄▀▀█
▄ ▀ ▀█▀▀██▄▀▄▀▄███▄ ▄ █▄▀ ▀█▄█▀▄▀▄▀██▀▄▄ ▄▀▀▄▀ ▀▀█▄ ▄
▄▀▄▀▄▀▀▄▀▄▀▀  ▀▄██▄ █▀▀▄  █ª  ▀▄▄▄▀█▀  ▀ █ ▄▄  ██▄ ██
▀▄▀ ██▀▀█▄█▄▀▄ ▄█▀▄▀ ▄▄¢ █    █▀ ▀█▄▄ ▀▀§▀ ▀▀▄▀ ▀▄▀ █
█  ▄▄█▀█▀█▄█▄ ▄▀█▀ ██▀▄ ▀█▄▄ ▀ ▀ ██▀▄▄ █▄▄    ▀▄▄ ▄▄▄
▄▀▀▀█▀▀▀█ ▄▀▀▄ ▄▄ ▄██▀▄▄█▀▀▀█▄▄▀▄█§▀▀▄ ▀██ ▄©▀▀▀█ ▄▄▀
▄▀  █ ▀ █▄ ▀ █ █ ▀██   ▀█ ▀ █  ▄███ ██▀ ██ ▄█ ▀ █▄▀█▀
█▄█ █▀▀█▀ ▀ ██ ██▀ ▀█  ▄▀▀▀▀█ ▀█▀  █▀█▄▀▄█ ▄▀▀▀█▀█  ▄
▀▀▄ ▀▄▀▀▄▄▄▄▀█  ▀ █▄▄▀▄ ▄▀▄▄▀▄▀▄▄█  ▄▀ █ █▄ ▄▀▀ ▀▀ ▀▀
▀██ ▀ ▀▄▀▄██ ▀▀▄▄▀ ª█▄▄ ▀█▄ ██▀▄▄▄▄▄▀ ▀▄██  ██▄█  ▀▀▄
█▄█▀▄█▀▄█ ▄▀█   ▀▀▄  ▀█▄█  ████ ▄ ▄ █ ▄§▄  ▀▀█▄  ▄█▄▄
▄▀▀ ▀█▀ ▄ ▄ ▄▄▄▄█▄██▄▄█▀███▄▀▀█▄██  ██▀▀█▀ ▄ ▄▄  ▄▄▄▀
▀▄█▀█▄▀  ▀§██ ▀▄▀▄███▀█▀█▄ ▀  ▄ ▀▄▀██████▀  ████ ▀▀▀▀
 ▄█▄▀█▀▀█▀▀▀▀ ▄▄▄ █▀▄█▄ª▄  ▀ ▄ ▀ ██▀▀▄▄█▄ ▀▀█▄ █ ▄ ▄▄
▀█▄▀▀▀▀ ▄▄▄▄▀ ▀▀▄ █▄▀▄▀▄ ▄ █▀▄▀   ▀▄█  ▄▀ ▄▄▀█▀▄ █ █▀
   ▀  ▀▀▄▄▄▀█▄▄█▄▄▀▀▄▄▄▄█▀▀¨█▄█▄▄█ ██  ▀█▀ ▄█▀▀▀█▄▀▄█
█▀▀▀▀▀█  █  ▄█▀█▀█▀  ▄▄▄█ ▀ █▀▀█¡██▄▄§ █▄  ▀█ ▀ █▀▄▀ 
█ ███ █ ▄   █▄█▄▄▀ █▀ ▀▀▀█▀██▀  ▄██§██ ▄▀ ▀ ██▀███▄█▀
█ ▀▀▀ █  ▀ ▀█▄ ▄▄▀▄▀█   ▄█ ▄█▄▄█▀█ █▀ █▄█▀ █▄▀▀ █  █▀
▀▀▀▀▀▀▀   ▀ ▀ ▀▀  ▀▀  ▀▀    ▀ ▀     ▀ ▀▀  ▀▀  ▀▀ ▀ ▀ `
*/
/*
const qr = `█▀▀▀▀▀█ ███▄▄▀█▄▄▄▀ ▀█▄▀▀▄▀█▀▀▀▀▀█▀ ▄ █ ▀ █▄  █▀▀▀▀▀█
█ ███ █ ▄▀█▄▀▄▄▄▄█▄▄  ▀ ██▀ ▀▄▀▀  ▀▄▀█ ▄ ▀▄▀▄ █ ███ █
█ ▀▀▀ █ ██▄▀  ▀▄▄█▀   ▄ █▀▀▀█▀▀▄▀▄█▀▀▄▀▄▀██   █ ▀▀▀ █
▀▀▀▀▀▀▀ ▀ ▀ ▀▄█▄█ █ ▀ ▀▄█ ▀ █▄▀ ▀ ▀▄█ ▀▄▀ ▀▄▀ ▀▀▀▀▀▀▀
▄ ▄▀▄▄▀▄ ████▄ █ █▄▀ ▄  ▀█▀▀▀▄▀██ ▄██▀▀▀▀ ▀█▀  ▀▀█ ██
 ▄▄▀▀▄▀███▀▄   █  ▀ ▀▀▄▀██▀▄▀█▀ █▄▀ ▄█▄█▄▄▄█▄▄▀▀▄ ▄█▄
█▄▄▀ ▀▀▄▄█▄▀▄ ▀ █▄▀ ▄▄█▀ █▀ ▄██ ▄▀  █   ▀▀ █  ▄▄▀ ▄█ 
▀█ ▀▄▄▀▄▀▀   ▄█▀▄▄▀▀▄▄██ ▀ ▄██▄▀▄▀███▄▀█▄█ ███▄▄█▄▀▀█
▄ ▀ ▀█▀▀██▄▀▄▀▄███▄ ▄ █▄▀ ▀█▄█▀▄▀▄▀██▀▄▄ ▄▀▀▄▀ ▀▀█▄ ▄
▄▀▄▀▄▀▀▄▀▄▀▀  ▀▄██▄ █▀▀▄  █▄  ▀▄▄▄▀█▀  ▀ █ ▄▄  ██▄ ██
▀▄▀ ██▀▀█▄█▄▀▄ ▄█▀▄▀ ▄▄▄ █    █▀ ▀█▄▄ ▀▀▀▀ ▀▀▄▀ ▀▄▀ █
█  ▄▄█▀█▀█▄█▄ ▄▀█▀ ██▀▄ ▀█▄▄ ▀ ▀ ██▀▄▄ █▄▄    ▀▄▄ ▄▄▄
▄▀▀▀█▀▀▀█ ▄▀▀▄ ▄▄ ▄██▀▄▄█▀▀▀█▄▄▀▄██▀▀▄ ▀██ ▄█▀▀▀█ ▄▄▀
▄▀  █ ▀ █▄ ▀ █ █ ▀██   ▀█ ▀ █  ▄███ ██▀ ██ ▄█ ▀ █▄▀█▀
█▄█ █▀▀█▀ ▀ ██ ██▀ ▀█  ▄▀▀▀▀█ ▀█▀  █▀█▄▀▄█ ▄▀▀▀█▀█  ▄
▀▀▄ ▀▄▀▀▄▄▄▄▀█  ▀ █▄▄▀▄ ▄▀▄▄▀▄▀▄▄█  ▄▀ █ █▄ ▄▀▀ ▀▀ ▀▀
▀██ ▀ ▀▄▀▄██ ▀▀▄▄▀ ▄█▄▄ ▀█▄ ██▀▄▄▄▄▄▀ ▀▄██  ██▄█  ▀▀▄
█▄█▀▄█▀▄█ ▄▀█   ▀▀▄  ▀█▄█  ████ ▄ ▄ █ ▄ ▄  ▀▀█▄  ▄█▄▄
▄▀▀ ▀█▀ ▄ ▄ ▄▄▄▄█▄██▄▄█▀███▄▀▀█▄██  ██▀▀█▀ ▄ ▄▄  ▄▄▄▀
▀▄█▀█▄▀  ▀▄██ ▀▄▀▄███▀█▀█▄ ▀  ▄ ▀▄▀██████▀  ████ ▀▀▀▀
 ▄█▄▀█▀▀█▀▀▀▀ ▄▄▄ █▀▄█▄▀▄  ▀ ▄ ▀ ██▀▀▄▄█▄ ▀▀█▄ █ ▄ ▄▄
▀█▄▀▀▀▀ ▄▄▄▄▀ ▀▀▄ █▄▀▄▀▄ ▄ █▀▄▀   ▀▄█  ▄▀ ▄▄▀█▀▄ █ █▀
   ▀  ▀▀▄▄▄▀█▄▄█▄▄▀▀▄▄▄▄█▀▀▀█▄█▄▄█ ██  ▀█▀ ▄█▀▀▀█▄▀▄█
█▀▀▀▀▀█  █  ▄█▀█▀█▀  ▄▄▄█ ▀ █▀▀█ ██▄▄█ █▄  ▀█ ▀ █▀▄▀ 
█ ███ █ ▄   █▄█▄▄▀ █▀ ▀▀▀█▀██▀  ▄██▄██ ▄▀ ▀ ██▀███▄█▀
█ ▀▀▀ █  ▀ ▀█▄ ▄▄▀▄▀█   ▄█ ▄█▄▄█▀█ █▀ █▄█▀ █▄▀▀ █  █▀
▀▀▀▀▀▀▀   ▀ ▀ ▀▀  ▀▀  ▀▀    ▀ ▀     ▀ ▀▀  ▀▀  ▀▀ ▀ ▀ `*/

const start = Date.now()

for (let i = 0; i < 150; i++) {
	read_qr(qr)
}

console.log(Date.now() - start)
console.log(start - real_start)
console.log(Date.now() - real_start)
console.log(read_qr(qr))
console.log(extract_time)
