use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceTotals {
    pub wood: u32,
    pub stone: u32,
    pub grain: u32,
    pub food: u32,
    pub gold: u32,
}

impl ResourceTotals {
    pub fn starting() -> Self {
        Self {
            wood: 120,
            stone: 40,
            grain: 0,
            food: 50,
            gold: 0,
        }
    }

    pub fn get(&self, key: &str) -> u32 {
        match key {
            "wood" => self.wood,
            "stone" => self.stone,
            "grain" => self.grain,
            "food" => self.food,
            "gold" => self.gold,
            _ => 0,
        }
    }

    pub fn set(&mut self, key: &str, value: u32) {
        match key {
            "wood" => self.wood = value,
            "stone" => self.stone = value,
            "grain" => self.grain = value,
            "food" => self.food = value,
            "gold" => self.gold = value,
            _ => {}
        }
    }

    pub fn can_afford(&self, cost: &BTreeMap<String, u32>) -> bool {
        cost.iter().all(|(key, amount)| self.get(key) >= *amount)
    }

    pub fn spend(&mut self, cost: &BTreeMap<String, u32>) -> Result<(), String> {
        if !self.can_afford(cost) {
            return Err("insufficient resources".into());
        }
        for (key, amount) in cost {
            self.set(key, self.get(key) - amount);
        }
        Ok(())
    }

    pub fn refund(&mut self, cost: &BTreeMap<String, u32>) {
        for (key, amount) in cost {
            self.set(key, self.get(key).saturating_add(*amount));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spend_and_refund_round_trip() {
        let mut resources = ResourceTotals::starting();
        let cost = BTreeMap::from([("wood".into(), 20u32)]);
        resources.spend(&cost).unwrap();
        assert_eq!(resources.wood, 100);
        resources.refund(&cost);
        assert_eq!(resources.wood, 120);
    }
}
