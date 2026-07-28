import { mount } from "svelte";
import "./index.css";
// JS-Interpreter is a legacy global script. Import it through Vite so it is
// bundled for production instead of being requested from the source directory.
import "./lib/js-interpreter.js";
import App from "./App.svelte";

const app = mount(App, {
  target: document.getElementById("app"),
});

export default app;
