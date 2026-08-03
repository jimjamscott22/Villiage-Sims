use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use crate::sim::world::World;

const SAVE_MAGIC: [u8; 8] = *b"VILSAVE\0";
const HEADER_LEN: usize = SAVE_MAGIC.len() + size_of::<u32>() + size_of::<u64>();
const MAX_SAVE_BYTES: u64 = 64 * 1024 * 1024;
pub const SAVE_VERSION: u32 = 2;

fn config() -> impl bincode::config::Config {
    bincode::config::standard().with_limit::<{ MAX_SAVE_BYTES as usize }>()
}

pub(crate) fn encode_world(world: &World) -> Result<Vec<u8>, String> {
    let payload = bincode::serde::encode_to_vec(world, config())
        .map_err(|error| format!("could not encode save: {error}"))?;
    let total_len = HEADER_LEN
        .checked_add(payload.len())
        .ok_or_else(|| "save is too large".to_string())?;
    if total_len as u64 > MAX_SAVE_BYTES {
        return Err(format!(
            "save is too large ({total_len} bytes; maximum is {MAX_SAVE_BYTES})"
        ));
    }

    let mut bytes = Vec::with_capacity(total_len);
    bytes.extend_from_slice(&SAVE_MAGIC);
    bytes.extend_from_slice(&SAVE_VERSION.to_le_bytes());
    bytes.extend_from_slice(&world.seed().to_le_bytes());
    bytes.extend_from_slice(&payload);
    Ok(bytes)
}

pub(crate) fn decode_world(bytes: &[u8]) -> Result<World, String> {
    if bytes.len() < HEADER_LEN {
        return Err("save is truncated".into());
    }
    if bytes.len() as u64 > MAX_SAVE_BYTES {
        return Err(format!(
            "save is too large ({} bytes; maximum is {MAX_SAVE_BYTES})",
            bytes.len()
        ));
    }
    if bytes[..SAVE_MAGIC.len()] != SAVE_MAGIC {
        return Err("file is not a VillageSim save".into());
    }

    let version_offset = SAVE_MAGIC.len();
    let seed_offset = version_offset + size_of::<u32>();
    let version = u32::from_le_bytes(
        bytes[version_offset..seed_offset]
            .try_into()
            .expect("fixed save version header"),
    );
    if version != SAVE_VERSION {
        return Err(format!(
            "unsupported save version {version} (expected {SAVE_VERSION})"
        ));
    }
    let payload_offset = seed_offset + size_of::<u64>();
    let header_seed = u64::from_le_bytes(
        bytes[seed_offset..payload_offset]
            .try_into()
            .expect("fixed save seed header"),
    );
    let payload = &bytes[payload_offset..];
    let (mut world, consumed): (World, usize) =
        bincode::serde::decode_from_slice(payload, config())
            .map_err(|error| format!("could not decode save: {error}"))?;
    if consumed != payload.len() {
        return Err("save contains trailing data".into());
    }
    if world.seed() != header_seed {
        return Err("save header seed does not match the world".into());
    }
    world.prepare_after_load()?;
    Ok(world)
}

pub(crate) fn save_world(world: &World, path: &Path) -> Result<(), String> {
    let bytes = encode_world(world)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("could not create save directory: {error}"))?;
    }
    let temporary = temporary_path(path);
    let result = write_and_replace(path, &temporary, &bytes);
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

pub(crate) fn load_world(path: &Path) -> Result<World, String> {
    let mut file = File::open(path)
        .map_err(|error| format!("could not open save '{}': {error}", path.display()))?;
    let length = file
        .metadata()
        .map_err(|error| format!("could not inspect save '{}': {error}", path.display()))?
        .len();
    if length > MAX_SAVE_BYTES {
        return Err(format!(
            "save is too large ({length} bytes; maximum is {MAX_SAVE_BYTES})"
        ));
    }
    let mut bytes = Vec::with_capacity(length as usize);
    file.read_to_end(&mut bytes)
        .map_err(|error| format!("could not read save '{}': {error}", path.display()))?;
    decode_world(&bytes)
}

fn temporary_path(path: &Path) -> PathBuf {
    let mut name = path
        .file_name()
        .map(|name| name.to_os_string())
        .unwrap_or_else(|| "save".into());
    name.push(".tmp");
    path.with_file_name(name)
}

fn write_and_replace(path: &Path, temporary: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = File::create(temporary).map_err(|error| {
        format!(
            "could not create temporary save '{}': {error}",
            temporary.display()
        )
    })?;
    file.write_all(bytes)
        .map_err(|error| format!("could not write save '{}': {error}", temporary.display()))?;
    file.sync_all()
        .map_err(|error| format!("could not flush save '{}': {error}", temporary.display()))?;
    drop(file);

    fs::rename(temporary, path)
        .or_else(|rename_error| {
            if !path.exists() {
                return Err(rename_error);
            }
            fs::remove_file(path)?;
            fs::rename(temporary, path)
        })
        .map_err(|error| format!("could not replace save '{}': {error}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_save_path(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "villagesim-{label}-{}-{nonce}.vsav",
            std::process::id()
        ))
    }

    #[test]
    fn save_round_trip_is_byte_identical_and_continues() {
        let mut original = World::generate(24, 24, 32, 9);
        for _ in 0..137 {
            original.advance();
        }
        let first = encode_world(&original).expect("encode original");
        let mut loaded = decode_world(&first).expect("decode save");
        let second = encode_world(&loaded).expect("encode loaded");
        assert_eq!(first, second);

        original.advance();
        loaded.advance();
        assert_eq!(
            encode_world(&original).expect("encode continued original"),
            encode_world(&loaded).expect("encode continued loaded")
        );
    }

    #[test]
    fn rejects_unknown_version_before_decoding() {
        let mut bytes = encode_world(&World::generate(8, 8, 32, 4)).expect("encode world");
        bytes[SAVE_MAGIC.len()..SAVE_MAGIC.len() + size_of::<u32>()]
            .copy_from_slice(&99u32.to_le_bytes());
        let error = decode_world(&bytes).expect_err("version must be rejected");
        assert_eq!(error, "unsupported save version 99 (expected 2)");
    }

    #[test]
    fn file_save_load_replaces_existing_slot() {
        let path = temp_save_path("replace");
        let mut world = World::generate(12, 12, 32, 7);
        save_world(&world, &path).expect("first save");
        world.advance();
        save_world(&world, &path).expect("replacement save");

        let loaded = load_world(&path).expect("load replacement");
        assert_eq!(
            encode_world(&loaded).expect("encode loaded"),
            encode_world(&world).expect("encode world")
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn chronicle_survives_a_round_trip() {
        let mut world = World::generate(16, 16, 32, 21);
        world.advance_clock(28, None).expect("advance a season");

        // Capture the chronicle state before encoding
        let expected_entries = world.chronicle().to_vec();
        assert!(!expected_entries.is_empty(), "test needs at least one chronicle entry");
        let expected_seq = world.chronicle().seq();

        // Round-trip through encode/decode
        let bytes = encode_world(&world).expect("encode");
        let restored = decode_world(&bytes).expect("decode");

        // Verify chronicle survived
        assert_eq!(restored.chronicle().to_vec(), expected_entries, "chronicle entries should match");
        assert_eq!(restored.chronicle().seq(), expected_seq, "chronicle seq should match");
    }

    #[test]
    fn unlocked_set_survives_a_round_trip() {
        let world = World::generate(16, 16, 32, 23);
        let bytes = encode_world(&world).expect("encode");
        let restored = decode_world(&bytes).expect("decode");
        assert_eq!(restored.unlocked(), world.unlocked());
    }

}
