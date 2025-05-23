const {readFileSync: read_file_sync} = require("fs")

const path = "./target/wasm32-unknown-unknown/debug/t2_flex.wasm"
const file = read_file_sync(path)

//console.log([...file].map(i => i.toString(16).padStart(2, "0")).join(""))

//const hex = "0061736d01000000010f036000017c60037e7e7e017e600000021101026a730a7261775f72616e646f6d000003040301020005030100110619037f01418080c0000b7f00419484c0000b7f00419484c0000b074105066d656d6f727902000b6c6f636b5f72616e646f6d00020b6e6578745f72616e646f6d00030a5f5f646174615f656e6403010b5f5f686561705f6261736503020aa30603270020022001852001421a888522014211882001852201200085420b882001422d888542ff1f830bad0403047c057e017f0340108080808000210010808080800021011080808080002102108080808000220344000000000000f03fa0bd42ffffffffffffff07832204200244000000000000f03fa0bd42ffffffffffffff07832205200144000000000000f03fa0bd42ffffffffffffff0783220610818080800021072005420c8620052006200044000000000000f03fa0bd42ffffffffffffff0783108180808000842205421a8820058520072004420c868422044217862004852206852107200642118821062005421786210820032004420c884280808080808080f83f84bf44000000000000f0bfa0620d0020072006852106200820058521072005420c884280808080808080f83f84bf44000000000000f0bfa02002620d00200620078521082006420c884280808080808080f83f84bf44000000000000f0bfa02001620d0020064226882007421d88852008420c88854280808080808080f83f84bf44000000000000f0bfa02000620d000b03402005210720042206210510808080800020062007852006421a88852204421188200485220442228820048522044217862004852004422e86852204420c884280808080808080f83f84bf44000000000000f0bfa0610d000b41c0002109034020072105024020090d004100200537038880c080004100200637038080c080004100410036029084c080001083808080001a0f0b2005421a88200585200642178620068522048520044211888521072009417f6a2109200521060c000b0bc90102017f037e0240410028029084c0800022000d00410029038880c080002101410029038080c08000210241807c210002400340200121032000450d012000419084c080006a2002420c884280808080808080f83f84bf44000000000000f0bfa03903002003421a8820038520024217862002852202852002421188852101200041086a2100200321020c000b0b4100200337038880c080004100200237038080c0800041c00021000b41002000417f6a220036029084c080002000410374419080c080006a2b03000b"

function to_buffer(hex) {
	const out = new Uint8Array(hex.length / 2)

	for (let i = 0; i < hex.length; i += 2) {
		out[i / 2] = parseInt(hex.slice(i, i + 2), 16)
	}

	return out.buffer
}

const load_start = Date.now()

const src = file
const mod = new WebAssembly.Module(src)
const inst = new WebAssembly.Instance(mod, {js: {
	raw_random: Math.random,
	panic_start,
	panic_add_str,
	panic_end,
	stdout_write,
	stdout_flush,
}})

console.log(`loading in ${Date.now() - load_start}ms`)

function is_little_endian() {
	const u32_arr = new Uint32Array(1)
	u32_arr[0] = 0xdeadc0de

	const view = new DataView(u32_arr.buffer)

	if (view.getUint32(0, true) == 0xdeadc0de) {
		return true
	}

	if (view.getUint32(0, false) == 0xdeadc0de) {
		return false
	}

	throw new Error("unknown endianness?")
}

const {
	memory,
	lock_random,
	anticorrupt,
	str_in,
	str_out,
	process_str_in,
} = inst.exports

console.log(Object.keys(inst.exports))

const buf = new DataView(memory.buffer)
const endian = is_little_endian()

/*
lock_random()

for (let i = 0; i < 1000000; i++) {
	if (next_random() != Math.random()) {
		throw new Error("random mismatch")
	}
}
*/

const print_buffer = []

function stdout_write(ptr, len) {
	print_buffer.push(str_from_ptr(ptr, len))
}

