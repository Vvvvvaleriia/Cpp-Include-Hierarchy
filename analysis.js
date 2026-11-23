const fs = require("fs");
const path = require("path");

class Analysis {
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
			includedNames.push({
				name: match[1],
				directive: match[0].trim(),
			});
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
			for (const include of includeList) {
				const fileName = this.find(include.name);
				if (fileName) includedFiles.add(fileName);
			}
		}

		const allFiles = [...this.files.values()];
		const rootFiles = allFiles.filter((f) => !includedFiles.has(f));
		return rootFiles.length > 0 ? rootFiles : allFiles;
	}

	buildGraph(rootNames = this.roots()) {
		const nodes = new Map();
		const edges = [];
		const edgeKeys = new Set();

		const addNode = (key, name, external) => {
			if (!nodes.has(key)) {
				nodes.set(key, {
					key,
					name,
					external,
					level: -1,
					directives: [],
				});
			}
			return nodes.get(key);
		};

		const collect = (fileName) => {
			if (nodes.has(fileName)) return;
			const node = addNode(fileName, fileName, false);

			for (const include of this.includes.get(fileName)) {
				node.directives.push(include.directive);

				const projectFile = this.find(include.name);
				let targetKey;
				if (projectFile) {
					targetKey = projectFile;
					collect(projectFile);
				} else {
					targetKey = "external:" + include.name.toLowerCase();
					addNode(targetKey, include.name, true);
				}

				const edgeKey = fileName + "->" + targetKey;
				if (!edgeKeys.has(edgeKey)) {
					edgeKeys.add(edgeKey);
					edges.push({ from: fileName, to: targetKey, cycle: false });
				}
			}
		};

		for (const rootName of rootNames) collect(rootName);
		this.assignLevels(nodes, edges);

		return { nodes: [...nodes.values()], edges };
	}

	assignLevels(nodes, edges) {
		const outgoing = new Map();
		for (const edge of edges) {
			if (!outgoing.has(edge.from)) {
				outgoing.set(edge.from, []);
			}
			outgoing.get(edge.from).push(edge);
		}

		const state = new Map();

		const visit = (key) => {
			const node = nodes.get(key);
			if (state.get(key) === "done") return node.level;
			state.set(key, "visiting");

			let level = 0;
			for (const edge of outgoing.get(key) ?? []) {
				if (state.get(edge.to) === "visiting") {
					edge.cycle = true;
					continue;
				}
				level = Math.max(level, visit(edge.to) + 1);
			}

			node.level = level;
			state.set(key, "done");
			return level;
		};

		for (const key of nodes.keys()) visit(key);
	}
}

module.exports = Analysis;
