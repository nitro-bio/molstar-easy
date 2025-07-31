/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import alias from "@rollup/plugin-alias";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
    react(),
    tailwindcss(),
    alias({
      entries: [
        {
          find: "@utils",
          replacement: path.resolve(__dirname, "./src/utils"),
        },
      ],
    }),
  ],
  build: {
    sourcemap: "inline",
    minify: false,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "Molstar Ui",
      formats: ["es", "umd"],
      fileName: (format) => `molstar-easy.${format}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom", "styled-components", /^molstar/],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "styled-components": "styled",
          molstar: "molstar",
          "molstar/lib/mol-model/structure": "molstar.molModel.structure",
          "molstar/lib/mol-theme/color/entity-id":
            "molstar.molTheme.color.entityId",
          "molstar/lib/mol-util/color": "molstar.molUtil.color",
          "molstar/lib/mol-util/legend": "molstar.molUtil.legend",
          "molstar/lib/mol-util/param-definition":
            "molstar.molUtil.paramDefinition",
          "molstar/build/viewer/molstar.css": "molstar.viewer.css",
          "molstar/lib/mol-plugin-state/helpers/structure-overpaint":
            "molstar.molPluginState.helpers.structureOverpaint",
          "molstar/lib/mol-plugin-state/transforms/data":
            "molstar.molPluginState.transforms.data",
          "molstar/lib/mol-plugin-state/transforms/model":
            "molstar.molPluginState.transforms.model",
          "molstar/lib/mol-plugin-state/transforms/representation":
            "molstar.molPluginState.transforms.representation",
          "molstar/lib/mol-plugin/context": "molstar.molPlugin.context",
          "molstar/lib/mol-plugin/spec": "molstar.molPlugin.spec",
          "molstar/lib/mol-script/language/builder":
            "molstar.molScript.language.builder",
          "molstar/lib/mol-script/script": "molstar.molScript.script",
        },
        interop: "compat",
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./setupTests.ts"],
    env: {
      mode: "test",
      baseUrl: "http://localhost:6006",
    },
  },
});
