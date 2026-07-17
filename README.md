# VillageSim

A desktop village simulator with an authoritative Rust simulation and a React Canvas renderer.

## Development

Prerequisites: Node 20.19+ and the current Tauri 2 system dependencies for your platform.

```bash
npm install
npm run tauri dev
```

Browser-only rendering demo (deterministic island + camera):

```bash
npm run dev
```

Controls: drag to pan, scroll wheel to zoom (cursor-anchored), `F` for fullscreen.

Focused checks:

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo check --manifest-path src-tauri/Cargo.toml
```

The implementation sequence and milestone definitions live in `docs/villagesim-spec.md`.
