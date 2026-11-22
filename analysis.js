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

	find(includedName) {
		const fileName = includedName.split(/[\\/]/).pop();

		return this.files.get(fileName.toLowerCase());
	}

	roots() {
		const includedFiles = new Set();
		for (const includeList of this.includes.values()) {
			for (const includeName of includeList) {
				const fileName = this.find(includeName);
				if (fileName) includedFiles.add(fileName);
			}
		}

		const allFiles = [...this.files.values()];
		const rootFiles = allFiles.filter((f) => !includedFiles.has(f));
		return rootFiles.length > 0 ? rootFiles : allFiles;
	}

	buildTree(fileName, pathSoFar = []) {
		const node = {
			name: fileName,
			external: false,
			cycle: false,
			children: [],
		};

		if (pathSoFar.includes(fileName)) {
			node.cycle = true;
			return node;
		}

		const pathForChildren = [...pathSoFar, fileName];

		for (const includeName of this.includes.get(fileName)) {
			const projectFile = this.find(includeName);

			if (projectFile) {
				node.children.push(
					this.buildTree(projectFile, pathForChildren),
				);
			} else {
				node.children.push({
					name: includeName,
					external: true,
					cycle: false,
					children: [],
				});
			}
		}

		return node;
	}
}
