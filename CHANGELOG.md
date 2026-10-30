# Changelog

Selected changes grouped by theme from `git log`, through commit `3611bec`. Commit references identify the source history; these groups are not new release versions. Historical hosted/prototype work is recorded separately from the local kit.

## Local generator

- Added the initial script structure and input validation (`a2f3601`), npm-driven app creation and dependency installation (`12d1f49`), and installation retries (`f3f6533`).
- Added environment files, utility functions, provider and UI components (`6ef64b3`), and dynamic template substitution (`ebae725`).
- Added progress indicators (`fbe6845`), error handling and cleanup (`353e752`), command-line options and template selection (`d56efd3`), and self-tests (`81a7151`).
- Fixed Clerk imports when authentication is skipped (`92d1b15`), TypeScript casting in configuration detection (`7f2374e`), and the status banner when both integrations are skipped (`0b96085`).
- Adjusted full-app scaffolding for builds before Convex code generation or Clerk key setup, including `setup:convex` and missing-key route behavior (`ed40373`).
- Changed connectivity checks to use the configured npm registry over HTTPS rather than depend on ping (`26f7559`, `caf1693`); accepted any HTTP response status as registry reachability (`cfce159`).
- Added registry-input validation and credential masking (`5583acc`), npm fallback for raw at-sign passwords (`8c980fa`), and self-test child/temp-directory cleanup on termination (`0c4bc08`, `0685e5e`).

## Local stdio MCP server

- Added the MCP server implementation and documentation (`0f9eb42`).
- Upgraded the MCP SDK and ESLint configuration (`868d370`), and documented Claude Desktop, Codex, and Cursor client configuration (`b25cb19`).
- Replaced shell interpolation of tool arguments (`ea6007e`).
- Added stdio protocol tests (`acd83f9`), child-script shutdown handling (`2fbdd9a`), and guards against spawning after shutdown with process-group cleanup on SIGHUP (`c8bd6f5`).
- Added shutdown and timeout regression coverage (`1171e4c`, `9915c1c`, `4967fc7`).

## Repository tooling and documentation

- Added development infrastructure and security improvements (`00a6e60`), then fixed ESLint compatibility and lockfile synchronization (`64e144e`, `57c7f5a`).
- Added repository review rules, CodeQL scanning, and a hosted MCP integration plan (`1aedd35`).
- Added the Factory Watchdog offline evaluator and fixture tests (`866e9d7`), followed by read-only GitHub collection and health reports (`3611bec`).

## Hosted and prototype work in repository history

These entries describe repository development, not hosted-service readiness or features included in the local purchase.

- Introduced SaaS platform prototype work (`20a4eeb`).
- Added a provider-agnostic payments core (`7e9b8c6`).
- Isolated hosted requests and rejected invalid hosted-mode flags (`f2639a5`); added failed-workspace cleanup (`5fb4287`) and isolation/cleanup tests (`52f7220`, `c82c94b`, `43238c5`).
- Clarified failed versus successful workspace cleanup in documentation (`e82326d`).
