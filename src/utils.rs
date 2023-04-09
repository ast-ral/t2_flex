use core::fmt::{Write, Error};

pub struct SliceWriter<'a, T> {
	slice: &'a mut [T],
	len: usize,
}

impl<'a, T> SliceWriter<'a, T> {
	pub fn new(slice: &'a mut [T]) -> Self {
		Self {
			slice,
			len: 0,
		}
	}

	pub fn write(&mut self, elem: T) {
		self.slice[self.len] = elem;
		self.len += 1;
	}

	pub fn out(self) -> &'a mut [T] {
		&mut self.slice[.. self.len]
	}
}

impl<'a> Write for SliceWriter<'a, u8> {
	fn write_str(&mut self, s: &str) -> Result<(), Error> {
		for &byte in s.as_bytes() {
			self.write(byte);
		}

		Ok(())
	}
}

macro_rules! dbg {
	() => {
		{
			use core::fmt::Write as _;
			::core::write!($crate::print::Stdout, "[{}:{}]\n", ::core::file!(), ::core::line!()).unwrap();
			$crate::print::Stdout::flush();
		}
	};
	($val:expr $(,)?) => {
		// Use of `match` here is intentional because it affects the lifetimes
		// of temporaries - https://stackoverflow.com/a/48732525/1063961
		match $val {
			tmp => {
				use core::fmt::Write as _;
				::core::write!(
					$crate::print::Stdout,
					"[{}:{}] {} = {:#?}\n",
					::core::file!(), ::core::line!(),
					::core::stringify!($val), &tmp,
				).unwrap();
				$crate::print::Stdout::flush();
				tmp
			}
		}
	};
	($($val:expr),+ $(,)?) => {
		($($crate::dbg!($val)),+,)
	};
}
