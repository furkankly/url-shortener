use axum::extract::MatchedPath;
use axum::extract::Path;
use axum::extract::Request;
use axum::extract::State;
use axum::response::Redirect;
use axum::routing::get;
use axum::routing::post;
use axum::Router;
use clap::Parser;
use database::Database;
use lambda_http::run;
use lambda_http::tracing;
use lambda_http::Error;
use serde::Deserialize;
use serde::Serialize;
use std::env::set_var;
use std::sync::Arc;
use tower_http::trace::TraceLayer;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

mod database;
mod util;

use crate::util::AppError;
use crate::util::AppJson;

struct AppState {
    database: Database,
    endpoint: String,
}

#[derive(Parser)]
pub struct Config {
    #[clap(
        long = "elasticache cluster endpoint",
        env = "ELASTICACHE_CLUSTER_ENDPOINT"
    )]
    /// The URL to use to connect to the database.
    pub database_url: String,
    #[clap(long = "pool size", env = "POOL_SIZE", default_value = "4")]
    pub pool_size: usize,
    #[clap(long = "endpoint", env = "ENDPOINT")]
    /// CloudFront URL.
    pub endpoint: String,
}

async fn redirect_handler(
    State(state): State<Arc<AppState>>,
    Path(key): Path<String>,
) -> Result<Redirect, AppError> {
    let url = state.database.get_url(&key).await?;
    if let Some(url) = url {
        Ok(Redirect::to(&url))
    } else {
        Err(AppError::NotFound)
    }
}

#[derive(Deserialize)]
struct CreatePayload {
    url: String,
}
#[derive(Serialize)]
struct CreateResponse {
    key: String,
    long_url: String,
    short_url: String,
}
#[derive(Serialize)]
struct Response<T> {
    data: T,
}
async fn create_handler<'a>(
    State(state): State<Arc<AppState>>,
    AppJson(payload): AppJson<CreatePayload>,
) -> Result<AppJson<Response<CreateResponse>>, AppError> {
    let endpoint = &state.endpoint;
    let url = payload.url;
    let key = state.database.create_key(&url).await?;

    let create_response = CreateResponse {
        short_url: format!("{endpoint}/{key}"),
        key,
        long_url: url,
    };
    Ok(AppJson(Response {
        data: create_response,
    }))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenvy::dotenv().ok();
    let config = Config::parse();
    let database = Database::connect(&config.database_url, config.pool_size)
        .await
        .unwrap();
    let endpoint = config.endpoint;
    let state = Arc::new(AppState { database, endpoint });

    set_var("AWS_LAMBDA_HTTP_IGNORE_STAGE_IN_PATH", "true");

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "url_shortener=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let router = Router::new().nest(
        "/api",
        Router::new()
            .route("/:key", get(redirect_handler))
            .route("/", post(create_handler))
            .layer(
                TraceLayer::new_for_http()
                    .make_span_with(|req: &Request| {
                        let method = req.method();
                        let uri = req.uri();

                        let matched_path = req
                            .extensions()
                            .get::<MatchedPath>()
                            .map(|matched_path| matched_path.as_str());

                        tracing::debug_span!("request", %method, %uri, matched_path)
                    })
                    // By default `TraceLayer` will log 5xx responses but we're doing our specific
                    // logging of errors so disable that
                    .on_failure(()),
            )
            .with_state(state),
    );

    run(router).await
}
