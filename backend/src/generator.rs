//! Procedural original-creature generator (see docs/backend-catalog.md §3).
//!
//! Fully deterministic: the same inputs always produce the same catalog, so
//! balance and tests stay stable. No external data — every name, stat,
//! evolution chain and flavor line is synthesized here, making the game
//! completely independent of any copyrighted creature set.

use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};

use crate::models::{
    Catalog, Creature, CreatureAbility, CreatureMove, CreatureStats, EvoStep, MoveDef, Zone,
};

/// Elements in play (a curated subset — the "type chart" of the original set).
pub const ELEMENTS: &[&str] = &[
    "fire", "water", "grass", "electric", "rock", "ice", "dark", "light",
];

/// Syllable pools — combine prefix + suffix for original names.
const NAME_PRE: &[&str] = &[
    "fra", "spr", "bram", "vol", "glim", "kel", "ash", "lun", "tar", "zeph", "cry", "mor", "nyx",
    "sol", "fer", "vap", "qua", "rhy", "shad", "aur", "ember", "ver", "myr", "ond", "skir", "thun",
    "fros", "bram", "silt", "mag", "ign", "terr", "aqu", "verr", "luma", "nox",
];
const NAME_SUF: &[&str] = &[
    "xel", "let", "burn", "tide", "ri", "thar", "gale", "pex", "une", "ra", "lyn", "dor", "ith",
    "ock", "ara", "une", "ik", "ael", "yx", "orn", "wisp", "fang", "horn", "claw", "maw", "wing",
    "shell", "spark", "stone", "petal", "surge", "haze",
];

/// Stat archetypes (hp, atk, def, spA, spD, spe) — spread budgets.
const ARCHETYPES: &[[u32; 6]] = &[
    [60, 55, 55, 50, 50, 55], // balanced
    [85, 45, 75, 40, 70, 35], // tank
    [55, 75, 40, 70, 40, 60], // sweeper
    [50, 50, 40, 45, 45, 85], // fast
];

/// Element → stat bias (+10 to the highlighted stat, −10 elsewhere).
fn element_bias(element: &str) -> [i32; 6] {
    match element {
        "fire" => [0, 10, -5, 10, -5, 0],
        "water" => [10, 0, 5, 0, 5, -5],
        "grass" => [5, 0, 5, 5, 0, -5],
        "electric" => [0, 0, -5, 5, -5, 10],
        "rock" => [5, 5, 10, -5, 5, -10],
        "ice" => [5, 0, 0, 10, 5, -10],
        "dark" => [0, 10, 0, 0, 0, 5],
        "light" => [5, 0, 0, 10, 10, -5],
        _ => [0, 0, 0, 0, 0, 0],
    }
}

/// A few per-element moves with power bands (40/55/75/95/120).
fn move_table() -> Vec<MoveDef> {
    let mut moves = Vec::new();
    let base: &[(&str, &[(&str, u32)])] = &[
        ("fire", &[("scorch", 40), ("flameburst", 55), ("inferno", 75), ("sunfury", 95), ("novaflare", 120)]),
        ("water", &[("drench", 40), ("tidepush", 55), ("riptide", 75), ("deluge", 95), ("abysswell", 120)]),
        ("grass", &[("sprout", 40), ("vinewhip", 55), ("thornstorm", 75), ("bloomrage", 95), ("verdantfury", 120)]),
        ("electric", &[("jolt", 40), ("sparkburst", 55), ("voltarc", 75), ("stormsurge", 95), ("thunderfury", 120)]),
        ("rock", &[("pebble", 40), ("stonebash", 55), ("boulderslam", 75), ("landslide", 95), ("quakecall", 120)]),
        ("ice", &[("chill", 40), ("frostbite", 55), ("glacier", 75), ("blizzard", 95), ("eternalwinter", 120)]),
        ("dark", &[("sneak", 40), ("shadowclaw", 55), ("duskslash", 75), ("nightveil", 95), ("abyssglare", 120)]),
        ("light", &[("gleam", 40), ("sunray", 55), ("dazzle", 75), ("radiance", 95), ("daybreak", 120)]),
    ];
    for (element, moves_of) in base {
        for (i, (name, power)) in moves_of.iter().enumerate() {
            moves.push(MoveDef {
                name: name.to_string(),
                element: element.to_string(),
                category: if i % 2 == 0 { "physical" } else { "special" }.to_string(),
                power: *power,
            });
        }
    }
    moves
}

