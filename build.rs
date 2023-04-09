use std::io::Write;

const MOD: u16 = 0b100011101;
const ALPHA: u8 = 2;

fn mult(a: u8, b: u8) -> u8 {
	let mut product: u16 = 0;

	for i in 0 .. 8 {
		if a & (1 << i) != 0 {
			product ^= (b as u16) << i;
		}
	}

	for i in (0 .. 8).rev() {
		if product & (256 << i) != 0 {
			product ^= MOD << i;
		}
	}

	product as u8
}

fn inv(p1: u8) -> u8 {
	let p2 = mult(p1, p1);
	let p4 = mult(p2, p2);
	let p8 = mult(p4, p4);
	let p16 = mult(p8, p8);
	let p32 = mult(p16, p16);
	let p64 = mult(p32, p32);
	let p128 = mult(p64, p64);
	let p192 = mult(p64, p128);
	let p224 = mult(p32, p192);
	let p240 = mult(p16, p224);
	let p248 = mult(p8, p240);
	let p252 = mult(p4, p248);
	let p254 = mult(p2, p252);

	p254
}

fn pow(x: usize) -> u8 {
	let mut out = 1;

	for _ in 0 .. x {
		out = mult(out, ALPHA);
	}

	out
}

fn main() {
	use std::fs::File;

	let mut out = File::create("src/autogen.rs").unwrap();

	write!(out, "pub const MULT: [u8; 256 * 256] = [\n").unwrap();

	for a in 0 ..= 255 {
		for b in 0 ..= 255 {
			write!(out, "\t{},\n", mult(a, b)).unwrap();
		}
	}

	write!(out, "];\n").unwrap();

	write!(out, "pub const INV: [u8; 256] = [\n").unwrap();

	for a in 0 ..= 255 {
		write!(out, "\t{},\n", inv(a)).unwrap();
	}

	write!(out, "];\n").unwrap();

	write!(out, "pub const POW: [u8; 255] = [\n").unwrap();

	for x in 0 .. 255 {
		write!(out, "\t{},\n", pow(x)).unwrap();
	}

	write!(out, "];\n").unwrap();
}
