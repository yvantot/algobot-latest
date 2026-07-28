import { mount } from "svelte";
import "./index.css";
import { game } from "./game/game.js";
import App from "./App.svelte";

game();
const app = mount(App, {
  target: document.getElementById("app"),
});

export default app;
