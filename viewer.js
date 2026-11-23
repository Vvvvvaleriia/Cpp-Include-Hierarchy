class Viewer {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.graph = null;

		this.font = "14px Segoe UI, Arial, sans-serif";
		this.titleFont = "bold 14px Segoe UI, Arial, sans-serif";

		this.lineH = 18;
		this.padding = 8;
		this.gapX = 40;
		this.gapY = 70;
		this.margin = 20;
		this.sideSpace = 80;
		this.nodeByKey = new Map();
	}

	show(graph) {
		this.graph = graph;

		const size = this.layout(graph);

		this.canvas.width = size.width;
		this.canvas.height = size.height;

		const ctx = this.ctx;
		ctx.textBaseline = "middle";
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		for (const edge of graph.edges) this.drawArrow(edge);
		for (const node of graph.nodes) this.drawNode(node);
	}

	label(node) {
		return node.external ? "<" + node.name + ">" : node.name;
	}

	measure(node) {
		const ctx = this.ctx;

		ctx.font = this.titleFont;
		let textWidth = ctx.measureText(this.label(node)).width;

		ctx.font = this.font;
		for (const directive of node.directives) {
			textWidth = Math.max(textWidth, ctx.measureText(directive).width);
		}

		node.w = textWidth + this.padding * 2;
		node.h = (node.directives.length + 1) * this.lineH + this.padding * 2;
	}

	layout(graph) {
		for (const node of graph.nodes) this.measure(node);

		const levels = [];
		for (const node of graph.nodes) {
			if (!levels[node.level]) {
				levels[node.level] = [];
			}
			levels[node.level].push(node);
		}
		levels.reverse();

		const cycleKeys = new Set();
		for (const edge of graph.edges) {
			if (edge.cycle) {
				cycleKeys.add(edge.from);
				cycleKeys.add(edge.to);
			}
		}
		for (const row of levels) {
			row.sort((a, b) => cycleKeys.has(a.key) - cycleKeys.has(b.key));
		}

		const rowWidths = levels.map(
			(row) =>
				row.reduce((sum, node) => sum + node.w, 0) +
				(row.length - 1) * this.gapX,
		);
		const maxRowWidth = Math.max(...rowWidths);

		let y = this.margin;
		levels.forEach((row, i) => {
			let x = this.margin + (maxRowWidth - rowWidths[i]) / 2;
			const rowHeight = Math.max(...row.map((node) => node.h));

			for (const node of row) {
				node.x = x;
				node.y = y;
				node.rowBottom = y + rowHeight;
				x += node.w + this.gapX;
			}

			y += rowHeight + this.gapY;
		});

		this.nodeByKey = new Map(graph.nodes.map((node) => [node.key, node]));
		this.assignPorts(graph);

		return {
			width: maxRowWidth + this.margin * 2,
			height: y - this.gapY + this.margin,
		};
	}

	drawArrow(edge) {
		const ctx = this.ctx;
		const includer = this.nodeByKey.get(edge.from);
		const included = this.nodeByKey.get(edge.to);
		if (includer === included) return;

		const route = edge.sideRoute
			? this.sideRoute(includer, included)
			: this.routeUp(edge, includer, included);
		const points = route.points;

		const color = edge.cycle ? "#d33" : "#888";
		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.setLineDash(edge.cycle ? [6, 4] : []);

		ctx.beginPath();
		points.forEach(([x, y], i) => {
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		});
		ctx.stroke();
		ctx.setLineDash([]);

		this.drawArrowHead(
			points[points.length - 2],
			points[points.length - 1],
		);
		this.drawLabel("#include", route.label.x, route.label.y);
	}

	drawArrowHead(from, to) {
		const ctx = this.ctx;
		const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
		const headSize = 9;
		const spread = Math.PI / 6;

		ctx.beginPath();
		ctx.moveTo(to[0], to[1]);
		ctx.lineTo(
			to[0] - headSize * Math.cos(angle - spread),
			to[1] - headSize * Math.sin(angle - spread),
		);
		ctx.lineTo(
			to[0] - headSize * Math.cos(angle + spread),
			to[1] - headSize * Math.sin(angle + spread),
		);
		ctx.closePath();
		ctx.fill();
	}

	drawLabel(text, x, y) {
		const ctx = this.ctx;
		ctx.font = "12px Segoe UI, Arial, sans-serif";
		const width = ctx.measureText(text).width;

		ctx.fillStyle = "#fff";
		ctx.fillRect(x - 2, y - 8, width + 4, 16);
		ctx.fillStyle = "#2a5bd7";
		ctx.fillText(text, x, y);
	}

	routeUp(edge, includer, included) {
		const startX = edge.startX;
		const endX = edge.endX;
		const startY = included.y;
		const endY = includer.y + includer.h;
		const lowY = included.y - this.gapY * 0.3;
		const highY = includer.rowBottom + this.gapY * 0.3;
		const channelX = this.findChannel(startX, endX, includer, included);
		const labelStep = 16;

		return {
			points: [
				[startX, startY],
				[startX, lowY],
				[channelX, lowY],
				[channelX, highY],
				[endX, highY],
				[endX, endY],
			],
			label: {
				x: startX + 4,
				y: (startY + lowY) / 2 - (edge.labelIndex ?? 0) * labelStep,
			},
		};
	}

	findChannel(startX, endX, includer, included) {
		const blockers = this.graph.nodes.filter(
			(n) =>
				n !== includer &&
				n !== included &&
				n.y > includer.y &&
				n.y < included.y,
		);
		const isFree = (x) =>
			blockers.every((n) => x < n.x - 6 || x > n.x + n.w + 6);

		if (isFree(startX)) return startX;

		const candidates = [endX];
		for (const n of blockers) {
			candidates.push(n.x - this.gapX / 2, n.x + n.w + this.gapX / 2);
		}
		const free = candidates.filter(isFree);
		if (free.length === 0) return startX;

		return free.reduce((best, x) =>
			Math.abs(x - startX) + Math.abs(x - endX) <
			Math.abs(best - startX) + Math.abs(best - endX)
				? x
				: best,
		);
	}

	sideRoute(includer, included) {
		const top = Math.min(includer.y, included.y);
		const bottom = Math.max(
			includer.y + includer.h,
			included.y + included.h,
		);

		let outX = 0;
		for (const n of this.graph.nodes) {
			if (n.y < bottom && n.y + n.h > top)
				outX = Math.max(outX, n.x + n.w);
		}
		outX += 14;

		const startX = included.x + included.w;
		const startY = included.y + included.h / 2;
		const endX = includer.x + includer.w;
		const endY = includer.y + includer.h / 2;

		return {
			points: [
				[startX, startY],
				[outX, startY],
				[outX, endY],
				[endX, endY],
			],
			label: { x: outX + 4, y: (startY + endY) / 2 },
		};
	}

	color(node) {
		if (node.external) return "#e0e0e0";
		if (/\.cpp$/i.test(node.name)) return "#c9e4ff";
		if (/\.rc$/i.test(node.name)) return "#fff0b3";
		return "#d3f5d3";
	}

	drawNode(node) {
		const ctx = this.ctx;

		ctx.fillStyle = this.color(node);
		ctx.fillRect(node.x, node.y, node.w, node.h);
		ctx.strokeStyle = "#555";
		ctx.strokeRect(node.x, node.y, node.w, node.h);

		ctx.fillStyle = "#000";
		ctx.font = this.titleFont;
		const textX = node.x + this.padding;
		ctx.fillText(
			this.label(node),
			textX,
			node.y + this.padding + this.lineH / 2,
		);

		ctx.font = this.font;
		node.directives.forEach((directive, i) => {
			const lineY =
				node.y + this.padding + this.lineH * (i + 1) + this.lineH / 2;
			ctx.fillText(directive, textX, lineY);
		});
	}

	assignPorts(graph) {
		const topPorts = new Map();
		const bottomPorts = new Map();

		const add = (map, key, edge) => {
			if (!map.has(key)) map.set(key, []);
			map.get(key).push(edge);
		};

		for (const edge of graph.edges) {
			const includer = this.nodeByKey.get(edge.from);
			const included = this.nodeByKey.get(edge.to);

			edge.sideRoute =
				includer === included || includer.y + includer.h >= included.y;
			if (edge.sideRoute) continue;

			add(topPorts, edge.to, edge);
			add(bottomPorts, edge.from, edge);
		}

		const spread = (ports, otherKeyOf, field) => {
			const centerX = (edge) => {
				const other = this.nodeByKey.get(otherKeyOf(edge));
				return other.x + other.w / 2;
			};
			for (const [key, edges] of ports) {
				const node = this.nodeByKey.get(key);
				edges.sort((a, b) => centerX(a) - centerX(b));
				edges.forEach((edge, i) => {
					edge[field] =
						node.x + (node.w * (i + 1)) / (edges.length + 1);
					if (field === "startX") edge.labelIndex = i;
				});
			}
		};

		spread(topPorts, (edge) => edge.from, "startX");
		spread(bottomPorts, (edge) => edge.to, "endX");
	}
}

module.exports = Viewer;
