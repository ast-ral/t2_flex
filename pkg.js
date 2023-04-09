const {
	readFileSync: read_file_sync,
	writeFileSync: write_file_sync,
	copyFileSync: copy_file_sync,
} = require("fs")

const {
	execSync: exec_sync,
} = require("child_process")

copy_file_sync("./target/wasm32-unknown-unknown/release/t2_flex.wasm", "./t2_flex.wasm")

exec_sync("wasm_tools\\wasm-strip t2_flex.wasm")

const file = read_file_sync("./t2_flex.wasm")
const data = [...file]
const hex = data.map(i => i.toString(16).padStart(2, "0"))

const FILE_SIZE = 50000
const HEX_SIZE = FILE_SIZE / 2

for (let i = 0; i * HEX_SIZE < hex.length; i++) {
	write_file_sync(`./data_${i}.txt`, hex.slice(HEX_SIZE * i, HEX_SIZE * (i + 1)).join(""))
}
