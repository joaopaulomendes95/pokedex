//! SQLite persistence: players (accounts) + per-player key-value saves.
//!
//! The save keys mirror the frontend's localStorage keys (poke-league-save,
//! poke-league-missions, …) so the game's state can move server-side with
//! minimal frontend changes: GET /save returns the whole map, PUT /save/{key}
//! upserts one key.

use rusqlite::{params, Connection};
use std::sync::Mutex;

pub type Db = Mutex<Connection>;

/// Open (or create) the database and ensure the schema exists.
pub fn init_db(path: &str) -> rusqlite::Result<Db> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         CREATE TABLE IF NOT EXISTS players (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             username TEXT NOT NULL UNIQUE,
             password_hash TEXT NOT NULL,
             created_at INTEGER NOT NULL
         );
         CREATE TABLE IF NOT EXISTS saves (
             player_id INTEGER NOT NULL,
             key TEXT NOT NULL,
             data TEXT NOT NULL,
             updated_at INTEGER NOT NULL,
             PRIMARY KEY (player_id, key),
             FOREIGN KEY (player_id) REFERENCES players(id)
         );",
    )?;
    Ok(Mutex::new(conn))
}

pub fn create_player(db: &Connection, username: &str, hash: &str) -> rusqlite::Result<i64> {
    db.execute(
        "INSERT INTO players (username, password_hash, created_at) VALUES (?1, ?2, ?3)",
        params![username, hash, now_secs()],
    )?;
    Ok(db.last_insert_rowid())
}

pub fn password_hash_for(db: &Connection, username: &str) -> rusqlite::Result<Option<(i64, String)>> {
    let mut stmt = db
        .prepare("SELECT id, password_hash FROM players WHERE username = ?1")
        .unwrap();
    let mut rows = stmt.query(params![username]).unwrap();
    if let Some(row) = rows.next()? {
        Ok(Some((row.get(0)?, row.get(1)?)))
    } else {
        Ok(None)
    }
}

/// All save keys for a player (the whole localStorage-equivalent map).
pub fn load_save(db: &Connection, player_id: i64) -> rusqlite::Result<Vec<(String, String)>> {
    let mut stmt = db
        .prepare("SELECT key, data FROM saves WHERE player_id = ?1")
        .unwrap();
    let rows = stmt.query_map(params![player_id], |row| Ok((row.get(0)?, row.get(1)?)))?;
    rows.collect()
}

pub fn upsert_save(db: &Connection, player_id: i64, key: &str, data: &str) -> rusqlite::Result<()> {
    db.execute(
        "INSERT INTO saves (player_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(player_id, key) DO UPDATE SET data = ?3, updated_at = ?4",
        params![player_id, key, data, now_secs()],
    )?;
    Ok(())
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
