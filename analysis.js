import fs from "fs";
import path from "path";

export default class Analysis {
	constructor(folder) {
		this.folder = folder;
		this.files = new Map();
		this.includes = new Map();
	}

	load() {
		for (const name of fs.readdirSync(this.folder)) {
			if (/\.(cpp|h|rc)$/i.test(name)) {
				this.files.set(name.toLowerCase(), name);
			}
		}

		for (const name of this.files.values()) {
			this.includes.set(name, this.parse(name));
		}
	}

	parse(name) {
		const fileBytes = fs.readFileSync(path.join(this.folder, name));
		const isUtf16 = fileBytes[0] === 0xff && fileBytes[1] === 0xfe;
		let sourceCode = fileBytes.toString(isUtf16 ? "utf16le" : "latin1");

		sourceCode = sourceCode.replace(/\/\*[\s\S]*?\*\//g, "");
		sourceCode = sourceCode.replace(/\/\/.*$/gm, "");

		const includedNames = [];
		const includedPattern = /^\s*#\s*include\s*[<"]([^>"]+)[>"]/gm;
		let match;
		while ((match = includedPattern.exec(sourceCode)) !== null) {
			includedNames.push(match[1]);
		}
		return includedNames;
	}
}