function stdout_flush() {
	process.stdout.write(print_buffer.join(""))
	print_buffer.length = 0
}

const panic_info = []

function panic_start() {
	console.log("a panic occurred!")
	panic_info.length = 0
}

function panic_add_str(ptr, len) {
	panic_info.push(str_from_ptr(ptr, len))
}

function panic_end() {
	console.log(panic_info.join(""))
}

function str_from_ptr(ptr, len) {
	const out = []
	for (let i = 0; i < len; i++) {
		out.push(buf.getUint8(ptr + i, endian))
	}
	return String.fromCharCode(...out)
}

const start = Date.now()

//const qr = "█▀▀▀▀▀█ ▄▄    ▄ ▀▄█▀  █? █ █ ▀▀▀█▀▄▄ █▄▄█ █▀▀▀▀▀█\n█ ███ █  █ █▀▀▄▄   ?▀█   ▀▄▀ ▄▀ ▀▀▄▄▀▄ █▀ █ ███ █\n█ ▀▀▀ █ ▄▀█▀ ▄ █▀ ▄█▄▀█▀▀▀█▀▄█ ▄█▀▄█▄▄▄   █ ▀▀▀ █\n▀▀▀▀▀▀▀ █▄█ █▄▀▄█ ▀ █▄█ ▀ █ █ █ ▀ █ ▀ █▄█ ▀▀▀▀▀▀▀\n▄  ▄▀▀▀█  ▄▀▀█▄▀▄█▄█▀▄▀██▀▀▄ ▄▀▀▄█ ▄██▄ ▀▄█▀▄  ▀ \n▀▀▀▀▀█▀ ██ ▄  ▀▀ ▄▀    ▄▀▄▄▄▄▄ ▄▄█ █▄ ▀█▄▄▀▀▄█▄?▄\n▄▄█▄█ ▀██▄█▀▄ ▄ ▄███▀ ▄▄█ ▀ ▄ ▀▄▄  █▀█▄ ▀█▄█▀ ▀▀ \n █▄▀█ ▀▀▄▀▄▄ █▄█ █? ▄ ▀ ▄█   ▄██▄  ▀▄███ █▀▄▄▀▄ ▄\n▀ ▄  █▀█▄█▀ █ ▄▀   █▄▄▀▀▀▀█ ▄▄▄██▄█▀▀▀ ▀ ▀█ █▀█ ▀\n ▄ ▀▀ ▀ ▄▀██▄  █▀▄▀▀▀ ▄▀▄▀▀▄ ▄▄█ █▀▄█  ▄█  ▀▄▄▄█▄\n▄▀▄▄ ▄▀▀▀█▄█  ██▄▄▄▀ ██ █▀▄ █  ▀▀█ █▀█▄ ▀ █ █▄█▄▀\n  ███▀▀▀█▄▄▀▀ ▀▄ ▀ ▄▄██▀▀▀█  ▀██ ▀ ██▀▀▀█▀▀▀███? \n ▄ ██ ▀ █▀██▀▀  ▄ ▀██▀█ ▀ █▀  █▀██▀▀▀█▄▄█ ▀ █▄▀  \n █▄███▀██▄ ▄▄▀▄▄▀████▄██▀▀█  ▀▀ ▄? ▀▄▀▀ ?██▀█ ██ \n▀ ▀█▄ ▀▄▄  █ ▀█▄▀ █▄ █▄█▄ ▄▀▄▄  █▄▀▀? █▄ ▄▀▀▀▄█  \n█▀ █▄▀▀▄ ▀▀ ▀▄▀  █ █▄█ █▀▄▄▄█ ▀?▀▀ █▀ ▀▀ ▄▄▄█ ▄█▄\n █ ▄█▀▀ ███ ▀▀▀▀▄▀█▀▀██▀ ▀▀██▀█▄ ▄ ▀ █▄▄ ▀▄▀▄██▀ \n▀▄█▄█▄▀▀▀ ██▀█▀▀█▄▀ █▀▄▀▄▄█ █▀▀██▀▄ █▀█▀ █▄ ▀██ ?\n█▀█▄▄▀▀▄█ ▀?▀▀▄██▀▄▄ ▄ ▄█▀   ▀▄▀██  ▀█▄ █▄▀▀▄▄██ \n █▄▄ ▀▀▀▄▀▀▄▄▀█▀▀▄▀█  █▀  █ ██▀█▄▄▄█▄ ▀▀▄█▄▄ ▄█  \n▀▀▀   ▀ █▀██ ▄█▀  █▀▀▄█▀▀▀█▄  ▄██▀ ▀█▄█ █▀▀▀█  ▀▀\n█▀▀▀▀▀█ █ ▀▀█ ▄▀▀█▀▄▄▄█ ▀ ██▄  █▀ █▄█▀▄▄█ ▀ ?▀▄▀ \n█ ███ █ ▀▀ ▄ ███▄▀██ █▀██▀█  ▄▄ ▀  ?▀██ ▀█▀█▀ ▀▀█\n█ ▀▀▀ █  █ █ ▄▀  ▄ ▀▀▄ ██▄▄▀█ ▀█▄ ▄█▄▀█▄  ▀  ▀▄▄ \n▀▀▀▀▀▀▀  ▀▀▀▀    ▀▀▀    ▀  ▀▀▀  ▀   ▀▀ ▀▀▀  ▀▀▀▀▀"
/*
const qr = `█▀▀▀▀▀█ ▄ ▄   ▄ ▀ █▀ ▄    ██    █▀▄▄ █▄▄█ █▀▀▀▀▀█
█ ███ █   █▀▀▄▀▄▄▄ ▄█▄██▀█▄▀▄  ▀ ▀▄▀▀▄ █▀ █ ███ █
█ ▀▀▀ █ ▄▀▀█▄▄ █ █▀▀▄██▀▀▀█▀▄▄▄ ▀▀▄█▄▄▄   █ ▀▀▀ █
▀▀▀▀▀▀▀ █▄█ █¢▀ █▄▀▄█▄█ ▀ █▄Á █▄█▄▀▄▀ █▄█ ▀▀▀▀▀▀▀
▄ ▄ █▀▀█▄▀ ▀▄█▄█▄▄▄ ▀▄▀█§▀▀▀ █ ▄▀█ ▀ █▄ ▀▄¤▀▄  ▀ 
▀▀▀ ▄ ▀ ▄█▀█ ███▄  ███▄█▀ ███▄▀▄█▄▄ █ ██▄▄▀▀▄▄▄▄▄
█▄▀▄ ▄▀██ █▄▄█ █▀▄▄██▄▀▄█▀▄ ▄ ▀▄▄▀  ▀▄▄ ▀▄▄█▀ ▀▀ 
▀ ██▄▄▀█ ▄▄ ▀▀▄▀ ██ ▄▀▀ ▄█   ▄▀█ ▄▄█▄ ▀█ ▀█▄▄█▄ ▄
█▀▄  ▀▀█ ▄ ▀▄█▄█ █ ▀▀█ █▀▀█ ▀▄▀▄█▀ ▀█▄█▄▄▄  █ █ ▀
█▀ ▀█▄▀▀█▄▀ ▀▀█ ██ ▄█ ▄█▄█▀  █▀█  ██▄▀ ▀ ▀ ▀▄▄▄█▄
  ▀▀▄█▀▀▄█▀▄▀▀  █▀ ▄▄▀▀▀▀█▄█▄█▄ ▄█▀█▀▀▄▄▀ █ █▄¦▄▀
   ▄█▀▀▀█▄▄█  ▀▀ ▀ ▄▄██▀▀▀█ ▀▄█  ▀ ██▀▀▀█▀▀▀███  
 ▄███ ▀ █▀██▀▀  ▄ ▀██▄█ ▀ █▄▀▀█▄ █▀▀▀█▄▄█ ▀ █▄▀▄ 
 ▀▀▀▀█▀█▀█ ▄▄▄▀▄▀ ▄███▀██▀█▄▄▀▀▀█  ¦▄▀▀ ███▀█ █  
 ▄ ▄ ▀▀ ▀█▄▀▄ █▄█▄▄█▄█¦  █▄▀▄▄█▄█▄▀██ █▄ ▄▀██▄█▄▀
██▀ ▄ ▀█ █▀▄▄▀▀ ▀ ▄▄█▄ ▀▀▄█ █▀¡▄ ▀▄▀▀ ▀▀ ▄▄█▄ ▄  
▄▀▄▀█▀▀ ▄ ▀   ▀█▄▀▄█▀▀█▀▀██▀▄█▄▀█▄ ▄██▄▄ ▀▄█▄▀▀▀ 
▀▀▄▀█▄▀¦▀▀ ▀▄▀▀▀▀█▀▄▄ █▄ ▀▀ █  ▄▄▀▄█▄▀▀▀ █▄▄▄█▄ ▄
█▄▀▄ █▀▀█ █▀▄▀██ █▀█▀▄▀▄  ▄  ▀▄▀▀█  ▀█▄ █▄▀▀▄ ▀█ 
 █▄▄ ▀▀██▄▀▀ █   █▄▄▄▀█▀ ▀▄▄███▀█▀ ████▀▄█▄▄ ▀▄  
▀▀▀   ▀ ██▀▀▄▀██¦▀█▄ ▀█▀▀▀█ ¡   █▄█▄▀▀  █▀▀▀█▀▀▀▀
█▀▀▀▀▀█ █▄ ▄ ██▀▀██ ▄▀█ ▀ █▀█▀██ ███▄ ▄▄█ ▀ █▀▄█▄
█ ███ █ ▀▀  ██ ██ ████▀██▀█▄█   ▀▀▀█▀ █▄Ã█¨█▀ ▀ █
█ ▀▀▀ █  █ ▄█▄▀▀▄▄ █▄▄ ██ ▀ █▄▀█▄ ▄█▄▀█▀█ ▀  ▀▄▄ 
▀▀▀▀▀▀▀  ▀▀▀▀    ▀▀▀    ▀  ▀ ▀▀ ▀  Á▀▀      ▀▀▀▀▀`
*/
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
▀▀▀▀▀▀▀   ▀ ▀ ▀▀  ▀▀  ▀▀    ▀ ▀     ▀ ▀▀  ▀▀  ▀▀ ▀ ▀ `
*/
const qr = `█▀▀▀▀▀█ ▀▄█▄▄▀▄▄  █ ▄▀ ▀▀ ▀▀█▀█████ ▄▄▄▄█ █▀▀▀▀▀█
█ ███ █ ▄   ▄▄ ▀▄ ▄  ▀██▀▄▀█ █▀▀▀  ▀   █▀ █ ███ █
█ ▀▀▀ █? ▀▄██▄▀█▄▄ ▀▀ █▀▀▀██▄▀█▀▀██▀▀█▄   █ ▀▀▀ █
▀▀▀▀▀▀▀ ▀▄█ █▄▀ ▀▄▀▄█▄█ ▀ █▄▀▄▀ █▄▀▄▀▄█▄▀ ▀▀▀▀▀▀▀
▄ ? ▀█▀ █▄█ █▄  ▄▀█ ▀▄███▀▀▄ ▀▀ ▄ ▀█▄▄ ▄ ▀   ▀ ▄█
▀ ▀▀  ▀▄██▄▀█▄▀▀  ▀  █▄▄▀▀▀▄ █▀▀▄  ▀▄  ▄ █ ███▀██
▀ ▄ █▀▀▄▀ ▄█▄ █ ▀▄█▄▄▀█ ▀▀ ▄█▄██ ▀ ██▄▀▄   ▄█  █▄
▀▀▄   ▀▀▀ ▄ ▀█ ▄▄█▀▄▀▀██▀ ▀█ ▀ █▀▄  █▄ ▄▄▀▄ ██▀▀█
██ ▄  ▀ ▄█ ▄▀▀▀▀ ?▀▄▄ ▀▄? ▀█▀█  ▄█▀█▀█▀ █ ▄▀▀▄▄▄█
  ▀ ▄ ▀▀▄▀  ▄▄█ ▀ █ ▀▀ ▀█▀▄  ▀▀▀ █▀▄██▀ ▄ ▀███ ▄█
