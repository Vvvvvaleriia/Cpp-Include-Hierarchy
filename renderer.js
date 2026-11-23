const { ipcRenderer } = require("electron");
const path = require("path");
const Analysis = require("./analysis");
const Viewer = require("./viewer");

const viewer = new Viewer(document.getElementById("scene"));
const status = document.getElementById("status");

ipcRenderer.on("open-project", (event, folder, mainFile) => {
	try {
		const analysis = new Analysis("example");
		analysis.load();

		const rootNames = mainFile
			? [analysis.find(path.basename(mainFile))]
			: analysis.roots();

		viewer.show(analysis.buildGraph(rootNames));
		status.textContent = folder + "- файлів: " + analysis.files.size;
	} catch (error) {
		alert("Помилка:" + error.message);
	}
});
