use noise::{Fbm, MultiFractal, NoiseFn, Perlin};

/// Terrain kinds stored as bytes in the tile grid. Matches `docs/villagesim-spec.md`.
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Terrain {
    DeepWater = 0,
    ShallowWater = 1,
    Sand = 2,
    Grass = 3,
    Forest = 4,
    Rock = 5,
    Mountain = 6,
}

impl Terrain {
    #[cfg(test)]
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::DeepWater),
            1 => Some(Self::ShallowWater),
            2 => Some(Self::Sand),
            3 => Some(Self::Grass),
            4 => Some(Self::Forest),
            5 => Some(Self::Rock),
            6 => Some(Self::Mountain),
            _ => None,
        }
    }
}

const ELEVATION_FREQUENCY: f64 = 0.03;
const MOISTURE_FREQUENCY: f64 = 0.03;
const OCTAVES: usize = 4;
const MOISTURE_SEED_OFFSET: u32 = 0x9E37_79B9;

/// Generate a seeded island heightmap as terrain bytes (row-major).
pub fn generate_terrain(width: u32, height: u32, seed: u64) -> Vec<u8> {
    let elevation = Fbm::<Perlin>::new(seed as u32)
        .set_octaves(OCTAVES)
        .set_frequency(ELEVATION_FREQUENCY);
    let moisture = Fbm::<Perlin>::new(seed.wrapping_add(u64::from(MOISTURE_SEED_OFFSET)) as u32)
        .set_octaves(OCTAVES)
        .set_frequency(MOISTURE_FREQUENCY);

    let width_f = f64::from(width);
    let height_f = f64::from(height);
    let center_x = (width_f - 1.0) * 0.5;
    let center_y = (height_f - 1.0) * 0.5;
    // Normalize radius so corners sit near the ocean rim.
    let max_radius = (center_x.hypot(center_y)).max(1.0);

    let mut tiles = Vec::with_capacity((width * height) as usize);
    for y in 0..height {
        for x in 0..width {
            let nx = f64::from(x);
            let ny = f64::from(y);
            // noise crate returns roughly [-1, 1]; remap to [0, 1].
            let raw_elev = (elevation.get([nx, ny]) + 1.0) * 0.5;
            let raw_moist = (moisture.get([nx, ny]) + 1.0) * 0.5;

            let dx = (nx - center_x) / max_radius;
            let dy = (ny - center_y) / max_radius;
            let dist = (dx * dx + dy * dy).sqrt().clamp(0.0, 1.0);
            // Strong radial mask: ocean at the rim, contiguous landmass in the center.
            let mask = (1.0 - dist).max(0.0).powf(1.35);
            let elev = (raw_elev * 0.55 + 0.45) * mask;

            tiles.push(classify(elev, raw_moist) as u8);
        }
    }
    tiles
}

fn classify(elev: f64, moisture: f64) -> Terrain {
    if elev < 0.28 {
        Terrain::DeepWater
    } else if elev < 0.34 {
        Terrain::ShallowWater
    } else if elev < 0.40 {
        Terrain::Sand
    } else if elev < 0.62 {
        if moisture > 0.55 {
            Terrain::Forest
        } else {
            Terrain::Grass
        }
    } else if elev < 0.78 {
        Terrain::Rock
    } else {
        Terrain::Mountain
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn same_seed_is_reproducible() {
        let a = generate_terrain(48, 48, 42);
        let b = generate_terrain(48, 48, 42);
        assert_eq!(a, b);
    }

    #[test]
    fn different_seeds_diverge() {
        let a = generate_terrain(48, 48, 42);
        let b = generate_terrain(48, 48, 43);
        assert_ne!(a, b);
    }

    #[test]
    fn island_contains_water_land_and_highlands() {
        let tiles = generate_terrain(128, 128, 42);
        let kinds: HashSet<u8> = tiles.iter().copied().collect();

        assert!(
            kinds.iter().any(|&k| {
                matches!(
                    Terrain::from_u8(k),
                    Some(Terrain::DeepWater | Terrain::ShallowWater)
                )
            }),
            "expected water tiles, got {kinds:?}"
        );
        assert!(
            kinds.iter().any(|&k| {
                matches!(
                    Terrain::from_u8(k),
                    Some(Terrain::Grass | Terrain::Forest | Terrain::Sand)
                )
            }),
            "expected land tiles, got {kinds:?}"
        );
        assert!(
            kinds.iter().any(|&k| {
                matches!(Terrain::from_u8(k), Some(Terrain::Rock | Terrain::Mountain))
            }),
            "expected highland tiles, got {kinds:?}"
        );
        assert!(
            kinds.contains(&(Terrain::Sand as u8)),
            "expected sand coastline, got {kinds:?}"
        );
    }

    #[test]
    fn classify_thresholds_are_stable() {
        assert_eq!(classify(0.10, 0.9), Terrain::DeepWater);
        assert_eq!(classify(0.30, 0.1), Terrain::ShallowWater);
        assert_eq!(classify(0.37, 0.1), Terrain::Sand);
        assert_eq!(classify(0.50, 0.2), Terrain::Grass);
        assert_eq!(classify(0.50, 0.8), Terrain::Forest);
        assert_eq!(classify(0.70, 0.5), Terrain::Rock);
        assert_eq!(classify(0.90, 0.5), Terrain::Mountain);
    }
}
