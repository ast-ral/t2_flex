use core::panic::PanicInfo;
use core::arch::wasm32;
use core::fmt::{Write, Error};

// this *cannot* be exposed to the outside world
// because the write_str impl can cause UB if used improperly
struct PanicWriter;

impl Write for PanicWriter {
	fn write_str(&mut self, str: &str) -> Result<(), Error> {
		unsafe {
			add_str(str);
		}

		Ok(())
	}
}

#[link(wasm_import_module = "js")]
extern {
	fn panic_start();
	fn panic_add_str(msg: *const u8, len: usize);
	fn panic_end();
}

unsafe fn add_str(str: &str) {
	panic_add_str(str.as_ptr(), str.len())
}

#[panic_handler]
unsafe fn panic_handler(panic_info: &PanicInfo) -> ! {
	panic_start();

	if let Some(msg) = panic_info.payload().downcast_ref::<&str>() {
		add_str(msg);
	} else if let Some(args) = panic_info.message() {
		let _ = write!(PanicWriter, "{}\n", args);
	} else {
		add_str("panic message could not be downcast");
	};

	if let Some(loc) = panic_info.location() {
		let _ = write!(PanicWriter, "{}:L{}C{}", loc.file(), loc.line(), loc.column());
	}

	panic_end();

	wasm32::unreachable()
}
