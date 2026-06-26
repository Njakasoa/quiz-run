// Must run before any PixiJS renderer is created: swaps Pixi's eval-based
// codegen for polyfills so it works under a CSP without 'unsafe-eval'.
import "pixi.js/unsafe-eval";
import "./style.css";
import { Game } from "./game.ts";

new Game().start();
