# Hexells

## Introduction

**Hexells** is a Self-Organising System of cells, that was trained to build textures using neighbour communication only. This work exposes the relation between the life of an individual cell, and the cell collective as a whole. The original library belongs to Alexander Mordvintsev, and you can see the demonstration of his implementation [here](https://znah.net/hexells/).

The "cell" system is based on [Neural Cellular Automata](https://distill.pub/selforg/2021/textures/).

## Usage

Hexells was designed with widespread usage possibilities in mind. The software can be imported directly via `npm`, or can be used as a library by generating a single-file bundle with `browserify` via `npm run build`.

```js
const canvas = document.createElement("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// `Hexells` is in the window scope
new Hexells(canvas);
document.body.appendChild(canvas);
```

<!-- TODO: Example for `npm` as well -->
