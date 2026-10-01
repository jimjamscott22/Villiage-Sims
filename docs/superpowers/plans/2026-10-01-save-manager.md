# Save Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed "Slot 1" SAVE/LOAD buttons with a save-manager overlay backed by unlimited named saves and separate rotating autosaves.

**Architecture:** A new Rust module `src-tauri/src/saves.rs` owns the saves directory (ids, names, `<id>.meta.json` sidecars, list/rename/delete); `persist.rs` keeps the `.vsav` byte format unchanged. Tauri commands become id-based. On the frontend, pure helpers in `src/state/saves.ts`, an in-memory `DemoSaveStore` for browser-demo parity, and a self-contained `SaveDialog` overlay that App opens from both toolbar buttons.

**Tech Stack:** Rust 2024 (serde, serde_json, bincode), Tauri 2, React + TypeScript, Vitest (Node env, no DOM).

**Spec:** `docs/superpowers/specs/2026-10-01-save-manager-design.md`

## Global Constraints

- `.vsav` format and `SAVE_VERSION` (5) are unchanged; legacy decode paths are not touched.
- Save ids match `^[a-z0-9-]{1,64}$`; every frontend-supplied id is validated before building a path.
- Manual ids: `s-<unix_ms>` (suffix `-<n>` on collision). Autosave ids: `autosave-1..3`.
- Kind is derived from the id (`autosave-` prefix → autosave), never trusted from the sidecar.
- Save names: trimmed, 1–40 characters (Unicode scalar values), no control characters; duplicates allowed.
- Error strings shared by Rust and the demo: `save not found`, `autosaves cannot be renamed`, `autosaves cannot be overwritten`, `save name cannot be empty`, `save name must be at most 40 characters`, `save name cannot contain control characters`.
- Vitest runs in Node: tests must not touch `document`, `window`, `Image`, or canvas.
- Any sim/persistence behaviour change must be mirrored in the browser-demo transport.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Typing a save name in the dialog (letters `f`, `r`, `v`, `n`, Backspace, Delete) must not trigger game hotkeys — today Backspace would demolish the selected building. → Task 6 tests `isHotkeyBlocked`.
2. A crafted id such as `../../etc/x`, `A`, `a/b`, or a 65-char id must be rejected before any filesystem access. → Task 1 `validate_id` tests.
3. A saves directory containing stray files (`.vsav.tmp`, a corrupt `.meta.json`, a `.vsav` with no sidecar, an `UPPER.vsav`) must still list cleanly. → Task 1 listing tests.
4. Opening the dialog while already paused must not unpause on close; opening at 2x must return to 2x (also after a load). → Task 4 `resumeSpeedAfterDialog` tests.
5. Renaming or deleting the save that is the current session must update/clear "Current"; loading an autosave must clear it so SAVE can't overwrite an autosave. → Task 4 `nextCurrentSave` tests.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src-tauri/src/persist.rs` | modify | Extract `write_file_atomic`; `save_world` uses it |
| `src-tauri/src/saves.rs` | create | Ids, names, sidecars, list/rename/delete, `save_world_with_meta` |
| `src-tauri/src/lib.rs` | modify | `mod saves;`, register new commands |
| `src-tauri/src/sim/world.rs` | modify | Autosave writes `autosave-<n>` + sidecar |
| `src-tauri/src/sim/commands.rs` | modify | `SaveGame` carries dir/id/name, replies `SaveInfo` |
| `src-tauri/src/sim/world/commands_handler.rs` | modify | Handle new `SaveGame` |
| `src-tauri/src/commands.rs` | modify | Id-based Tauri commands; remove slot code |
| `src/state/types.ts` | modify | `SaveInfo`, `SaveKind`, `SaveSummary` |
| `src/state/saves.ts` (+ `.test.ts`) | create | Pure save helpers |
| `src/state/demoSaves.ts` (+ `.test.ts`) | create | In-memory save store for browser demo |
| `src/state/demoWorld.ts` (+ test) | modify | Autosave via sink callback; `saveSummary()` |
| `src/state/transport.ts` | modify | New save API on both transports |
| `src/ui/hotkeys.ts` (+ `.test.ts`) | create | Shared hotkey guard |
| `src/render/Canvas.tsx`, `src/ui/ObjectivesPanel.tsx` | modify | Use hotkey guard |
| `src/ui/SaveDialog.tsx` | create | Overlay component |
| `src/App.tsx` | modify | Open dialog, pause/resume, current save, world-swap reset |

---

### Task 1: Rust `saves` module

**Files:**
- Modify: `src-tauri/src/persist.rs` (`save_world`, ~lines 93-105)
- Create: `src-tauri/src/saves.rs`
- Modify: `src-tauri/src/lib.rs` (module list)

**Interfaces:**
- Produces (all in `crate::saves`):
  - `enum SaveKind { Manual, Autosave }` (serde lowercase)
  - `struct SaveMeta { name: String, kind: SaveKind, saved_at: u64, year: Option<u32>, season: Option<u8>, day: Option<u32>, population: Option<u32> }` (serde camelCase)
  - `struct SaveInfo { id: String, name, kind, saved_at, year, season, day, population }` (Serialize, camelCase)
  - `fn validate_id(&str) -> Result<(), String>`
  - `fn validate_name(&str) -> Result<String, String>`
  - `fn vsav_path(&Path, &str) -> PathBuf`
  - `fn autosave_id(u8) -> String`, `fn is_autosave_id(&str) -> bool`, `fn now_ms() -> u64`
  - `fn resolve_save_target(dir: &Path, id: Option<&str>, now_ms: u64) -> Result<String, String>`
  - `fn read_info(&Path, &str) -> Result<SaveInfo, String>`, `fn list(&Path) -> Result<Vec<SaveInfo>, String>`
  - `fn rename(&Path, &str, &str) -> Result<SaveInfo, String>`, `fn delete(&Path, &str) -> Result<(), String>`
  - `fn write_meta(&Path, &str, &SaveMeta) -> Result<(), String>`
  - `crate::persist::write_file_atomic(&Path, &[u8]) -> Result<(), String>`

- [ ] **Step 1: Extract the atomic writer in `persist.rs`**

Replace `save_world` with:

```rust
pub(crate) fn save_world(world: &World, path: &Path) -> Result<(), String> {
    let bytes = encode_world(world)?;
    write_file_atomic(path, &bytes)
}

/// Writes `bytes` to `path` via a sibling temp file + rename, creating the parent dir.
pub(crate) fn write_file_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("could not create save directory: {error}"))?;
    }
    let temporary = temporary_path(path);
    let result = write_and_replace(path, &temporary, bytes);
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}
```

Run: `cargo test --manifest-path src-tauri/Cargo.toml --lib persist` — Expected: PASS (pure refactor).

- [ ] **Step 2: Write `saves.rs` with failing tests first**

