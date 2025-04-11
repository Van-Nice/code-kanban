//@ts-check

"use strict";

const path = require("path");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const glob = require("glob");

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

// Find all test files
const testEntryFiles = glob.sync("./src/test/**/*.test.ts");

// Create an entry object from the test files
const testEntries = {
  "test-bundle": "./src/test/index.ts", // Main test entry point (will create later)
};

/** @type WebpackConfig */
const testConfig = {
  target: "node",
  mode: "none",

  entry: testEntries,
  output: {
    path: path.resolve(__dirname, "dist/test"),
    filename: "[name].js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },
  externals: {
    vscode: "commonjs vscode",
    mocha: "commonjs mocha",
  },
  resolve: {
    extensions: [".ts", ".js"],
    mainFields: ["module", "main"],
    // Add alias to make module resolution more consistent
    alias: {
      "@src": path.resolve(__dirname, "src/"),
      "@shared": path.resolve(__dirname, "src/shared/"),
      "@handlers": path.resolve(__dirname, "src/handlers/"),
      "@models": path.resolve(__dirname, "src/models/"),
      "@utils": path.resolve(__dirname, "src/utils/"),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: "tsconfig.json", // Use the main tsconfig
            transpileOnly: true,
          },
        },
      },
    ],
  },
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: process.env.ANALYZE ? "server" : "disabled",
      generateStatsFile: true,
      statsFilename: path.join(
        __dirname,
        "dist/test",
        "test-bundle-stats.json"
      ),
    }),
  ],
  devtool: "source-map",
  infrastructureLogging: {
    level: "log",
  },
  optimization: {
    minimize: false,
  },
};

module.exports = [testConfig];
