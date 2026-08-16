//! Poke-Liga backend — serves the catalog contract (docs/backend-catalog.md)
//! plus player accounts and server-side saves on SQLite.
//!
//! Catalog endpoints:
//!   GET /catalog, GET /catalog/{name}, GET /moves, GET /moves/{name},
//!   GET /abilities, GET /zones, GET /health
//!
//! Accounts & saves (SQLite, `poke-liga.db`):
//!   POST /auth/register {username,password} → {token}
//!   POST /auth/login    {username,password} → {token}
//!   GET  /save          (Bearer) → { "poke-league-save": {...}, ... }
//!   PUT  /save/{key}    (Bearer, JSON body) → upsert one save key
//!
//! Data source: `--catalog=path` serves an existing snapshot; otherwise an
//! original creature set is generated at startup. `--db=path` selects the
//! SQLite file (default `poke-liga.db`).

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use axum::routing::{get, post, put};
use axum::Router;
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;

mod auth;
mod db;
mod generator;
mod models;

use models::Catalog;

pub struct AppState {
    pub catalog: Catalog,
    pub db: db::Db,
    pub jwt_secret: String,
}

type SharedState = Arc<AppState>;

#[derive(Deserialize)]
struct Credentials {
    username: String,
    password: String,
}

#[derive(Serialize)]
struct TokenResponse {
    token: String,
    username: String,
}

#[tokio::main]
async fn main() {
    let catalog: Catalog = match std::env::args().find(|a| a.starts_with("--catalog=")) {
        Some(arg) => {
            let path = arg.trim_start_matches("--catalog=");
            match std::fs::read_to_string(path)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
            {
                Some(c) => {
                    println!("serving existing catalog from {path}");
                    c
                }
                None => {
                    eprintln!("could not load {path} — generating an original set instead");
                    generator::generate_catalog(120, 3)
                }
            }
        }
        None => {
            println!("no --catalog given — generating an original creature set");
            generator::generate_catalog(120, 3)
        }
    };

    let db_path = std::env::args()
        .find(|a| a.starts_with("--db="))
        .map(|a| a.trim_start_matches("--db=").to_string())
        .unwrap_or_else(|| "poke-liga.db".to_string());
    let db = db::init_db(&db_path).expect("open database");

    let state = Arc::new(AppState {
        catalog,
        db: Mutex::new(db.into_inner().unwrap()),
        jwt_secret: std::env::var("POKE_LIGA_JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".into()),
    });

    let app = Router::new()
        .route("/health", get(health))
        // catalog (public)
        .route("/catalog", get(catalog_full))
        .route("/catalog/{name}", get(catalog_one))
        .route("/moves", get(moves_all))
        .route("/moves/{name}", get(move_one))
        .route("/abilities", get(abilities_all))
        .route("/zones", get(zones_all))
        // accounts + saves (auth-protected)
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/save", get(get_save))
        .route("/save/{key}", put(put_save))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080")
        .await
        .expect("bind 8080");
    println!("Poke-Liga backend listening on http://localhost:8080 (db: {db_path})");
    axum::serve(listener, app).await.expect("serve");
}

// ---------- health + catalog ----------

async fn health() -> &'static str {
    "ok"
}

async fn catalog_full(State(state): State<SharedState>) -> Json<Catalog> {
    Json(state.catalog.clone())
}

async fn catalog_one(State(state): State<SharedState>, Path(name): Path<String>) -> impl IntoResponse {
    match state.catalog.creatures.get(&name.to_lowercase()) {
        Some(c) => Json(c.clone()).into_response(),
        None => (StatusCode::NOT_FOUND, "unknown creature").into_response(),
    }
}

async fn moves_all(State(state): State<SharedState>) -> Json<HashMap<String, models::MoveDef>> {
    Json(state.catalog.moves.clone())
}

async fn move_one(State(state): State<SharedState>, Path(name): Path<String>) -> impl IntoResponse {
    match state.catalog.moves.get(&name.to_lowercase()) {
        Some(m) => Json(m.clone()).into_response(),
        None => (StatusCode::NOT_FOUND, "unknown move").into_response(),
    }
}

async fn abilities_all(State(state): State<SharedState>) -> Json<HashMap<String, String>> {
    Json(state.catalog.abilities.clone())
}

async fn zones_all(State(state): State<SharedState>) -> Json<HashMap<String, models::Zone>> {
    Json(state.catalog.zones.clone())
}

// ---------- auth ----------

async fn register(
    State(state): State<SharedState>,
    Json(creds): Json<Credentials>,
) -> impl IntoResponse {
    let username = creds.username.trim().to_lowercase();
    if username.len() < 3 || creds.password.len() < 4 {
        return (
            StatusCode::BAD_REQUEST,
            "username ≥ 3 chars, password ≥ 4 chars",
        )
            .into_response();
    }
    let hash = match auth::hash_password(&creds.password) {
        Ok(h) => h,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "hash failed").into_response(),
    };
    let db = state.db.lock().unwrap();
    let id = match db::create_player(&db, &username, &hash) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::CONFLICT,
                "username already taken",
            )
                .into_response()
        }
    };
    let token = auth::sign_token(id, &state.jwt_secret).unwrap_or_default();
    (StatusCode::CREATED, Json(TokenResponse { token, username })).into_response()
}

async fn login(
    State(state): State<SharedState>,
    Json(creds): Json<Credentials>,
) -> impl IntoResponse {
    let username = creds.username.trim().to_lowercase();
    let db = state.db.lock().unwrap();
    match db::password_hash_for(&db, &username) {
        Ok(Some((id, hash))) if auth::verify_password(&creds.password, &hash) => {
            let token = auth::sign_token(id, &state.jwt_secret).unwrap_or_default();
            Json(TokenResponse { token, username }).into_response()
        }
        _ => (StatusCode::UNAUTHORIZED, "bad credentials").into_response(),
    }
}

// ---------- saves ----------

async fn get_save(
    State(state): State<SharedState>,
    auth::PlayerId(player_id): auth::PlayerId,
) -> impl IntoResponse {
    let db = state.db.lock().unwrap();
    match db::load_save(&db, player_id) {
        Ok(rows) => {
            let map: HashMap<String, serde_json::Value> = rows
                .into_iter()
                .filter_map(|(k, v)| serde_json::from_str(&v).ok().map(|parsed| (k, parsed)))
                .collect();
            Json(map).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn put_save(
    State(state): State<SharedState>,
    auth::PlayerId(player_id): auth::PlayerId,
    Path(key): Path<String>,
    body: String,
) -> impl IntoResponse {
    if body.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, "empty body").into_response();
    }
    let db = state.db.lock().unwrap();
    match db::upsert_save(&db, player_id, &key, &body) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
