//! Poke-Liga backend — serves the catalog contract (docs/backend-catalog.md).
//!
//! Endpoints:
//!   GET /health            → ok
//!   GET /catalog           → the whole catalog (contract shape)
//!   GET /catalog/{name}    → one creature
//!   GET /moves             → move table
//!   GET /moves/{name}      → one move
//!   GET /abilities         → ability texts
//!   GET /zones             → adventure habitats
//!
//! Data source: pass `--catalog=path/to/catalog.json` to serve an existing
//! snapshot (e.g. the generated `public/catalog.json`); otherwise a fresh
//! ORIGINAL creature set is procedurally generated at startup (no external
//! data, fully deterministic).

use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use axum::routing::get;
use axum::Router;
use tower_http::cors::CorsLayer;

mod generator;
mod models;

use models::Catalog;

type SharedCatalog = Arc<Catalog>;

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

    let app = Router::new()
        .route("/health", get(health))
        .route("/catalog", get(catalog_full))
        .route("/catalog/{name}", get(catalog_one))
        .route("/moves", get(moves_all))
        .route("/moves/{name}", get(move_one))
        .route("/abilities", get(abilities_all))
        .route("/zones", get(zones_all))
        .layer(CorsLayer::permissive())
        .with_state(Arc::new(catalog));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080")
        .await
        .expect("bind 8080");
    println!("Poke-Liga backend listening on http://localhost:8080");
    axum::serve(listener, app).await.expect("serve");
}

async fn health() -> &'static str {
    "ok"
}

async fn catalog_full(State(catalog): State<SharedCatalog>) -> Json<Catalog> {
    Json((*catalog).clone())
}

async fn catalog_one(
    State(catalog): State<SharedCatalog>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    match catalog.creatures.get(&name.to_lowercase()) {
        Some(c) => Json(c.clone()).into_response(),
        None => (StatusCode::NOT_FOUND, "unknown creature").into_response(),
    }
}

async fn moves_all(State(catalog): State<SharedCatalog>) -> Json<HashMap<String, models::MoveDef>> {
    Json(catalog.moves.clone())
}

async fn move_one(
    State(catalog): State<SharedCatalog>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    match catalog.moves.get(&name.to_lowercase()) {
        Some(m) => Json(m.clone()).into_response(),
        None => (StatusCode::NOT_FOUND, "unknown move").into_response(),
    }
}

async fn abilities_all(State(catalog): State<SharedCatalog>) -> Json<HashMap<String, String>> {
    Json(catalog.abilities.clone())
}

async fn zones_all(State(catalog): State<SharedCatalog>) -> Json<HashMap<String, models::Zone>> {
    Json(catalog.zones.clone())
}