▀▀ ▄▀ ▀ ▀▀█▀▀▀██ ██▄ █  ▀▀▀▄▀█▀  ▄▀▀█▄   ▄▀▀▀ ▄ █
▀▄▄▀█▀▀▀██ ▀▄▄ ▀▄ ▀▀ ▄█▀▀▀█▀▄█▄▄ ▀▄▄▄█ ▄█▀▀▀█▄▀▀▀
▄█ ▄█ ▀ ██▄▀█ ▄▄█▄█▄▀▀█ ▀ ██ ▄▀█▄▀ ██▄  █ ▀ █   ▄
█ ▀ █▀▀▀█?▄██ ███▀ ▀▄█▀▀▀▀▀▀▄▄▄▀▄▀▄▄██ ▀▀████▀▀▄█
▄▀▄▄██▀▀▀ █ ▀█?█▀▀███▀ █  ▀ ▀ ▄██  ▀█▀▀ ▀ █▄▀ ▄▄█
█▄█▀▄▀▀ ▄███ ▀███▄█  ▄▀   ▀ ▄█▄▀▀▄▄?▀▄  ▄██▀█▀ ▀█
█▄█ ▄█▀▄ ▀█  ▀?▀█ ▄▄▀█▀▄ ▀▀█? █ ▀▀▀ ▀▄  ▀█ ▄ █ ▄█
█ ▀█▀█▀▀ █████▀ ▀ ▄▄▄ ▄▀ ▀ ▀▀▀▀ █  ▄██  ▄▄█ █▄ ▀█
▀▄▄█▄ ▀██▀▄▄▄█▀█ ▀▀▀▀▄▀▀▄ █▄▀█  █?▀▄█▄ ▄▄ █  ▄ ▀▄
 █▄▄ ▀▀▀ ▄▄▀▄ ▄▄▄▄ ▄████▄▀▄▀▀▄ ██▀▄▄▄▀▄  ▄█ ▀  ▀▀