Create `src-tauri/src/saves.rs` containing the tests module below plus `todo!()` bodies for each function in the Interfaces list, and add `mod saves;` to `src-tauri/src/lib.rs` (after `mod persist;`).

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "villagesim-saves-{label}-{}-{}",
            std::process::id(),
            now_ms()
        ));
        fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    fn touch_vsav(dir: &Path, id: &str) {
        fs::write(vsav_path(dir, id), b"not decoded by listing").expect("write vsav");
    }

    fn meta(name: &str, kind: SaveKind, saved_at: u64) -> SaveMeta {
        SaveMeta {
            name: name.into(),
            kind,
            saved_at,
            year: Some(2),
            season: Some(1),
            day: Some(4),
            population: Some(14),
        }
    }

    #[test]
    fn validate_id_rejects_unsafe_ids() {
        assert!(validate_id("s-1790000000000").is_ok());
        assert!(validate_id("autosave-2").is_ok());
        assert!(validate_id("slot-1").is_ok());
        let long = "a".repeat(65);
        for bad in ["", "../../etc/x", "a/b", "a\\b", "A", "s 1", "s.1", long.as_str()] {
            assert!(validate_id(bad).is_err(), "{bad:?} should be rejected");
        }
    }

    #[test]
    fn validate_name_trims_and_bounds() {
        assert_eq!(validate_name("  Riverbend ").unwrap(), "Riverbend");
        assert_eq!(validate_name("   ").unwrap_err(), "save name cannot be empty");
        assert!(validate_name(&"é".repeat(40)).is_ok());
        assert_eq!(
            validate_name(&"a".repeat(41)).unwrap_err(),
            "save name must be at most 40 characters"
        );
        assert_eq!(
            validate_name("bad\u{7}name").unwrap_err(),
            "save name cannot contain control characters"
        );
    }

    #[test]
    fn resolve_target_creates_unique_ids_and_guards_overwrites() {
        let dir = temp_dir("resolve");
        assert_eq!(resolve_save_target(&dir, None, 42).unwrap(), "s-42");
        touch_vsav(&dir, "s-42");
        assert_eq!(resolve_save_target(&dir, None, 42).unwrap(), "s-42-1");
        assert_eq!(resolve_save_target(&dir, Some("s-42"), 99).unwrap(), "s-42");
        assert_eq!(resolve_save_target(&dir, Some("s-7"), 99).unwrap_err(), "save not found");
        touch_vsav(&dir, "autosave-1");
        assert_eq!(
            resolve_save_target(&dir, Some("autosave-1"), 99).unwrap_err(),
            "autosaves cannot be overwritten"
        );
        assert!(resolve_save_target(&dir, Some("../x"), 99).is_err());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn list_reads_sidecars_newest_first_and_tolerates_junk() {
        let dir = temp_dir("list");
        // Sidecar times in the future so they sort ahead of mtime fallbacks.
        let far = now_ms() + 10_000_000;
        touch_vsav(&dir, "s-1");
        write_meta(&dir, "s-1", &meta("Older", SaveKind::Manual, far + 1_000)).unwrap();
        touch_vsav(&dir, "s-2");
        write_meta(&dir, "s-2", &meta("Newer", SaveKind::Manual, far + 2_000)).unwrap();
        touch_vsav(&dir, "autosave-3");
        write_meta(&dir, "autosave-3", &meta("Autosave 3", SaveKind::Autosave, far + 1_500)).unwrap();
        // Legacy slot file with no sidecar.
        touch_vsav(&dir, "slot-1");
        // Corrupt sidecar falls back to the file stem.
        touch_vsav(&dir, "s-3");
        fs::write(dir.join("s-3.meta.json"), b"{not json").unwrap();
        // Junk that must be ignored.
        fs::write(dir.join("s-4.vsav.tmp"), b"partial").unwrap();
        fs::write(dir.join("UPPER.vsav"), b"x").unwrap();
        fs::write(dir.join("orphan.meta.json"), b"{}").unwrap();

        let saves = list(&dir).unwrap();
        let ids: Vec<&str> = saves.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids.len(), 5, "{ids:?}");
        assert_eq!(&ids[..3], &["s-2", "autosave-3", "s-1"]);
        let newer = &saves[0];
        assert_eq!(newer.name, "Newer");
        assert_eq!(newer.kind, SaveKind::Manual);
        assert_eq!((newer.year, newer.season, newer.day, newer.population), (Some(2), Some(1), Some(4), Some(14)));
        assert_eq!(saves[1].kind, SaveKind::Autosave);
        let legacy = saves.iter().find(|s| s.id == "slot-1").unwrap();
        assert_eq!(legacy.name, "slot-1");
        assert_eq!(legacy.kind, SaveKind::Manual);
        assert_eq!(legacy.year, None);
        assert!(legacy.saved_at > 0, "falls back to file mtime");
        let corrupt = saves.iter().find(|s| s.id == "s-3").unwrap();
        assert_eq!(corrupt.name, "s-3");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn list_of_missing_dir_is_empty() {
        let dir = std::env::temp_dir().join(format!("villagesim-saves-missing-{}", now_ms()));
        assert!(list(&dir).unwrap().is_empty());
    }

    #[test]
    fn kind_comes_from_id_not_sidecar() {
        let dir = temp_dir("kind");
        touch_vsav(&dir, "s-1");
        write_meta(&dir, "s-1", &meta("Sneaky", SaveKind::Autosave, 1)).unwrap();
        assert_eq!(read_info(&dir, "s-1").unwrap().kind, SaveKind::Manual);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rename_updates_sidecar_and_keeps_game_fields() {
        let dir = temp_dir("rename");
        touch_vsav(&dir, "s-1");
        write_meta(&dir, "s-1", &meta("Old", SaveKind::Manual, 5)).unwrap();
        let info = rename(&dir, "s-1", "  New name ").unwrap();
        assert_eq!(info.name, "New name");
        assert_eq!(info.saved_at, 5);
        assert_eq!(info.population, Some(14));
        assert_eq!(read_info(&dir, "s-1").unwrap().name, "New name");

        // Legacy save without sidecar can be renamed; game fields stay unknown.
        touch_vsav(&dir, "slot-2");
        let legacy = rename(&dir, "slot-2", "Recovered").unwrap();
        assert_eq!(legacy.name, "Recovered");
        assert_eq!(legacy.year, None);

        touch_vsav(&dir, "autosave-1");
        assert_eq!(rename(&dir, "autosave-1", "x").unwrap_err(), "autosaves cannot be renamed");
        assert_eq!(rename(&dir, "s-9", "x").unwrap_err(), "save not found");
        assert_eq!(rename(&dir, "s-1", " ").unwrap_err(), "save name cannot be empty");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn delete_removes_vsav_and_sidecar() {
        let dir = temp_dir("delete");
        touch_vsav(&dir, "s-1");
        write_meta(&dir, "s-1", &meta("Gone", SaveKind::Manual, 1)).unwrap();
        delete(&dir, "s-1").unwrap();
        assert!(!vsav_path(&dir, "s-1").exists());
        assert!(!dir.join("s-1.meta.json").exists());
        touch_vsav(&dir, "slot-1"); // no sidecar is fine
        delete(&dir, "slot-1").unwrap();
        touch_vsav(&dir, "autosave-2"); // autosaves are deletable
        delete(&dir, "autosave-2").unwrap();
        assert_eq!(delete(&dir, "s-1").unwrap_err(), "save not found");
        assert!(delete(&dir, "../x").is_err());
        let _ = fs::remove_dir_all(dir);
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --lib saves::tests`
Expected: FAIL (panics at `todo!()`). Dead-code warnings are expected until Task 3.

- [ ] **Step 4: Implement `saves.rs`**

Replace the `todo!()` bodies so the top of the file reads:

```rust
//! Named save files: `<id>.vsav` (persist byte format) + `<id>.meta.json` sidecar
//! holding the display name and summary. Listing never decodes `.vsav` payloads.

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::persist;

pub const MAX_NAME_CHARS: usize = 40;
const MAX_ID_LEN: usize = 64;
const AUTOSAVE_PREFIX: &str = "autosave-";
const NOT_FOUND: &str = "save not found";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SaveKind {
    Manual,
    Autosave,
}

/// Sidecar contents. Game fields are optional so legacy saves can be renamed.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveMeta {
    pub name: String,
    pub kind: SaveKind,
    pub saved_at: u64,
    pub year: Option<u32>,
    pub season: Option<u8>,
    pub day: Option<u32>,
    pub population: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveInfo {
    pub id: String,
    pub name: String,
    pub kind: SaveKind,
    pub saved_at: u64,
    pub year: Option<u32>,
    pub season: Option<u8>,
    pub day: Option<u32>,
    pub population: Option<u32>,
}

impl SaveInfo {
    fn from_meta(id: &str, meta: SaveMeta) -> Self {
        Self {
            id: id.to_string(),
            name: meta.name,
            kind: kind_for_id(id),
            saved_at: meta.saved_at,
            year: meta.year,
            season: meta.season,
            day: meta.day,
            population: meta.population,
        }
    }

    fn to_meta(&self) -> SaveMeta {
        SaveMeta {
            name: self.name.clone(),
            kind: self.kind,
            saved_at: self.saved_at,
            year: self.year,
            season: self.season,
            day: self.day,
            population: self.population,
        }
    }
}

pub fn validate_id(id: &str) -> Result<(), String> {
    let valid = !id.is_empty()
        && id.len() <= MAX_ID_LEN
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    if valid {
        Ok(())
    } else {
        Err(format!("invalid save id '{id}'"))
    }
}

pub fn validate_name(raw: &str) -> Result<String, String> {
    let name = raw.trim();
    if name.is_empty() {
        return Err("save name cannot be empty".into());
    }
    if name.chars().count() > MAX_NAME_CHARS {
        return Err(format!("save name must be at most {MAX_NAME_CHARS} characters"));
    }
    if name.chars().any(char::is_control) {
        return Err("save name cannot contain control characters".into());
    }
    Ok(name.to_string())
}

pub fn vsav_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.vsav"))
}

fn meta_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.meta.json"))
}

pub fn autosave_id(slot: u8) -> String {
    format!("{AUTOSAVE_PREFIX}{slot}")
}

pub fn is_autosave_id(id: &str) -> bool {
    id.starts_with(AUTOSAVE_PREFIX)
}

fn kind_for_id(id: &str) -> SaveKind {
    if is_autosave_id(id) {
        SaveKind::Autosave
    } else {
        SaveKind::Manual
    }
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// `None` → a fresh manual id; `Some(id)` → that existing manual save (overwrite).
pub fn resolve_save_target(dir: &Path, id: Option<&str>, now_ms: u64) -> Result<String, String> {
    match id {
        Some(id) => {
            validate_id(id)?;
            if is_autosave_id(id) {
                return Err("autosaves cannot be overwritten".into());
            }
            if !vsav_path(dir, id).exists() {
                return Err(NOT_FOUND.into());
            }
            Ok(id.to_string())
        }
        None => {
            let base = format!("s-{now_ms}");
            if !vsav_path(dir, &base).exists() {
                return Ok(base);
            }
            Ok((1u32..)
                .map(|n| format!("{base}-{n}"))
                .find(|candidate| !vsav_path(dir, candidate).exists())
                .expect("unbounded suffix search"))
        }
    }
}

pub fn write_meta(dir: &Path, id: &str, meta: &SaveMeta) -> Result<(), String> {
    validate_id(id)?;
    let bytes = serde_json::to_vec_pretty(meta)
        .map_err(|error| format!("could not encode save metadata: {error}"))?;
    persist::write_file_atomic(&meta_path(dir, id), &bytes)
}

pub fn read_info(dir: &Path, id: &str) -> Result<SaveInfo, String> {
    validate_id(id)?;
    let file = fs::metadata(vsav_path(dir, id)).map_err(|_| NOT_FOUND.to_string())?;
    let sidecar = fs::read(meta_path(dir, id))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<SaveMeta>(&bytes).ok());
    Ok(match sidecar {
        Some(meta) => SaveInfo::from_meta(id, meta),
        None => SaveInfo {
            id: id.to_string(),
            name: id.to_string(),
            kind: kind_for_id(id),
            saved_at: file
                .modified()
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            year: None,
            season: None,
            day: None,
            population: None,
        },
    })
}

/// Every valid `<id>.vsav` in `dir`, newest first. A missing directory is empty.
pub fn list(dir: &Path) -> Result<Vec<SaveInfo>, String> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("could not read save directory: {error}")),
    };
    let mut saves: Vec<SaveInfo> = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("vsav") {
                return None;
            }
            let id = path.file_stem()?.to_str()?;
            read_info(dir, id).ok()
        })
        .collect();
    saves.sort_by(|a, b| b.saved_at.cmp(&a.saved_at).then_with(|| a.id.cmp(&b.id)));
    Ok(saves)
}

