//! Catalog data model — mirrors `docs/backend-catalog.md` exactly, so a future
//! frontend can consume this API with zero changes (the same shape as the
//! local `catalog.json` snapshot).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone)]
pub struct CreatureStats {
    pub hp: u32,
    pub attack: u32,
    pub defense: u32,
    #[serde(rename = "spAtk")]
    pub sp_atk: u32,
    #[serde(rename = "spDef")]
    pub sp_def: u32,
    pub speed: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CreatureMove {
    pub name: String,
    pub level: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CreatureAbility {
    pub name: String,
    #[serde(rename = "isHidden")]
    pub is_hidden: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EvoStep {
    pub species: String,
    pub trigger: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Creature {
    pub id: u32,
    pub name: String,
    pub types: Vec<String>,
    pub stats: CreatureStats,
    #[serde(rename = "baseExperience")]
    pub base_experience: u32,
    #[serde(rename = "spriteUrl")]
    pub sprite_url: String,
    #[serde(rename = "artworkUrl")]
    pub artwork_url: String,
    pub moves: Vec<CreatureMove>,
    pub abilities: Vec<CreatureAbility>,
    pub flavor: Option<String>,
    #[serde(rename = "evolvesFrom")]
    pub evolves_from: Option<String>,
    #[serde(rename = "evolvesTo")]
    pub evolves_to: Vec<EvoStep>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MoveDef {
    pub name: String,
    #[serde(rename = "type")]
    pub element: String,
    pub category: String,
    pub power: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Zone {
    pub name: String,
    pub encounters: Vec<String>,
}

/// The whole catalog — one payload, exactly the contract shape.
#[derive(Serialize, Deserialize, Clone)]
pub struct Catalog {
    pub app: String,
    pub version: u32,
    #[serde(rename = "generatedAt")]
    pub generated_at: String,
    #[serde(rename = "maxGen")]
    pub max_gen: u32,
    pub creatures: HashMap<String, Creature>,
    pub moves: HashMap<String, MoveDef>,
    pub abilities: HashMap<String, String>,
    pub zones: HashMap<String, Zone>,
}
