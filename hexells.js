const CA = require("./ca.js");
const dat = require("dat.gui");
const twgl = require("twgl.js");

/**
 * Used to customize the behavior and appearance of Hexells.
 * @typedef {Object} HexellsOptions
 * @property {Number} brushRadius
 * @property {Number} stepPerFrame
 * @property {Number} timePerModel
 * @property {Boolean} responsive
 * @property {String} powerPreference - "high-performance", "low-power", or "default"
 */

/**
 * Used to cancel the Hexells animation loop when desired.
 */
let hexellsAnimation;

class Hexells {
	/**
	 * Creates a Hexells instance.
	 * @param {HTMLCanvasElement} canvas
	 * @param {HexellsOptions} options
	 */
	constructor(canvas, options = {}) {
		this.canvas = canvas;
		this.options = options;
		this.gl = canvas.getContext("webgl", {
			alpha: false,
			desynchronized: true,
			powerPreference: options.powerPreference ?? "default"
		});

		if (!this.gl) {
			if (window && !Boolean(window.WebGLRenderingContext)) {
				throw new Error("WebGL is not supported by your browser.");
			} else {
				throw new Error("There was an error initializing WebGL. Does your canvas already have a context?");
			}
		}

		this.brushRadius = options.brushRadius ?? 16;
		this.stepPerFrame = options.stepPerFrame ?? 1;
		this.timePerModel = options.timePerModel ?? 20 * 1000;
		this.responsive = options.responsive ?? false;

		let gui;
		if (this.responsive) {
			gui = this.gui = new dat.GUI();
			gui.hide();
			gui.add(this, "brushRadius", 1, 40);
			gui.add(this, "stepPerFrame", 0, 6, 1);
		} else {
			gui = this.gui = null;
		}

		const models = require("./models.json");
		this.ca = new CA(this.gl, models, [160, 160], gui, () =>
			this.setup(models)
		);
	}

	setup(models) {
		this.canvas.classList.add("hexells");
		this.shuffledModelIds = models.model_names
			.map((_, i) => [Math.random(), i])
			.sort()
			.map((p) => p[1]);
		this.curModelIndex = this.shuffledModelIds[0];
		this.modelId = this.shuffledModelIds[this.curModelIndex];
		this.ca.paint(0, 0, -1, this.modelId);

		this.guesture = null;

		if (this.responsive) {
			const mouseEvent = (f) => (e) => {
				e.preventDefault();
				f([e.offsetX, e.offsetY], e);
			};

			const touchEvent = (f) => (e) => {
				e.preventDefault();
				const rect = canvas.getBoundingClientRect();
				for (const t of e.touches) {
					const xy = [t.clientX - rect.left, t.clientY - rect.top];
					f(xy, e);
				}
			}

			canvas.addEventListener("mousedown", mouseEvent((xy, e) => {
				if (e.buttons == 1) {
					this.startGestue(xy);
					this.touch(xy);
				}
			}));
			canvas.addEventListener("mousemove", mouseEvent((xy, e) => {
				if (e.buttons == 1) {
					this.touch(xy);
				}
			}));
			canvas.addEventListener("mouseup", mouseEvent(
				(xy) => this.endGestue(xy))
			);
			canvas.addEventListener("touchstart", touchEvent((xy, e) => {
				if (e.touches.length == 1) {
					this.startGestue(xy);
				} else {
					// cancel guesture
					this.gesture = null;
				}
				this.touch(xy);
			}));
			canvas.addEventListener("touchmove", touchEvent(
				(xy) => this.touch(xy))
			);
			canvas.addEventListener("touchend", (xy) => this.endGestue(xy));
			document.addEventListener("keypress", (e) => {
				if (e.key == "a") this.switchModel(1);
				if (e.key == "z") this.switchModel(-1);
			});
		} else {
			setInterval(() => this.switchModel(1), this.timePerModel);
		}

		hexellsAnimation = requestAnimationFrame(() => this.render());
	}

	startGestue(pos) {
		this.gesture = {
			d: 0,
			l: 0,
			prevPos: pos,
			r: 0,
			time: Date.now(),
			u: 0,
		};
	}

	touch(xy) {
		const [x, y] = xy;
		const g = this.gesture;
		if (g) {
			const [x0, y0] = g.prevPos;
			g.l += Math.max(x0 - x, 0);
			g.r += Math.max(x - x0, 0);
			g.u += Math.max(y0 - y, 0);
			g.d += Math.max(y - y0, 0);
			g.prevPos = xy;
		}

		const viewSize = this.getViewSize();
		this.ca.clearCircle(x, y, this.brushRadius, viewSize);
	}

	endGestue() {
		if (!this.gesture) return;

		if (Date.now() - this.gesture.time < 1000) {
			const { l, r, u, d } = this.gesture;
			if (l > 200 && Math.max(r, u, d) < l * 0.25) {
				this.switchModel(-1);
			} else if (r > 200 && Math.max(l, u, d) < r * 0.25) {
				this.switchModel(1);
			}
		}

		this.gesture = null;
	}

	switchModel(swipe) {
		const n = this.shuffledModelIds.length;
		this.curModelIndex = (this.curModelIndex + n + swipe) % n;
		const id = this.shuffledModelIds[this.curModelIndex];
		this.setModel(id);
	}

	setModel(id) {
		this.modelId = id;
		this.ca.paint(0, 0, -1, id);
		this.ca.disturb();
	}

	getViewSize() {
		return [
			this.canvas.clientWidth || this.canvas.width,
			this.canvas.clientHeight || this.canvas.height
		];
	}

	render() {
		for (let i = 0; i < this.stepPerFrame; ++i) {
			this.ca.step();
		}

		const { canvas } = this;
		const dpr = window.devicePixelRatio || 1;
		const [w, h] = this.getViewSize();
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);

		twgl.bindFramebufferInfo(this.gl);
		this.ca.draw(this.getViewSize(), "color");
		hexellsAnimation = requestAnimationFrame(() => this.render());
	}

	destroy() {
		cancelAnimationFrame(hexellsAnimation);
	}
}

// For use in npm and the browser
module.exports = Hexells;
window.Hexells = Hexells;