▀▀▀   ▀▀█ █▀▄▀▀ ▄▀▄▄▀▄█▀▀▀██▀▀█▀▀ ▄ █ ▄▄█▀▀▀██ ?█
█▀▀▀▀▀█ ▄█▀ ███▀ ▄   ▀█ ▀ █▀ █▄▀▀ ▀▄█▄▀██ ▀ █  ▄▀
█ ███ █ ▀?▀ ▀ ▀ █▄ ▄▀█▀▀▀▀█▀▄█?▀█  ▀█ ▀ ▀████▄ █▀
█ ▀▀▀ █ ▀▄▄█▀    █▀ ██▄▄▄?▄▀ █ ▀█▀ ▄██▄ ▀ ▀▄▀  █▀
▀▀▀▀▀▀▀  ▀ ▀▀▀  ▀▀▀   ▀ ▀  ▀▀  ▀▀ ▀ ▀   ▀  ▀▀▀ ▀▀`

const str_in_ptr = str_in()

let out

for (let i = 0; i < 1; i++) {
	for (let i = 0; i < qr.length; i++) {
		buf.setUint16(str_in_ptr + i * 2, qr[i].charCodeAt(), endian)
	}

	const len_out = process_str_in(qr.length)

	out = str_from_ptr(str_out(), len_out)
}

console.log(Date.now() - start)
console.log(out)

const rng_start = Date.now()

lock_random()

for (let i = 0; i < 250; i++) {
	anticorrupt()
}

console.log(Date.now() - rng_start)
