import { spawn } from "child_process";
import svelte from "rollup-plugin-svelte";
import terser from "@rollup/plugin-terser";
import resolve from "@rollup/plugin-node-resolve";
import livereload from "rollup-plugin-livereload";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import postcss from "rollup-plugin-postcss";
import typescript from "@rollup/plugin-typescript";
import tailwindcssPostcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";

const production = !process.env.ROLLUP_WATCH;

function serve() {
  let server;

  function toExit() {
    if (server) server.kill(0);
  }

  return {
    writeBundle() {
      if (server) return;
      server = spawn("npm", ["run", "start", "--", "--dev"], {
        stdio: ["ignore", "inherit", "inherit"],
        shell: true,
      });

      process.on("SIGTERM", toExit);
      process.on("exit", toExit);
    },
  };
}

// Custom logging plugin
const logPlugin = {
  name: "log-plugin",
  generateBundle(options, bundle) {
    console.log("Generated bundle files:");
    for (const [fileName, asset] of Object.entries(bundle)) {
      console.log(`- ${fileName}: ${asset.type === "chunk" ? "JS" : "Asset"}`);
      if (fileName === "app.css" && asset.source) {
        console.log(
          "app.css content preview:",
          asset.source.slice(0, 100) + "..."
        );
      }
    }
  },
};

export default {
  input: "src/main.ts",
  output: {
    sourcemap: true,
    format: "iife",
    name: "app",
    entryFileNames: "webview.js",
    dir: "../dist",
  },
  plugins: [
    typescript({
      sourceMap: true,
      noEmitOnError: true,
    }),
    svelte({
      compilerOptions: {
        dev: !production,
      },
      preprocess: vitePreprocess({
        postcss: true,
      }),
      emitCss: true,
    }),
    postcss({
      extract: true,
      minimize: production,
      config: false, // Don't use external config
      extensions: [".css"],
      plugins: [
        tailwindcssPostcss(),
        autoprefixer(),
        {
          // Custom PostCSS plugin for logging
          postcssPlugin: "logger",
          Once(root) {
            console.log("PostCSS processing started...");
            console.log("CSS root contains", root.nodes.length, "nodes");
          },
          Declaration(decl) {
            console.log(`Processing declaration: ${decl.prop}: ${decl.value}`);
          },
        },
      ],
    }),
    resolve({
      browser: true,
      dedupe: ["svelte"],
      exportConditions: ["svelte"],
    }),
    !production && serve(),
    !production && livereload("public"),
    production && terser(),
    logPlugin, // Add the custom logging plugin
  ],
  watch: {
    clearScreen: false,
  },
};
