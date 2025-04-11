import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "dist/test/test-bundle.js",
  mocha: {
    ui: "tdd",
    timeout: 20000,
  },
});
