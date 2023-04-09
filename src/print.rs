use core::fmt::{Write, Error};

pub struct Stdout;

impl Write for Stdout {
	fn write_str(&mut self, str: &str) -> Result<(), Error> {
		unsafe {
			stdout_write(str.as_ptr(), str.len());
		}

		Ok(())
	}
}

impl Stdout {
	pub fn flush() {
		unsafe {
			stdout_flush();
		}
	}
}

#[link(wasm_import_module = "js")]
extern {
	fn stdout_write(ptr: *const u8, len: usize);
	fn stdout_flush();
}
