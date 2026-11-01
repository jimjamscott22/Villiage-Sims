//! Named save files: `<id>.vsav` (persist byte format) + `<id>.meta.json` sidecar
//! holding the display name and summary. Listing never decodes `.vsav` payloads.

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::persist;
use crate::sim::world::World;

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
        population: Some(world.villagers.len() as u32),
    };
    write_meta(dir, id, &meta)?;
    Ok(SaveInfo::from_meta(id, meta))
}

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