pub fn rename(dir: &Path, id: &str, raw_name: &str) -> Result<SaveInfo, String> {
    validate_id(id)?;
    if is_autosave_id(id) {
        return Err("autosaves cannot be renamed".into());
    }
    let name = validate_name(raw_name)?;
    let mut info = read_info(dir, id)?;
    info.name = name;
    write_meta(dir, id, &info.to_meta())?;
    Ok(info)
}

pub fn delete(dir: &Path, id: &str) -> Result<(), String> {
    validate_id(id)?;
    let vsav = vsav_path(dir, id);
    if !vsav.exists() {
        return Err(NOT_FOUND.into());
    }
    fs::remove_file(&vsav).map_err(|error| format!("could not delete save: {error}"))?;
    match fs::remove_file(meta_path(dir, id)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("could not delete save metadata: {error}")),
    }
}
```

Note `read_info` validates the id, so `UPPER.vsav` and other invalid stems are silently skipped by `list`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --lib saves::tests`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/saves.rs src-tauri/src/persist.rs src-tauri/src/lib.rs
git commit -m "Add saves module for named saves with metadata sidecars"
```

---

### Task 2: Write saves with metadata; autosave to `autosave-<n>`

**Files:**
- Modify: `src-tauri/src/saves.rs` (add `save_world_with_meta`)
- Modify: `src-tauri/src/sim/world.rs` (`maybe_autosave` ~line 1965; test `autosave_rotates_through_three_slots` ~line 3841)

**Interfaces:**
- Consumes: Task 1 (`validate_id`, `vsav_path`, `write_meta`, `autosave_id`, `now_ms`, `SaveInfo`, `SaveMeta`), `persist::save_world`, `World::clock()`, `World::villagers()`.
- Produces: `saves::save_world_with_meta(world: &World, dir: &Path, id: &str, name: &str, saved_at: u64) -> Result<SaveInfo, String>`.

- [ ] **Step 1: Update the autosave test (failing)**

In `src-tauri/src/sim/world.rs`, replace the body of `autosave_rotates_through_three_slots` from `world.advance_clock(1, None)` through the last `slot-1.vsav` assertion with:

```rust
        // A manual save in the same directory must never be touched by rotation.
        std::fs::write(dir.join("s-1.vsav"), b"manual").expect("manual save");

        world.advance_clock(1, None).unwrap();
        assert_eq!(world.tick_snapshot().last_autosave_slot, Some(2)); // day 2 → slot 2
        assert!(dir.join("autosave-2.vsav").exists());
        assert!(dir.join("autosave-2.meta.json").exists());

        world.advance_clock(1, None).unwrap();
        assert_eq!(world.tick_snapshot().last_autosave_slot, Some(3)); // day 3 → slot 3
        assert!(dir.join("autosave-3.vsav").exists());

        world.advance_clock(1, None).unwrap();
        assert_eq!(world.tick_snapshot().last_autosave_slot, Some(1)); // day 4 → slot 1
        assert!(dir.join("autosave-1.vsav").exists());
        assert!(!dir.join("slot-1.vsav").exists());
        assert_eq!(std::fs::read(dir.join("s-1.vsav")).unwrap(), b"manual");

        let info = crate::saves::read_info(&dir, "autosave-1").expect("autosave info");
        assert_eq!(info.name, "Autosave 1");
        assert_eq!(info.kind, crate::saves::SaveKind::Autosave);
        assert_eq!(info.day, Some(4));
        assert_eq!(info.population, Some(world.villagers().len() as u32));
        let listed = crate::saves::list(&dir).expect("list");
        assert_eq!(listed.iter().filter(|s| s.kind == crate::saves::SaveKind::Autosave).count(), 3);
```

Keep the existing trailing `snap` assertions and `remove_dir_all`.

- [ ] **Step 2: Run to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --lib autosave_rotates_through_three_slots`
Expected: FAIL (`autosave-2.vsav` missing).

- [ ] **Step 3: Add `save_world_with_meta` to `saves.rs`**

Add `use crate::sim::world::World;` to the imports, then:

```rust
/// Writes `<id>.vsav` then its sidecar. A sidecar failure leaves a loadable,
/// listable save (fallback name) and is still reported as an error.
pub fn save_world_with_meta(
    world: &World,
    dir: &Path,
    id: &str,
    name: &str,
    saved_at: u64,
) -> Result<SaveInfo, String> {
    validate_id(id)?;
    persist::save_world(world, &vsav_path(dir, id))?;
    let clock = world.clock();
    let meta = SaveMeta {
        name: name.to_string(),
        kind: kind_for_id(id),
        saved_at,
        year: Some(clock.year),
        season: Some(clock.season.as_u8()),
        day: Some(clock.day),
        population: Some(world.villagers().len() as u32),
    };
    write_meta(dir, id, &meta)?;
    Ok(SaveInfo::from_meta(id, meta))
}
```

- [ ] **Step 4: Point `maybe_autosave` at it**

```rust
    fn maybe_autosave(&mut self) {
        let Some(dir) = self.autosave_dir.clone() else {
            return;
        };
        let slot = autosave_slot_for(&self.clock);
        let id = crate::saves::autosave_id(slot);
        let name = format!("Autosave {slot}");
        match crate::saves::save_world_with_meta(self, &dir, &id, &name, crate::saves::now_ms()) {
            Ok(_) => self.last_autosave_slot = Some(slot),
            Err(error) => eprintln!("autosave to slot {slot} failed: {error}"),
        }
    }
```

- [ ] **Step 5: Run tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --lib`
Expected: PASS (all existing tests + updated autosave test).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/saves.rs src-tauri/src/sim/world.rs
git commit -m "Write autosaves to dedicated autosave files with metadata"
```

---

### Task 3: Id-based Tauri commands

**Files:**
- Modify: `src-tauri/src/sim/commands.rs` (`SaveGame` variant, ~line 67)
- Modify: `src-tauri/src/sim/world/commands_handler.rs` (`SaveGame` arm, ~line 72)
- Modify: `src-tauri/src/commands.rs` (replace `validate_slot`, `save_slot_path`, `save_game`, `load_game`, test `save_slots_are_limited_to_three`)
- Modify: `src-tauri/src/lib.rs` (`generate_handler!`)

