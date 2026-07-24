//! Building inventories, capacity, haul tasks, and resource withdraw/deposit (Milestone 8).

use std::collections::BTreeMap;

use super::catalog::{BuildingDef, Catalog, RecipeDef};
use super::resources::ResourceTotals;

/// Max total units in a production building buffer.
pub const PRODUCTION_BUFFER_CAP: u32 = 30;
/// Max units a villager carries per haul trip.
pub const CARRY_STACK_MAX: u32 = 5;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HaulEndpoint {
    Stockpile,
    Building(u32),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HaulTask {
    pub resource: String,
    pub amount: u32,
    pub from: HaulEndpoint,
    pub to: HaulEndpoint,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CarryStack {
    pub resource: String,
    pub amount: u32,
    pub dest: HaulEndpoint,
}

pub fn inventory_total(inv: &BTreeMap<String, u32>) -> u32 {
    inv.values().sum()
}

pub fn inventory_get(inv: &BTreeMap<String, u32>, key: &str) -> u32 {
    inv.get(key).copied().unwrap_or(0)
}

pub fn inventory_add(inv: &mut BTreeMap<String, u32>, key: &str, amount: u32) {
    if amount == 0 {
        return;
    }
    let entry = inv.entry(key.to_string()).or_insert(0);
    *entry = entry.saturating_add(amount);
}

pub fn inventory_take(inv: &mut BTreeMap<String, u32>, key: &str, amount: u32) -> u32 {
    let Some(entry) = inv.get_mut(key) else {
        return 0;
    };
    let taken = (*entry).min(amount);
    *entry -= taken;
    if *entry == 0 {
        inv.remove(key);
    }
    taken
}

pub fn storage_accepts(def: &BuildingDef, resource: &str) -> bool {
    def.category == "storage"
        && def
            .stores
            .as_ref()
            .is_some_and(|stores| stores.iter().any(|s| s == resource))
}

pub fn storage_free_capacity(def: &BuildingDef, inv: &BTreeMap<String, u32>) -> u32 {
    let cap = def.capacity.unwrap_or(0);
    cap.saturating_sub(inventory_total(inv))
}

pub fn production_free_capacity(inv: &BTreeMap<String, u32>) -> u32 {
    PRODUCTION_BUFFER_CAP.saturating_sub(inventory_total(inv))
}

pub fn recipe_allows_resource(recipe: &RecipeDef, resource: &str) -> bool {
    recipe.inputs.contains_key(resource) || recipe.outputs.contains_key(resource)
}

/// Sum stockpile + storage-building inventories for the ResourceBar snapshot.
pub fn derive_totals(
    stockpile: &ResourceTotals,
    buildings: &[(u32, u8, &BTreeMap<String, u32>)],
    catalog: &Catalog,
) -> ResourceTotals {
    let mut totals = stockpile.clone();
    for (_id, kind_index, inv) in buildings {
        let Some(def) = catalog.get(*kind_index) else {
            continue;
        };
        if def.category != "storage" {
            continue;
        }
        let Some(stores) = &def.stores else {
            continue;
        };
        for key in stores {
            let amount = inventory_get(inv, key);
            if amount > 0 {
                totals.set(key, totals.get(key).saturating_add(amount));
            }
        }
    }
    totals
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sim::catalog::Catalog;

    #[test]
    fn derive_totals_ignores_production_buffers() {
        let catalog = Catalog::load_builtin().unwrap();
        let mut stockpile = ResourceTotals::starting();
        stockpile.grain = 0;
        stockpile.food = 10;
        let mut farm_inv = BTreeMap::new();
        inventory_add(&mut farm_inv, "grain", 9);
        let mut granary_inv = BTreeMap::new();
        inventory_add(&mut granary_inv, "grain", 4);
        let farm_kind = catalog.find("farm").unwrap().0;
        let granary_kind = catalog.find("granary").unwrap().0;
        let totals = derive_totals(
            &stockpile,
            &[(1, farm_kind, &farm_inv), (2, granary_kind, &granary_inv)],
            &catalog,
        );
        assert_eq!(totals.grain, 4);
        assert_eq!(totals.food, 10);
        assert_eq!(totals.flour, 0);
    }
}
