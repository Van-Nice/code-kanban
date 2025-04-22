# Testing Guide for Code Kanban Extension

This guide provides instructions on how to run and debug tests for the Code Kanban extension.

## Overview

Tests for this extension use a webpack-based build system, which ensures consistent module resolution between the main extension and the tests.

## Test Structure

- `src/test/index.ts` - Main entry point for bundling tests
- `src/test/*.test.ts` - Individual test files
- `webpack.test.config.js` - Webpack configuration for tests

## Running Tests

- `npm run compile-tests` - Compile tests with webpack
- `npm test` - Run tests with the VS Code test runner

## Path Aliases

The tests use path aliases to ensure consistent module resolution:

- `@src/*` - Maps to `src/*`
- `@shared/*` - Maps to `src/shared/*`
- `@handlers/*` - Maps to `src/handlers/*`
- `@models/*` - Maps to `src/models/*`
- `@utils/*` - Maps to `src/utils/*`

## Tips for Writing Tests

1. Use the path aliases instead of relative imports
2. Clear any existing storage before tests with `await boardStorage.clear()`
3. For command tests, register mock commands in the test setup
4. When testing storage operations, use isolated IDs to avoid conflicts

## Mock Objects

- `MockWebview` - A mock implementation of VS Code webview
- `TestLogger` - A logger implementation for tests
