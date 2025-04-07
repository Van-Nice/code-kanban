import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess({
    typescript: {
      compilerOptions: {
        types: ["svelte"],
        runes: true
      },
    },
  }),
};