/// Curated ability texts (generic — no creature-specific lore).
fn ability_table() -> Vec<(String, String)> {
    vec![
        ("emberheart".into(), "Powers up Fire-type moves when weakened.".into()),
        ("tidecaller".into(), "Restores a little HP at the end of each fight.".into()),
        ("thornhide".into(), "Contact moves deal a bit of damage back.".into()),
        ("staticfield".into(), "May briefly paralyze the attacker.".into()),
        ("stonyframe".into(), "Raises Defense when HP drops below half.".into()),
        ("frostmantle".into(), "Slows foes that make contact.".into()),
        ("nightcloak".into(), "Evades an attack every now and then.".into()),
        ("lightveil".into(), "Boosts the next hit after switching in.".into()),
        ("swiftblood".into(), "Acts first on the opening turn.".into()),
        ("deepfocus".into(), "Special moves hit harder in long battles.".into()),
    ]
}

/// A tiny deterministic RNG keyed by the creature id.
fn rng_for(id: u32) -> StdRng {
    StdRng::seed_from_u64((id as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15))
}

/// Make a creature name from the affix pools (unique via the used set).
fn make_name(rng: &mut StdRng, used: &mut Vec<String>) -> String {
    let mut attempt = 0;
    loop {
        let pre = NAME_PRE[rng.gen_range(0..NAME_PRE.len())];
        let suf = NAME_SUF[rng.gen_range(0..NAME_SUF.len())];
        let name = format!("{pre}{suf}");
        if !used.contains(&name) || attempt > 20 {
            used.push(name.clone());
            return name;
        }
        attempt += 1;
    }
}

/// Roll a primary element for a creature (stable by id).
fn element_for(id: u32) -> &'static str {
    let mut rng = rng_for(id);
    ELEMENTS[rng.gen_range(0..ELEMENTS.len())]
}