**Interfaces:**
- Consumes: Task 1/2 `saves::*`.
- Produces (Tauri, JS arg names): `list_saves() -> SaveInfo[]`, `save_game({ id: string | null, name: string }) -> SaveInfo`, `load_game({ id: string }) -> WorldInit`, `rename_save({ id, name }) -> SaveInfo`, `delete_save({ id }) -> null`.

- [ ] **Step 1: Change the sim command**

In `src-tauri/src/sim/commands.rs`:

```rust
    SaveGame {
        dir: PathBuf,
        id: String,
        name: String,
        reply: oneshot::Sender<Result<crate::saves::SaveInfo, String>>,
    },
```

In `commands_handler.rs`:

```rust
            SimCommand::SaveGame {
                dir,
                id,
                name,
                reply,
            } => {
                let result = crate::saves::save_world_with_meta(
                    self,
                    &dir,
                    &id,
                    &name,
                    crate::saves::now_ms(),
                );
                let _ = reply.send(result);
            }
```

- [ ] **Step 2: Replace slot commands in `src-tauri/src/commands.rs`**

Delete `validate_slot`, `save_slot_path`, the old `save_game`/`load_game`, and the `save_slots_are_limited_to_three` test. Add `use crate::saves::{self, SaveInfo};` and:

```rust
fn saves_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("saves"))
        .map_err(|error| format!("could not locate app data directory: {error}"))
}

#[tauri::command]
pub(crate) fn list_saves(app: AppHandle) -> Result<Vec<SaveInfo>, String> {
    saves::list(&saves_dir(&app)?)
}

/// `id: None` creates a new save; `Some(id)` overwrites that manual save.
#[tauri::command]
pub(crate) async fn save_game(
    app: AppHandle,
    state: State<'_, AppState>,
    id: Option<String>,
    name: String,
) -> Result<SaveInfo, String> {
    let dir = saves_dir(&app)?;
    let name = saves::validate_name(&name)?;
    let id = saves::resolve_save_target(&dir, id.as_deref(), saves::now_ms())?;
    let (reply, receiver) = oneshot::channel();
    state
        .commands
        .send(SimCommand::SaveGame { dir, id, name, reply })
        .map_err(|_| "simulation command channel closed".to_string())?;
    receiver
        .await
        .map_err(|_| "simulation dropped save_game".to_string())?
}

#[tauri::command]
pub(crate) async fn load_game(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<WorldInit, String> {
    saves::validate_id(&id)?;
    let path = saves::vsav_path(&saves_dir(&app)?, &id);
    if !path.exists() {
        return Err("save not found".into());
    }
    let (reply, receiver) = oneshot::channel();
    state
        .commands
        .send(SimCommand::LoadGame { path, reply })
        .map_err(|_| "simulation command channel closed".to_string())?;
    receiver
        .await
        .map_err(|_| "simulation dropped load_game".to_string())?
}

#[tauri::command]
pub(crate) fn rename_save(app: AppHandle, id: String, name: String) -> Result<SaveInfo, String> {
    saves::rename(&saves_dir(&app)?, &id, &name)
}

#[tauri::command]
pub(crate) fn delete_save(app: AppHandle, id: String) -> Result<(), String> {
    saves::delete(&saves_dir(&app)?, &id)
}
```

- [ ] **Step 3: Register commands in `lib.rs`**

Replace `commands::save_game, commands::load_game` in `generate_handler!` with:

```rust
            commands::list_saves,
            commands::save_game,
            commands::load_game,
            commands::rename_save,
            commands::delete_save
```

- [ ] **Step 4: Verify**

Run: `cargo check --manifest-path src-tauri/Cargo.toml && cargo test --manifest-path src-tauri/Cargo.toml --lib`
Expected: no errors, no new warnings, all tests PASS. (The command wrappers are thin; their logic is covered by Task 1 tests.)

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src
git commit -m "Replace slot save commands with id-based save management commands"
```

---

### Task 4: Frontend save types and pure helpers

**Files:**
- Modify: `src/state/types.ts`
- Create: `src/state/saves.ts`, `src/state/saves.test.ts`

**Interfaces:**
- Consumes: `seasonName(season: number): string` from `src/state/chronicle.ts`.
- Produces:
  - types: `SaveKind = 'manual' | 'autosave'`; `SaveInfo { id; name; kind; savedAt: number; year: number | null; season: number | null; day: number | null; population: number | null }`; `SaveSummary { year; season; day; population }` (all numbers).
  - `MAX_SAVE_NAME_CHARS = 40`
  - `validateSaveName(raw: string): { ok: true; name: string } | { ok: false; error: string }`
  - `sortSaves(list: SaveInfo[]): SaveInfo[]`, `groupSaves(list): { manual: SaveInfo[]; autosave: SaveInfo[] }`
  - `formatGameDate(info: SaveInfo): string`, `formatSavedAt(savedAt: number, now: number): string`
  - `CurrentSave = { id: string; name: string } | null`
  - `SaveEvent = { type: 'saved' | 'loaded' | 'renamed'; info: SaveInfo } | { type: 'deleted'; id: string }`
  - `nextCurrentSave(current: CurrentSave, event: SaveEvent): CurrentSave`
  - `resumeSpeedAfterDialog(speedOnOpen: number): number | null`

- [ ] **Step 1: Add types to `src/state/types.ts`**

```ts
export type SaveKind = 'manual' | 'autosave';

export interface SaveInfo {
  id: string;
  name: string;
  kind: SaveKind;
  /** Unix milliseconds (wall clock) when written. */
  savedAt: number;
  year: number | null;
  season: number | null;
  day: number | null;
  population: number | null;
}

/** In-game summary recorded alongside a save. */
export interface SaveSummary {
  year: number;
  season: number;
  day: number;
  population: number;
}
```

- [ ] **Step 2: Write failing tests `src/state/saves.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  formatGameDate,
  formatSavedAt,
  groupSaves,
  nextCurrentSave,
  resumeSpeedAfterDialog,
  sortSaves,
  validateSaveName,
} from './saves';
import type { SaveInfo } from './types';

function info(overrides: Partial<SaveInfo> = {}): SaveInfo {
  return {
    id: 's-1',
    name: 'Riverbend',
    kind: 'manual',
    savedAt: 1_000,
    year: 2,
    season: 1,
    day: 4,
    population: 14,
    ...overrides,
  };
}

describe('validateSaveName', () => {
  it('trims and accepts normal names', () => {
    expect(validateSaveName('  Riverbend ')).toEqual({ ok: true, name: 'Riverbend' });
  });
  it('rejects empty, too long, and control characters with the Rust messages', () => {
    expect(validateSaveName('   ')).toEqual({ ok: false, error: 'save name cannot be empty' });
    expect(validateSaveName('a'.repeat(41))).toEqual({
      ok: false,
      error: 'save name must be at most 40 characters',
    });
    expect(validateSaveName('bad\u0007name')).toEqual({
      ok: false,
      error: 'save name cannot contain control characters',
    });
  });
  it('counts characters, not UTF-16 units', () => {
    expect(validateSaveName('🌾'.repeat(40)).ok).toBe(true);
  });
});

describe('sortSaves / groupSaves', () => {
  it('orders newest first, ties by id, and splits by kind', () => {
    const list = [
      info({ id: 's-1', savedAt: 1 }),
      info({ id: 'autosave-2', kind: 'autosave', savedAt: 3 }),
      info({ id: 's-3', savedAt: 3 }),
    ];
    expect(sortSaves(list).map((s) => s.id)).toEqual(['autosave-2', 's-3', 's-1']);
    const groups = groupSaves(list);
    expect(groups.manual.map((s) => s.id)).toEqual(['s-3', 's-1']);
    expect(groups.autosave.map((s) => s.id)).toEqual(['autosave-2']);
  });
});

