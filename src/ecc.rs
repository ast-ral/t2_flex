use crate::galois::Galois;
use crate::utils::SliceWriter;

use core::ptr::copy_nonoverlapping;

/// the return value for this MUST be dropped before calling it again
unsafe fn solve_matrix(matrix: &mut [Galois], rows: usize) -> &[Galois] {
	static mut SOLUTIONS: [Galois; 100] = [Galois::new(0); 100];

	let solutions = &mut SOLUTIONS[0 .. rows];

	let cols = rows + 1;

	assert!(matrix.len() == rows * cols);

	for i in 0 .. rows {
		if matrix[i * cols + i].data == 0 {
			for j in i + 1 .. rows {
				if matrix[j * cols + i].data != 0 {
					for k in i .. cols {
						matrix[i * cols + k] ^= matrix[j * cols + k];
					}
					break;
				}
			}
		}

		let inverted = matrix[i * cols + i].inv();

		for j in i + 1 .. rows {
			let factor = matrix[j * cols + i] * inverted;
			for k in i .. cols {
				matrix[j * cols + k] ^= matrix[i * cols + k] * factor;
			}
		}
	}

	let last = cols - 1;

	for i in (0 .. rows).rev() {
		let val = matrix[i * cols + last] / matrix[i * cols + i];
		solutions[i] = val;

		for j in (0 .. i).rev() {
			matrix[j * cols + last] ^= val * matrix[j * cols + i];
		}
	}

	solutions
}

pub fn perform_ecc(data: &mut [u8], ecc: &[u8]) {
	static mut COMBINED: [Galois; 100] = [Galois::new(0); 100];
	static mut MATRIX: [Galois; 2000] = [Galois::new(0); 2000];

	let combined = unsafe {
		let start = COMBINED.as_mut_ptr() as *mut u8;
		copy_nonoverlapping(data.as_ptr(), start, data.len());
		let rest = (&mut COMBINED[data.len() ..]).as_mut_ptr() as *mut u8;
		copy_nonoverlapping(ecc.as_ptr(), rest, ecc.len());
		&mut COMBINED[0 .. data.len() + ecc.len()]
	};

	let mut num_errors = 0;

	for i in combined.iter() {
		if i.data == 0 {
			num_errors += 1;
		}
	}

	if num_errors == 0 {
		return;
	}

	let mut matrix = SliceWriter::new(unsafe {&mut MATRIX});

	for i in 0 .. num_errors {
		let mut syndrome = Galois::new(0);

		let decreasing = (0 .. combined.len()).rev();
		for (j, &item) in decreasing.zip(combined.iter()) {
			let coeff = Galois::pow(i * j % 255);
			syndrome ^= coeff * item;

			if item.data == 0 {
				matrix.write(coeff);
			}
		}

		matrix.write(syndrome);
	}

	let matrix = matrix.out();

	let solutions = unsafe {solve_matrix(matrix, num_errors)};

	let mut i = 0;

	for datum in data.iter_mut() {
		if *datum == 0 {
			*datum = solutions[i].data;
			i += 1;
		}
	}
}