/// Build the full original catalog.
pub fn generate_catalog(count: u32, max_gen: u32) -> Catalog {
    let moves = move_table();
    let move_map: std::collections::HashMap<String, MoveDef> = moves
        .iter()
        .cloned()
        .map(|m| (m.name.clone(), m))
        .collect();
    let abilities = ability_table();
    let ability_map: std::collections::HashMap<String, String> =
        abilities.iter().cloned().collect();

    let mut creatures: std::collections::HashMap<String, Creature> = Default::default();
    let mut used_names: Vec<String> = Vec::new();
    let mut id = 1u32;

    // Groups of 3 (base → mid → final); every 4th group is single-stage (apex).
    while id <= count {
        let is_single = id % 12 >= 9; // ids 9,10,11 / 21,22,23 → apex groups
        let (base, mid, final_name) = if is_single {
            (None, None, None)
        } else {
            let b = make_name(&mut rng_for(id), &mut used_names);
            let m = make_name(&mut rng_for(id + 1), &mut used_names);
            let f = make_name(&mut rng_for(id + 2), &mut used_names);
            (Some(b), Some(m), Some(f))
        };

        for slot in 0..3 {
            if id > count {
                break;
            }
            let this_id = id;
            let element = element_for(this_id);
            let mut rng = rng_for(this_id);

            let archetype = ARCHETYPES[rng.gen_range(0..ARCHETYPES.len())];
            let bias = element_bias(element);
            let stats_vec: Vec<u32> = archetype
                .iter()
                .zip(bias.iter())
                .map(|(a, b)| ((*a as i32 + b).max(1)) as u32)
                .collect();
            let stats = CreatureStats {
                hp: stats_vec[0],
                attack: stats_vec[1],
                defense: stats_vec[2],
                sp_atk: stats_vec[3],
                sp_def: stats_vec[4],
                speed: stats_vec[5],
            };
            let total: u32 = stats_vec.iter().sum();
            // Rarity pyramid by id hash (45% common / 30% uncommon / 15% rare /
            // 8% epic / 2% legendary), each tier mapped onto the frontend's
            // rarity bands (common <70, uncommon <110, rare <160, epic <220,
            // legendary >=220) so the summon portal gets a natural pool.
            let roll = this_id % 100;
            let (lo, hi) = if roll < 45 {
                (0.5, 0.62)
            } else if roll < 75 {
                (0.68, 0.98)
            } else if roll < 90 {
                (1.0, 1.45)
            } else if roll < 98 {
                (1.5, 2.0)
            } else {
                (2.1, 2.6)
            };
            let t = (this_id % 7) as f32 / 6.0;
            let quality = lo + (hi - lo) * t;
            let base_exp = (((total as f32 / 3.0) * quality) as u32).max(20);

            // Evolution wiring.
            let (name, evolves_from, evolves_to) = match slot {
                0 if !is_single => (
                    base.clone().unwrap(),
                    None,
                    vec![EvoStep {
                        species: mid.clone().unwrap(),
                        trigger: "level 16".into(),
                    }],
                ),
                1 if !is_single => (
                    mid.clone().unwrap(),
                    base.clone(),
                    vec![EvoStep {
                        species: final_name.clone().unwrap(),
                        trigger: "level 36".into(),
                    }],
                ),
                2 if !is_single => (final_name.clone().unwrap(), mid.clone(), vec![]),
                _ => {
                    let n = make_name(&mut rng, &mut used_names);
                    (n, None, vec![])
                }
            };

            // Moves: this creature's element's move list, spread by level.
            let element_moves: Vec<&MoveDef> = moves.iter().filter(|m| m.element == element).collect();
            let levels = [1u32, 8, 16, 26, 38, 50];
            let creature_moves: Vec<CreatureMove> = element_moves
                .iter()
                .take(levels.len())
                .enumerate()
                .map(|(i, m)| CreatureMove {
                    name: m.name.clone(),
                    level: levels[i],
                })
                .collect();

            // Abilities: 1-2 by hash.
            let mut abilities_for = vec![CreatureAbility {
                name: abilities[rng.gen_range(0..abilities.len())].0.clone(),
                is_hidden: false,
            }];
            if rng.gen_bool(0.3) {
                abilities_for.push(CreatureAbility {
                    name: abilities[rng.gen_range(0..abilities.len())].0.clone(),
                    is_hidden: true,
                });
            }

            let flavor = format!(
                "A {element} spirit said to wander the {habitat}.",
                habitat = match element {
                    "fire" => "ember heaths",
                    "water" => "tide shallows",
                    "grass" => "briar glades",
                    "electric" => "storm peaks",
                    "rock" => "crag passes",
                    "ice" => "frost basins",
                    "dark" => "moonless woods",
                    _ => "luminous plains",
                }
            );

            let gen = 1 + (this_id - 1) / (count / max_gen).max(1);
            let sprite = format!("/sprites/{this_id}.png");
            let second = if rng.gen_bool(0.12) {
                let e = ELEMENTS[rng.gen_range(0..ELEMENTS.len())];
                if e == element {
                    vec![]
                } else {
                    vec![e.to_string()]
                }
            } else {
                vec![]
            };
            let mut types = vec![element.to_string()];
            types.extend(second);
            creatures.insert(
                name.clone(),
                Creature {
                    id: this_id,
                    name,
                    types,
                    stats,
                    base_experience: base_exp,
                    sprite_url: sprite.clone(),
                    artwork_url: sprite,
                    moves: creature_moves,
                    abilities: abilities_for,
                    flavor: Some(flavor),
                    evolves_from,
                    evolves_to,
                },
            );
            let _ = gen; // max_gen drives paging; ids stay contiguous for now
            id += 1;
        }
    }

    // Zones: a habitat per element, gathering that element's monsters.
    let mut zones = std::collections::HashMap::new();
    for element in ELEMENTS {
        let encounters: Vec<String> = creatures
            .values()
            .filter(|c| c.types[0] == *element)
            .map(|c| c.name.clone())
            .collect();
        zones.insert(
            format!("https://api.example.com/zones/{element}"),
            Zone {
                name: format!("{element}-habitat"),
                encounters,
            },
        );
    }

    Catalog {
        app: "poke-liga-catalog".into(),
        version: 1,
        generated_at: String::new(), // set at serve time
        max_gen,
        creatures,
        moves: move_map,
        abilities: ability_map,
        zones,
    }
}
