import App from "./App.svelte";
import { mount } from "svelte";
import "./app.css";

const app = mount(App, {
  target: document.body,
  props: {},
});

export default app;
