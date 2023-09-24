const CellularAutomata = require("./ca.js");
const dat = require("dat.gui");
const twgl = require("twgl.js");

/**
 * Ensures that only valid `powerPreference` options are
 * passed to the constructor.
 */
const powerOptions = [
	"high-performance",
	"low-power",
	"default",
];

/**
 * Used to customize the behavior and appearance of Hexells.
 * @typedef {Object} HexellsOptions
 * @property {String} powerPreference
 * @property {Number} brushRadius
 * @property {Number} stepPerFrame
 * @property {Number} timePerModel
 * @property {Boolean} responsive
 * @property {Number} fps
 */

/**
 * Used to cancel the Hexells animation loop when desired.
 */
let hexellsAnimation;

class Hexells {
	/**
	 * Creates a Hexells instance.
	 * @param {HTMLCanvasElement} canvas
	 * @param {HexellsOptions} [options={}]
	 */
	constructor(canvas, options = {}) {
		const powerPreference = options.powerPreference || "default";
		if (!powerOptions.includes(powerPreference)) {
			throw new Error(`Invalid powerPreference: ${powerPreference}`);
		}

		this.canvas = canvas;
		this.options = options;
		this.gl = canvas.getContext("webgl", {
			alpha: false,
			desynchronized: true,
			powerPreference
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
		this.fps = 1000 / (options.fps ?? 25);

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
		this.ca = new CellularAutomata(this.gl, models, [160, 160], gui, () =>
			this.setup(models)
		);
	}

	/**
	 * Sets up the Hexells instance.
	 * @param {Object} models
	 */
	setup(models) {
		const { canvas } = this;
		canvas.classList.add("hexells");

		this.shuffledModelIds = models.model_names
			.map((_, i) => [Math.random(), i])
			.sort()
			.map((p) => p[1]);
		this.curModelIndex = this.shuffledModelIds[0];
		this.modelId = this.shuffledModelIds[this.curModelIndex];
		this.ca.paint(0, 0, -1, this.modelId);
		this.guesture = null;

		if (this.responsive) {
			const mouseEvent = (cb) => (event) => {
				event.preventDefault();
				cb([event.offsetX, event.offsetY], event);
			};

			const touchEvent = (cb) => (event) => {
				event.preventDefault();
				const rect = canvas.getBoundingClientRect();
				for (const touch of event.touches) {
					const pos = [touch.clientX - rect.left, touch.clientY - rect.top];
					cb(pos, event);
				}
			}

			canvas.addEventListener("mousedown", mouseEvent((pos, e) => {
				if (e.buttons == 1) {
					this.startGestue(pos);
					this.touch(pos);
				}
			}));
			canvas.addEventListener("mousemove", mouseEvent((pos, e) => {
				if (e.buttons == 1) {
					this.touch(pos);
				}
			}));
			canvas.addEventListener("mouseup", mouseEvent(
				(pos) => this.endGestue(pos))
			);
			canvas.addEventListener("touchstart", touchEvent((pos, e) => {
				if (e.touches.length == 1) {
					this.startGestue(pos);
				} else {
					// Cancel guesture
					this.gesture = null;
				}

				this.touch(pos);
			}), { passive: false });
			canvas.addEventListener("touchmove", touchEvent(
				(pos) => this.touch(pos))
			);
			canvas.addEventListener("touchend", (pos) => this.endGestue(pos));
			document.addEventListener("keypress", (e) => {
				if (e.key == "a") this.switchModel(1);
				if (e.key == "z") this.switchModel(-1);
			});
		} else {
			setInterval(() => this.switchModel(1), this.timePerModel);
		}

		hexellsAnimation = requestAnimationFrame(() => this.render());
	}

	/**
	 * Starts a new guesture.
	 * @param {Number[]} pos The position of the touch event
	 */
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

	/**
	 * Handles a touch event and clears a circle of cells.
	 * @param {Number[]} pos The position of the touch
	 */
	touch(pos) {
		const [x, y] = pos;
		const g = this.gesture;
		if (g) {
			const [x0, y0] = g.prevPos;
			g.l += Math.max(x0 - x, 0);
			g.r += Math.max(x - x0, 0);
			g.u += Math.max(y0 - y, 0);
			g.d += Math.max(y - y0, 0);
			g.prevPos = pos;
		}

		const viewSize = this.getViewSize();
		this.ca.clearCircle(x, y, this.brushRadius, viewSize);
	}

	/**
	 * Ends the current guesture.
	 */
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

	/**
	 * Switches to the next model.
	 * @param {Number} swipe
	 */
	switchModel(swipe) {
		const numModels = this.shuffledModelIds.length;
		this.curModelIndex = (this.curModelIndex + numModels + swipe) % numModels;
		const id = this.shuffledModelIds[this.curModelIndex];
		this.setModel(id);
	}

	/**
	 * Sets the current model.
	 * @param {Number} id
	 */
	setModel(id) {
		this.modelId = id;
		this.ca.paint(0, 0, -1, id);
		this.ca.disturb();
	}

	/**
	 * Gets the size of the canvas.
	 * @returns {Number[]} The size of the canvas in pixels
	 */
	getViewSize() {
		return [
			this.canvas.clientWidth || this.canvas.width,
			this.canvas.clientHeight || this.canvas.height
		];
	}

	/**
	 * Renders the current state of the cellular automaton.
	 */
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

		setTimeout(() => {
			hexellsAnimation = requestAnimationFrame(() => this.render());
		}, this.fps);
	}

	/**
	 * Destroys the cellular automaton, freeing up memory.
	 */
	destroy() {
		cancelAnimationFrame(hexellsAnimation);
		hexellsAnimation = null;

		let { ca, canvas } = this;
		ca.destroy();
		ca = null;
		if (canvas) {
			canvas.parentElement.removeChild(canvas);
			canvas = null;
		}
	}
}

// For use in npm and the browser
module.exports = Hexells;
window.Hexells = Hexells;
