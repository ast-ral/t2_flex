use core::ops::{BitXor, BitXorAssign, Mul, Div};

use crate::autogen::{MULT, INV, POW};

#[repr(transparent)]
#[derive(Copy, Clone, Debug)]
pub struct Galois {
	pub data: u8,
}

impl Galois {
	pub const fn new(data: u8) -> Self {
		Galois {data}
	}

	pub fn pow(x: usize) -> Self {
		Self::new(POW[x])
	}

	pub fn inv(&self) -> Self {
		Self::new(INV[self.data as usize])
	}
}

impl BitXor for Galois {
	type Output = Self;

	fn bitxor(self, other: Self) -> Self {
		Self::new(self.data ^ other.data)
	}
}

impl BitXorAssign for Galois {
	fn bitxor_assign(&mut self, other: Self) {
		self.data ^= other.data
	}
}

impl Mul for Galois {
	type Output = Self;

	fn mul(self, other: Self) -> Self {
		Self::new(MULT[self.data as usize * 256 + other.data as usize])
	}
}

impl Div for Galois {
	type Output = Self;

	fn div(self, other: Self) -> Self {
		self * other.inv()
	}
}
