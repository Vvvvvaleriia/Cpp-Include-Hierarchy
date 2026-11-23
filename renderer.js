const Analysis = require("./analysis");
const Viewer = require("./viewer");

const viewer = new Viewer(document.getElementById("scene"));
const analysis = new Analysis("example");
analysis.load();
viewer.show(analysis.buildGraph());
