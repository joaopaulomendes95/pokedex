//! Auth: Argon2 password hashing + signed JWTs, plus an Axum extractor that
//! resolves the Bearer token to the player id.

use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use axum::extract::FromRequestParts;
use std::sync::Arc;
use axum::http::request::Parts;
use axum::http::StatusCode;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

const TOKEN_TTL_SECS: u64 = 60 * 60 * 24 * 30; // 30 days

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: i64,
    exp: usize,
}

pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .ok()
        .map(|parsed| Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
        .unwrap_or(false)
}

pub fn sign_token(player_id: i64, secret: &str) -> Result<String, String> {
    let exp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as usize + TOKEN_TTL_SECS as usize)
        .unwrap_or(0);
    encode(
        &Header::default(),
        &Claims { sub: player_id, exp },
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| e.to_string())
}

fn verify_token(token: &str, secret: &str) -> Option<i64> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .ok()?;
    Some(data.claims.sub)
}

/// Extractor: `Authorization: Bearer <jwt>` → player id.
pub struct PlayerId(pub i64);

impl FromRequestParts<Arc<crate::AppState>> for PlayerId {
    type Rejection = (StatusCode, String);

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<crate::AppState>,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or((StatusCode::UNAUTHORIZED, "missing Authorization header".into()))?;
        let token = header.strip_prefix("Bearer ").ok_or((
            StatusCode::UNAUTHORIZED,
            "expected 'Bearer <token>'".into(),
        ))?;
        verify_token(token, &state.jwt_secret)
            .map(PlayerId)
            .ok_or((StatusCode::UNAUTHORIZED, "invalid or expired token".into()))
    }
}