describe('formatting', () => {
  it('formats the in-game date or a dash when unknown', () => {
    expect(formatGameDate(info())).toBe('Y2 Summer D4');
    expect(formatGameDate(info({ year: null, season: null, day: null }))).toBe('—');
  });
  it('formats relative wall-clock time', () => {
    const now = Date.UTC(2026, 9, 1, 12, 0, 0);
    expect(formatSavedAt(now - 10_000, now)).toBe('just now');
    expect(formatSavedAt(now - 2 * 60_000, now)).toBe('2m ago');
    expect(formatSavedAt(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(formatSavedAt(Date.UTC(2026, 8, 28, 12), now)).toBe('Sep 28');
  });
});

describe('nextCurrentSave', () => {
  const current = { id: 's-1', name: 'Riverbend' };
  it('tracks manual saves and loads', () => {
    expect(nextCurrentSave(null, { type: 'saved', info: info({ id: 's-2', name: 'New' }) })).toEqual({
      id: 's-2',
      name: 'New',
    });
    expect(nextCurrentSave(null, { type: 'loaded', info: info() })).toEqual(current);
  });
  it('clears on loading an autosave', () => {
    expect(
      nextCurrentSave(current, { type: 'loaded', info: info({ id: 'autosave-1', kind: 'autosave' }) }),
    ).toBeNull();
  });
  it('follows renames and deletes of the current save only', () => {
    expect(nextCurrentSave(current, { type: 'renamed', info: info({ name: 'Renamed' }) })).toEqual({
      id: 's-1',
      name: 'Renamed',
    });
    expect(nextCurrentSave(current, { type: 'renamed', info: info({ id: 's-9' }) })).toBe(current);
    expect(nextCurrentSave(current, { type: 'deleted', id: 's-1' })).toBeNull();
    expect(nextCurrentSave(current, { type: 'deleted', id: 's-9' })).toBe(current);
  });
});

describe('resumeSpeedAfterDialog', () => {
  it('restores a running speed and leaves a paused game paused', () => {
    expect(resumeSpeedAfterDialog(2)).toBe(2);
    expect(resumeSpeedAfterDialog(0)).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/state/saves.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/state/saves.ts`**

```ts
import { seasonName } from './chronicle';
import type { SaveInfo } from './types';

export const MAX_SAVE_NAME_CHARS = 40;

export type NameCheck = { ok: true; name: string } | { ok: false; error: string };

/** Mirrors `saves::validate_name` in src-tauri/src/saves.rs. */
export function validateSaveName(raw: string): NameCheck {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, error: 'save name cannot be empty' };
  if ([...name].length > MAX_SAVE_NAME_CHARS) {
    return { ok: false, error: `save name must be at most ${MAX_SAVE_NAME_CHARS} characters` };
  }
  if (/\p{Cc}/u.test(name)) return { ok: false, error: 'save name cannot contain control characters' };
  return { ok: true, name };
}

/** Newest first; ties broken by id (matches Rust `saves::list`). */
export function sortSaves(list: SaveInfo[]): SaveInfo[] {
  return [...list].sort((a, b) => b.savedAt - a.savedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function groupSaves(list: SaveInfo[]): { manual: SaveInfo[]; autosave: SaveInfo[] } {
  const sorted = sortSaves(list);
  return {
    manual: sorted.filter((save) => save.kind === 'manual'),
    autosave: sorted.filter((save) => save.kind === 'autosave'),
  };
}

export function formatGameDate(info: SaveInfo): string {
  if (info.year == null || info.season == null || info.day == null) return '—';
  return `Y${info.year} ${seasonName(info.season)} D${info.day}`;
}

export function formatSavedAt(savedAt: number, now: number): string {
  const elapsed = Math.max(0, now - savedAt);
  if (elapsed < 60_000) return 'just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Date(savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** The manual save that the dialog's primary SAVE overwrites. */
export type CurrentSave = { id: string; name: string } | null;

export type SaveEvent =
  | { type: 'saved' | 'loaded' | 'renamed'; info: SaveInfo }
  | { type: 'deleted'; id: string };

export function nextCurrentSave(current: CurrentSave, event: SaveEvent): CurrentSave {
  switch (event.type) {
    case 'saved':
    case 'loaded':
      return event.info.kind === 'manual' ? { id: event.info.id, name: event.info.name } : null;
    case 'renamed':
      return current?.id === event.info.id ? { id: current.id, name: event.info.name } : current;
    case 'deleted':
      return current?.id === event.id ? null : current;
  }
}

/** Speed to restore when the dialog closes; `null` means stay paused. */
export function resumeSpeedAfterDialog(speedOnOpen: number): number | null {
  return speedOnOpen > 0 ? speedOnOpen : null;
}
```

- [ ] **Step 5: Run tests** — `npx vitest run src/state/saves.test.ts` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/state/types.ts src/state/saves.ts src/state/saves.test.ts
git commit -m "Add frontend save types and pure save-manager helpers"
```

---

### Task 5: Browser-demo save store and transport API

**Files:**
- Create: `src/state/demoSaves.ts`, `src/state/demoSaves.test.ts`
- Modify: `src/state/demoWorld.ts` (`autosaves` field ~line 710, `bindAutosave` ~line 745, `maybeAutosave` ~line 1535; add `saveSummary()`)
- Modify: `src/state/demoWorld.test.ts` (autosave test ~line 551)
- Modify: `src/state/transport.ts`

**Interfaces:**
- Consumes: Task 4 `validateSaveName`, `sortSaves`, `SaveInfo`, `SaveSummary`.
- Produces:
  - `class DemoSaveStore(now?: () => number)` with `list(): SaveInfo[]`, `save(id: string | null, name: string, state: string, summary: SaveSummary): SaveInfo`, `writeAutosave(slot: number, state: string, summary: SaveSummary): void`, `read(id: string): string`, `rename(id: string, name: string): SaveInfo`, `delete(id: string): void`
  - `DemoWorld.bindAutosave(sink: (slot: number, state: string, summary: SaveSummary) => void): void`, `DemoWorld.saveSummary(): SaveSummary`
  - `Transport`: `listSaves(): Promise<SaveInfo[]>`, `saveGame(id: string | null, name: string): Promise<SaveInfo>`, `loadGame(id: string): Promise<WorldInit>`, `renameSave(id: string, name: string): Promise<SaveInfo>`, `deleteSave(id: string): Promise<void>`

- [ ] **Step 1: Write failing tests `src/state/demoSaves.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { DemoSaveStore } from './demoSaves';

const summary = { year: 1, season: 2, day: 3, population: 6 };

function store() {
  let now = 1_000;
  return new DemoSaveStore(() => (now += 1_000));
}

describe('DemoSaveStore', () => {
  it('creates, lists newest first, and reads back state', () => {
    const saves = store();
    const a = saves.save(null, ' First ', 'state-a', summary);
    const b = saves.save(null, 'Second', 'state-b', summary);
    expect(a).toMatchObject({ name: 'First', kind: 'manual', year: 1, season: 2, day: 3, population: 6 });
    expect(a.id).not.toBe(b.id);
    expect(saves.list().map((s) => s.name)).toEqual(['Second', 'First']);
    expect(saves.read(a.id)).toBe('state-a');
  });

  it('overwrites an existing manual save in place', () => {
    const saves = store();
    const a = saves.save(null, 'First', 'old', summary);
    const again = saves.save(a.id, 'First v2', 'new', { ...summary, day: 9 });
    expect(again.id).toBe(a.id);
    expect(again.day).toBe(9);
    expect(saves.read(a.id)).toBe('new');
    expect(saves.list()).toHaveLength(1);
    expect(() => saves.save('s-404', 'x', 's', summary)).toThrow('save not found');
  });

  it('keeps autosaves separate and protects them from overwrite/rename', () => {
    const saves = store();
    saves.writeAutosave(2, 'auto', summary);
    const [auto] = saves.list();
    expect(auto).toMatchObject({ id: 'autosave-2', name: 'Autosave 2', kind: 'autosave' });
    expect(() => saves.save('autosave-2', 'x', 's', summary)).toThrow('autosaves cannot be overwritten');
    expect(() => saves.rename('autosave-2', 'x')).toThrow('autosaves cannot be renamed');
    saves.delete('autosave-2');
    expect(saves.list()).toEqual([]);
  });

  it('renames, deletes, and validates names', () => {
    const saves = store();
    const a = saves.save(null, 'First', 's', summary);
    expect(saves.rename(a.id, ' Renamed ').name).toBe('Renamed');
    expect(() => saves.rename(a.id, '  ')).toThrow('save name cannot be empty');
    expect(() => saves.save(null, 'a'.repeat(41), 's', summary)).toThrow(
      'save name must be at most 40 characters',
    );
    saves.delete(a.id);
    expect(() => saves.read(a.id)).toThrow('save not found');
    expect(() => saves.delete(a.id)).toThrow('save not found');
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/state/demoSaves.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/state/demoSaves.ts`**

```ts
import { sortSaves, validateSaveName } from './saves';
import type { SaveInfo, SaveKind, SaveSummary } from './types';

const AUTOSAVE_PREFIX = 'autosave-';

/** In-memory mirror of src-tauri/src/saves.rs for the browser-demo transport. */
export class DemoSaveStore {
  private readonly entries = new Map<string, { info: SaveInfo; state: string }>();
  private nextId = 1;

  constructor(private readonly now: () => number = () => Date.now()) {}

  list(): SaveInfo[] {
    return sortSaves([...this.entries.values()].map((entry) => ({ ...entry.info })));
  }

  save(id: string | null, rawName: string, state: string, summary: SaveSummary): SaveInfo {
    const name = this.checkName(rawName);
    if (id != null) {
      if (id.startsWith(AUTOSAVE_PREFIX)) throw new Error('autosaves cannot be overwritten');
      if (!this.entries.has(id)) throw new Error('save not found');
    }
    return this.put(id ?? `s-${this.nextId++}`, name, 'manual', state, summary);
  }

  writeAutosave(slot: number, state: string, summary: SaveSummary): void {
    this.put(`${AUTOSAVE_PREFIX}${slot}`, `Autosave ${slot}`, 'autosave', state, summary);
  }

  read(id: string): string {
    return this.entry(id).state;
  }

  rename(id: string, rawName: string): SaveInfo {
    if (id.startsWith(AUTOSAVE_PREFIX)) throw new Error('autosaves cannot be renamed');
    const name = this.checkName(rawName);
    const entry = this.entry(id);
    entry.info = { ...entry.info, name };
    return { ...entry.info };
  }

  delete(id: string): void {
    if (!this.entries.delete(id)) throw new Error('save not found');
  }

  private entry(id: string) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error('save not found');
    return entry;
  }

  private checkName(raw: string): string {
    const check = validateSaveName(raw);
    if (!check.ok) throw new Error(check.error);
    return check.name;
  }

  private put(id: string, name: string, kind: SaveKind, state: string, summary: SaveSummary): SaveInfo {
    const info: SaveInfo = { id, name, kind, savedAt: this.now(), ...summary };
    this.entries.set(id, { info, state });
    return { ...info };
  }
}
```

Run: `npx vitest run src/state/demoSaves.test.ts` — Expected: PASS.

- [ ] **Step 4: Switch `DemoWorld` autosave to a sink (update test first)**

In `src/state/demoWorld.test.ts`, replace the body of `'exposes deterministic weather and rotates autosaves on day rollover'` with:

```ts
    const written: { slot: number; day: number }[] = [];
    const world = new DemoWorld(grassTerrain(16, 16));
    world.bindAutosave((slot, state, summary) => {
      expect(typeof state).toBe('string');
      written.push({ slot, day: summary.day });
    });

    expect(world.snapshot().clock.weather).toBe(demoWeatherFor(42, 1, 0, 1));

    world.advanceClock(1, null);
    expect(world.snapshot().lastAutosaveSlot).toBe(2);
    world.advanceClock(1, null);
    expect(world.snapshot().lastAutosaveSlot).toBe(3);
    world.advanceClock(1, null);
    expect(world.snapshot().lastAutosaveSlot).toBe(1);
    expect(written).toEqual([
      { slot: 2, day: 2 },
      { slot: 3, day: 3 },
      { slot: 1, day: 4 },
    ]);
    expect(world.saveSummary()).toMatchObject({ year: 1, season: 0, day: 4 });
```

Run: `npx vitest run src/state/demoWorld.test.ts` — Expected: FAIL (type/sink mismatch).

Then in `src/state/demoWorld.ts`:
- add `SaveSummary` to the `./types` type import;
- replace the field `private autosaves: Map<number, string> | null = null;` with
  `private autosaveSink: ((slot: number, state: string, summary: SaveSummary) => void) | null = null;`
- replace `bindAutosave`:

```ts
  /** Wire the transport's save store for rotating daily autosaves. */
  bindAutosave(sink: (slot: number, state: string, summary: SaveSummary) => void): void {
    this.autosaveSink = sink;
  }

  /** In-game summary recorded alongside a save (mirrors `saves::save_world_with_meta`). */
  saveSummary(): SaveSummary {
    return {
      year: this.clock.year,
      season: this.clock.season,
      day: this.clock.day,
      population: this.villagers.length,
    };
  }
```

- replace `maybeAutosave`:

```ts
  private maybeAutosave(): void {
    if (this.autosaveSink == null) return;
    const slot = demoAutosaveSlot(this.clock.year, this.clock.season, this.clock.day);
    this.autosaveSink(slot, this.exportState(), this.saveSummary());
    this.lastAutosaveSlot = slot;
  }
```

Run: `npx vitest run src/state/demoWorld.test.ts` — Expected: PASS.

- [ ] **Step 5: Update `src/state/transport.ts`**

Interface — replace the two slot methods with:

```ts
  listSaves(): Promise<SaveInfo[]>;
  saveGame(id: string | null, name: string): Promise<SaveInfo>;
  loadGame(id: string): Promise<WorldInit>;
  renameSave(id: string, name: string): Promise<SaveInfo>;
  deleteSave(id: string): Promise<void>;
```

(add `SaveInfo` to the `./types` import; `import { DemoSaveStore } from './demoSaves';`).

`BrowserTransport`: replace `private readonly saves = new Map<number, string>();` with `private readonly saves = new DemoSaveStore();`; in the constructor replace `this.world.bindAutosave(this.saves);` with `this.bindWorldAutosave();`; replace `saveGame`/`loadGame` and delete `validateSlot` with:

```ts
  async listSaves(): Promise<SaveInfo[]> {
    return this.saves.list();
  }

  async saveGame(id: string | null, name: string): Promise<SaveInfo> {
    return this.saves.save(id, name, this.world.exportState(), this.world.saveSummary());
  }

  async loadGame(id: string): Promise<WorldInit> {
    this.world = DemoWorld.importState(this.saves.read(id));
    this.bindWorldAutosave();
    this.elapsed = 0;
    this.emit(this.world.snapshot());
    return this.world.worldInit();
  }

  async renameSave(id: string, name: string): Promise<SaveInfo> {
    return this.saves.rename(id, name);
  }

  async deleteSave(id: string): Promise<void> {
    this.saves.delete(id);
  }

  private bindWorldAutosave(): void {
    this.world.bindAutosave((slot, state, summary) => this.saves.writeAutosave(slot, state, summary));
  }
```

`tauriTransport`: replace the two slot entries with:

```ts
  listSaves: () => invoke<SaveInfo[]>('list_saves'),
  saveGame: (id, name) => invoke<SaveInfo>('save_game', { id, name }),
  loadGame: (id) => invoke<WorldInit>('load_game', { id }),
  renameSave: (id, name) => invoke<SaveInfo>('rename_save', { id, name }),
  deleteSave: (id) => invoke('delete_save', { id }),
```

- [ ] **Step 6: Verify** — `npm test` — Expected: all PASS. (`npx tsc -b` will still fail in `App.tsx` until Task 7; that's expected — do not fix App here.)

- [ ] **Step 7: Commit**

```bash
git add src/state
git commit -m "Add named-save store to browser demo and id-based transport save API"
```

---

### Task 6: Block game hotkeys while typing or a modal is open

**Files:**
- Create: `src/ui/hotkeys.ts`, `src/ui/hotkeys.test.ts`
- Modify: `src/App.tsx` (remove local `isTypingTarget` ~line 33; keydown effect ~line 95)
- Modify: `src/render/Canvas.tsx` (`onKeyDown` ~line 672)
- Modify: `src/ui/ObjectivesPanel.tsx` (Escape handler ~line 44)

**Interfaces:**
- Produces: `isTypingTarget(target: unknown): boolean`, `isHotkeyBlocked(target: unknown, modalOpen: boolean): boolean`, `shouldIgnoreHotkey(event: KeyboardEvent): boolean` (DOM wrapper; checks `document.querySelector('[aria-modal="true"]')`).

- [ ] **Step 1: Write failing test `src/ui/hotkeys.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { isHotkeyBlocked, isTypingTarget } from './hotkeys';

describe('hotkey guard', () => {
  it('treats inputs, textareas, selects and contenteditable as typing targets', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'CANVAS' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('blocks hotkeys while typing or while a modal is open', () => {
    expect(isHotkeyBlocked({ tagName: 'INPUT' }, false)).toBe(true);
    expect(isHotkeyBlocked({ tagName: 'BODY' }, true)).toBe(true);
    expect(isHotkeyBlocked({ tagName: 'BODY' }, false)).toBe(false);
  });
});
```

Run: `npx vitest run src/ui/hotkeys.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement `src/ui/hotkeys.ts`**

```ts
const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

/** Duck-typed so it is testable in Node (no `HTMLElement`). */
export function isTypingTarget(target: unknown): boolean {
  if (target == null || typeof target !== 'object') return false;
  const element = target as { tagName?: unknown; isContentEditable?: unknown };
  return (
    element.isContentEditable === true ||
    (typeof element.tagName === 'string' && TYPING_TAGS.includes(element.tagName))
  );
}

export function isHotkeyBlocked(target: unknown, modalOpen: boolean): boolean {
  return modalOpen || isTypingTarget(target);
}

/** Global game hotkeys must not fire while typing or behind a modal dialog. */
export function shouldIgnoreHotkey(event: KeyboardEvent): boolean {
  return isHotkeyBlocked(event.target, document.querySelector('[aria-modal="true"]') !== null);
}
```

Run: `npx vitest run src/ui/hotkeys.test.ts` — Expected: PASS.

- [ ] **Step 3: Use the guard**

- `src/App.tsx`: delete the local `isTypingTarget` function; `import { shouldIgnoreHotkey } from './ui/hotkeys';`; in the keydown effect change the first line to
  `if (event.ctrlKey || event.metaKey || event.altKey || shouldIgnoreHotkey(event)) return;`
- `src/render/Canvas.tsx`: `import { shouldIgnoreHotkey } from '../ui/hotkeys';` and make the first statement of `onKeyDown` (line ~672):
  `if (shouldIgnoreHotkey(event)) return;`
  Also run `grep -n "addEventListener('key" src/render/Canvas.tsx`; add the same first-line guard to any other `keydown`/`keyup` handler it lists that reacts to game keys (camera pan etc.).
- `src/ui/ObjectivesPanel.tsx`: in its keydown handler, return early when `shouldIgnoreHotkey(event)` before the `Escape` check.

- [ ] **Step 4: Verify** — `npm test` (PASS). `npx tsc -b` errors remain only in `App.tsx` save code (slot API), fixed in Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hotkeys.ts src/ui/hotkeys.test.ts src/App.tsx src/render/Canvas.tsx src/ui/ObjectivesPanel.tsx
git commit -m "Ignore game hotkeys while typing or when a modal dialog is open"
```

---

### Task 7: SaveDialog overlay and App integration

**Files:**
- Create: `src/ui/SaveDialog.tsx`
- Modify: `src/App.tsx` (state ~line 52-53, `onSave`/`onLoad` ~lines 284-330, toolbar buttons ~lines 366-390, render root)

**Interfaces:**
- Consumes: Task 4 helpers (`CurrentSave`, `SaveEvent`, `nextCurrentSave`, `groupSaves`, `formatGameDate`, `formatSavedAt`, `validateSaveName`, `resumeSpeedAfterDialog`), Task 5 transport methods, `PixelText`.
- Produces: `SaveDialog` props `{ focus: 'save' | 'load'; currentSave: CurrentSave; onSaveEvent: (event: SaveEvent) => void; onClose: () => void }`.

- [ ] **Step 1: Create `src/ui/SaveDialog.tsx`**

```tsx
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  formatGameDate,
  formatSavedAt,
  groupSaves,
  MAX_SAVE_NAME_CHARS,
  validateSaveName,
  type CurrentSave,
  type SaveEvent,
} from '../state/saves';
import { transport } from '../state/transport';
import type { SaveInfo } from '../state/types';
import { PixelText } from './PixelText';

interface SaveDialogProps {
  focus: 'save' | 'load';
  currentSave: CurrentSave;
  onSaveEvent: (event: SaveEvent) => void;
  onClose: () => void;
}

type Pending =
  | { action: 'overwrite' }
  | { action: 'load' | 'delete'; save: SaveInfo }
  | null;

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function SaveDialog({ focus, currentSave, onSaveEvent, onClose }: SaveDialogProps) {
  const [saves, setSaves] = useState<SaveInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const now = Date.now();

  const refresh = async () => {
    try {
      setSaves(await transport.listSaves());
    } catch (cause) {
      setSaves([]);
      setError(message(cause));
    }
  };

  useEffect(() => {
    void refresh();
    if (focus === 'save') nameRef.current?.focus();
    else dialogRef.current?.focus();
    // Mount-only: focus and first fetch.
  }, []);

  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const saveAs = () =>
    run(async () => {
      const check = validateSaveName(draftName);
      if (!check.ok) throw new Error(check.error);
      onSaveEvent({ type: 'saved', info: await transport.saveGame(null, check.name) });
    });

  const overwriteCurrent = () =>
    run(async () => {
      if (!currentSave) return;
      onSaveEvent({ type: 'saved', info: await transport.saveGame(currentSave.id, currentSave.name) });
    });

  const load = (save: SaveInfo) =>
    run(async () => {
      await transport.loadGame(save.id);
      onSaveEvent({ type: 'loaded', info: save });
    });

  const remove = (save: SaveInfo) =>
    run(async () => {
      await transport.deleteSave(save.id);
      onSaveEvent({ type: 'deleted', id: save.id });
      await refresh();
    });

  const commitRename = () => {
    if (!renaming) return;
    const { id, draft } = renaming;
    void run(async () => {
      const check = validateSaveName(draft);
      if (!check.ok) throw new Error(check.error);
      onSaveEvent({ type: 'renamed', info: await transport.renameSave(id, check.name) });
      setRenaming(null);
      await refresh();
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation(); // keep Canvas's Esc (deselect) from also firing
    if (renaming) setRenaming(null);
    else if (pending) setPending(null);
    else if (!busy) onClose();
  };

  const groups = groupSaves(saves ?? []);

  const row = (save: SaveInfo) => {
    const confirming = pending && pending.action !== 'overwrite' && pending.save.id === save.id ? pending : null;
    const isRenaming = renaming?.id === save.id;
    return (
      <li key={save.id} className="border-b border-white/5 px-3 py-2" data-testid={`save-row-${save.id}`}>
        <div className="flex items-baseline gap-2">
          {isRenaming ? (
            <input
              autoFocus
              value={renaming.draft}
              maxLength={MAX_SAVE_NAME_CHARS * 2}
              onChange={(event) => setRenaming({ id: save.id, draft: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitRename();
              }}
              aria-label="New save name"
              className="pixel-focus min-w-0 flex-1 bg-black/40 px-1 text-white"
            />
          ) : (
            <span className={`min-w-0 flex-1 truncate ${currentSave?.id === save.id ? 'text-amber-200' : 'text-white'}`}>
              {save.name}
            </span>
          )}
          <span className="shrink-0 text-white/50">
            {formatGameDate(save)}
            {save.population != null && ` · pop ${save.population}`} · {formatSavedAt(save.savedAt, now)}
          </span>
        </div>
        <div className="mt-1 flex justify-end gap-1">
          {confirming ? (
            <>
              <span className="mr-auto text-amber-200">
                {confirming.action === 'load'
                  ? `Load "${save.name}"? Unsaved progress will be lost.`
                  : `Delete "${save.name}"?`}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void (confirming.action === 'load' ? load(save) : remove(save))}
                className="pixel-btn pixel-focus px-2 py-0.5"
              >
                <PixelText text="YES" />
              </button>
              <button type="button" disabled={busy} onClick={() => setPending(null)} className="pixel-btn pixel-focus px-2 py-0.5">
                <PixelText text="NO" />
              </button>
            </>
          ) : isRenaming ? (
            <>
              <button type="button" disabled={busy} onClick={commitRename} className="pixel-btn pixel-focus px-2 py-0.5">
                <PixelText text="OK" />
              </button>
              <button type="button" disabled={busy} onClick={() => setRenaming(null)} className="pixel-btn pixel-focus px-2 py-0.5">
                <PixelText text="CANCEL" />
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => setPending({ action: 'load', save })} className="pixel-btn pixel-focus px-2 py-0.5">
                <PixelText text="LOAD" />
              </button>
              {save.kind === 'manual' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRenaming({ id: save.id, draft: save.name })}
                  className="pixel-btn pixel-focus px-2 py-0.5"
                >
                  <PixelText text="RENAME" />
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => setPending({ action: 'delete', save })} className="pixel-btn pixel-focus px-2 py-0.5">
                <PixelText text="DELETE" />
              </button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-dialog-title"
        data-testid="save-dialog"
        onKeyDown={onKeyDown}
        className="pixel-panel flex max-h-[calc(100%-2rem)] w-[min(36rem,calc(100%-2rem))] flex-col text-xs text-white/80 outline-none"
      >
        <header className="flex shrink-0 items-center border-b border-white/10 px-3 py-2">
          <h2 id="save-dialog-title" className="text-[11px] text-white/60">
            <PixelText text="SAVES" />
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Close saves"
            className="pixel-btn pixel-focus ml-auto px-1.5 py-0.5"
          >
            <PixelText text="X" />
          </button>
        </header>

        <div className="shrink-0 space-y-2 border-b border-white/10 px-3 py-2">
          <p>
            Current: <span className="text-white">{currentSave ? currentSave.name : 'Unsaved village'}</span>
          </p>
          {pending?.action === 'overwrite' && currentSave ? (
            <div className="flex items-center gap-1">
              <span className="mr-auto text-amber-200">Overwrite "{currentSave.name}"?</span>
              <button type="button" disabled={busy} onClick={() => void overwriteCurrent()} className="pixel-btn pixel-focus px-2 py-0.5">
                <PixelText text="YES" />
              </button>
              <button type="button" disabled={busy} onClick={() => setPending(null)} className="pixel-btn pixel-focus px-2 py-0.5">
                <PixelText text="NO" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="save-current"
                disabled={busy || !currentSave}
                onClick={() => setPending({ action: 'overwrite' })}
                className="pixel-btn pixel-focus px-2 py-1 disabled:opacity-40"
              >
                <PixelText text="SAVE" />
              </button>
              <span className="text-white/50">
                {currentSave ? `overwrites "${currentSave.name}"` : 'name a new save below'}
              </span>
            </div>
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void saveAs();
            }}
          >
            <label htmlFor="save-as-name" className="shrink-0">
              Save as new:
            </label>
            <input
              id="save-as-name"
              ref={nameRef}
              value={draftName}
              maxLength={MAX_SAVE_NAME_CHARS * 2}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Village name"
              data-testid="save-as-name"
              className="pixel-focus min-w-0 flex-1 bg-black/40 px-1 py-0.5 text-white"
            />
            <button type="submit" disabled={busy} data-testid="save-as" className="pixel-btn pixel-focus px-2 py-1 disabled:opacity-40">
              <PixelText text="SAVE AS" />
            </button>
          </form>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {saves == null ? (
            <p className="px-3 py-2 text-white/50">Loading…</p>
          ) : saves.length === 0 ? (
            <p className="px-3 py-2 text-white/50">No saves yet.</p>
          ) : (
            <>
              <h3 className="px-3 pt-2 text-[10px] text-white/50">MY SAVES</h3>
              <ul>{groups.manual.map(row)}</ul>
              {groups.autosave.length > 0 && (
                <>
                  <h3 className="px-3 pt-2 text-[10px] text-white/50">AUTOSAVES</h3>
                  <ul>{groups.autosave.map(row)}</ul>
                </>
              )}
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="shrink-0 border-t-2 border-red-500/50 bg-red-950/90 px-3 py-2 text-red-100">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
```

`maxLength` is twice the limit so emoji-heavy names still reach validation, which reports the real error.

- [ ] **Step 2: Integrate into `src/App.tsx`**

1. Imports: `import { SaveDialog } from './ui/SaveDialog';` and `import { nextCurrentSave, resumeSpeedAfterDialog, type CurrentSave, type SaveEvent } from './state/saves';`
2. Replace the `persistenceBusy` and `persistenceStatus` state lines with:

```ts
  const [persistenceStatus, setPersistenceStatus] = useState('Not saved this session');
  const [saveDialog, setSaveDialog] = useState<'save' | 'load' | null>(null);
  const [currentSave, setCurrentSave] = useState<CurrentSave>(null);
  const resumeSpeedRef = useRef<number | null>(null);
```

3. Replace `onSave` and `onLoad` entirely with (keep the reset statements exactly as they were in `onLoad`):

```ts
  // Clears every piece of UI state that belonged to the previous world.
  const resetAfterWorldSwap = () => {
    setSelectedKind(null);
    setSelectedCrop(null);
    setSelectedBuildingId(null);
    setSelectedVillagerId(null);
    setVillagerDetail(null);
    rosterGenerationRef.current += 1;
    rosterInFlightRef.current = false;
    tagLabelsRef.current = new Map();
    setTagLabels(tagLabelsRef.current);
    setRoster(null);
    setRotation(0);
    setChronicle([]);
    setToasts([]);
    setFloaters([]);
    setWinterWarning(false);
    setCompletedObjectives([]);
    chronicleSeqRef.current = -1;
    toastSeqRef.current = -1;
    lastResourcesRef.current = null;
    chronicleRequestRef.current += 1; // invalidate any in-flight fetch from the old world
    setWorldKey((key) => key + 1);
  };

  const openSaveDialog = (focus: 'save' | 'load') => {
    if (saveDialog) return;
    const speed = clock?.speed ?? 0;
    resumeSpeedRef.current = resumeSpeedAfterDialog(speed);
    if (speed > 0) void onSetSpeed(0);
    setSaveDialog(focus);
  };

  const closeSaveDialog = () => {
    setSaveDialog(null);
    const speed = resumeSpeedRef.current;
    resumeSpeedRef.current = null;
    if (speed != null) void onSetSpeed(speed);
  };

  const onSaveEvent = (event: SaveEvent) => {
    setCurrentSave((current) => nextCurrentSave(current, event));
    if (event.type === 'saved') {
      setPersistenceStatus(`Saved · ${event.info.name}`);
      pushFloater(`Saved "${event.info.name}"`, '#f4c95d');
      closeSaveDialog();
    } else if (event.type === 'loaded') {
      resetAfterWorldSwap();
      setPersistenceStatus(`Loaded · ${event.info.name}`);
      pushFloater(`Loaded "${event.info.name}"`, '#b6f28a');
      closeSaveDialog();
    }
  };
```

Note: `resetAfterWorldSwap` runs after `setFloaters([])` is queued and the floater push comes after it, so the confirmation floater survives (React applies the queued updates in order).

4. Toolbar buttons: remove `disabled={persistenceBusy}` and the `disabled:cursor-wait` classes; set `onClick={() => openSaveDialog('save')}` on `save-game` and `onClick={() => openSaveDialog('load')}` on `load-game`. Keep `title={persistenceStatus}`.
5. Render the dialog as the last child inside the `relative flex min-h-0 flex-1` canvas wrapper (after `<FloatingText … />`):

```tsx
          {saveDialog && (
            <SaveDialog
              focus={saveDialog}
              currentSave={currentSave}
              onSaveEvent={onSaveEvent}
              onClose={closeSaveDialog}
            />
          )}
```

- [ ] **Step 3: Typecheck and build**

Run: `npm run build && npm test`
Expected: build succeeds, all Vitest tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/SaveDialog.tsx src/App.tsx
git commit -m "Add save manager overlay with named saves, rename, delete and inline confirms"
```

---

### Task 8: End-to-end verification and docs

**Files:**
- Modify: `progress.md` (add a save-manager entry in the existing style)
- Modify: `docs/superpowers/specs/2026-10-01-save-manager-design.md` only if behaviour diverged during implementation

- [ ] **Step 1: Full test suites**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --lib && npm test && npm run build`
Expected: all PASS, build succeeds.

- [ ] **Step 2: Browser smoke (demo transport)**

Run `npm run dev` and open `http://localhost:5173/` (not `?test=1`, so time runs). Check, in order:
1. Speed 2x → click SAVE → dialog opens, name field focused, clock stops; "Current: Unsaved village", SAVE disabled.
2. Type `frv` and press Backspace in the name field with a building selected → nothing happens in the game (no fullscreen, no rotate, no roster, no demolish).
3. SAVE AS "Riverbend" → dialog closes, floater "Saved "Riverbend"", speed back to 2x, button tooltip `Saved · Riverbend`.
4. Reopen via LOAD → Riverbend listed with date/pop; SAVE → "Overwrite…?" → YES → closes.
5. RENAME Riverbend → "Hilltop" → Current updates; DELETE → confirm → Current becomes "Unsaved village".
6. Pause, open dialog, Esc → stays paused.
7. Advance a day (`window.advanceTime` or wait) → AUTOSAVES section shows "Autosave N" with LOAD/DELETE only; loading it sets Current to "Unsaved village".

- [ ] **Step 3: Tauri smoke (if a display is available)**

`npm run tauri dev`: save, quit, relaunch, confirm the save is listed with its name; confirm old `slot-*.vsav` files (if any) appear under MY SAVES named `slot-1` etc. and load.

- [ ] **Step 4: Update `progress.md` and graph**

Add a short entry describing named saves, autosave file split, and the dialog. Run `graphify update .`.

- [ ] **Step 5: Commit**

```bash
git add progress.md graphify-out
git commit -m "Document save manager in progress notes"
```
