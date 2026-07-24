//! Resource nodes on forest/rock tiles (Milestone 8).

use super::terrain::Terrain;

pub const NODE_REGEN_TICKS: u32 = 200;
pub const FOREST_NODE_MAX: u32 = 5;
pub const ROCK_NODE_MAX: u32 = 4;
pub const MAX_GATHER_JOBS: usize = 6;
pub const GATHER_PRIORITY: u8 = 8;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ResourceNode {
    pub tile: (i32, i32),
    pub resource: &'static str,
    pub amount: u32,
    pub max: u32,
    pub regen_acc: u32,
}

impl ResourceNode {
    pub fn forest(tile: (i32, i32)) -> Self {
        Self {
            tile,
            resource: "wood",
            amount: FOREST_NODE_MAX,
            max: FOREST_NODE_MAX,
            regen_acc: 0,
        }
    }

    pub fn rock(tile: (i32, i32)) -> Self {
        Self {
            tile,
            resource: "stone",
            amount: ROCK_NODE_MAX,
            max: ROCK_NODE_MAX,
            regen_acc: 0,
        }
    }

    pub fn tick_regen(&mut self) {
        if self.amount >= self.max {
            self.regen_acc = 0;
            return;
        }
        self.regen_acc = self.regen_acc.saturating_add(1);
        if self.regen_acc >= NODE_REGEN_TICKS {
            self.regen_acc = 0;
            self.amount = self.amount.saturating_add(1).min(self.max);
        }
    }

    pub fn harvest_one(&mut self) -> Option<&'static str> {
        if self.amount == 0 {
            return None;
        }
        self.amount -= 1;
        Some(self.resource)
    }
}

pub fn generate_nodes(width: u32, height: u32, tiles: &[u8]) -> Vec<ResourceNode> {
    let mut nodes = Vec::new();
    for y in 0..height as i32 {
        for x in 0..width as i32 {
            let index = (y as u32 * width + x as u32) as usize;
            let Some(&byte) = tiles.get(index) else {
                continue;
            };
            match Terrain::from_u8(byte) {
                Some(Terrain::Forest) => nodes.push(ResourceNode::forest((x, y))),
                Some(Terrain::Rock) => nodes.push(ResourceNode::rock((x, y))),
                _ => {}
            }
        }
    }
    nodes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn harvest_and_regen() {
        let mut node = ResourceNode::forest((1, 1));
        assert_eq!(node.harvest_one(), Some("wood"));
        assert_eq!(node.amount, FOREST_NODE_MAX - 1);
        for _ in 0..NODE_REGEN_TICKS {
            node.tick_regen();
        }
        assert_eq!(node.amount, FOREST_NODE_MAX);
    }
}
