import fs from "fs";

export default class Analysis {
	constructor(folder) {
		this.folder = folder;
		this.files = new Map();
	}

	load() {
		for (const name of fs.readdirSync(this.folder)) {
			if (/\.(cpp|h|rc)$/i.test(name)) {
				this.files.set(name.toLowerCase(), name);
			}
		}
	}
}
