use fred::prelude::*;
use nanoid::nanoid;
// use sqids::Sqids;
use tokio::time::Duration;
// use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct Database {
    pool: RedisPool,
}

impl Database {
    pub async fn connect(database_url: &str, pool_size: usize) -> Result<Database, anyhow::Error> {
        let config =
            RedisConfig::from_url(database_url).expect("Failed to create redis config from url");
        let mut builder = Builder::from_config(config);
        builder
            .with_connection_config(|config| {
                config.connection_timeout = Duration::from_secs(10);
            })
            // use exponential backoff, starting at 100 ms and doubling on each failed attempt up to 30 sec
            .set_policy(ReconnectPolicy::new_exponential(0, 100, 30_000, 2));

        let pool = builder.build_pool(pool_size)?;
        pool.init().await?;

        let database = Database { pool };
        Ok(database)
    }

    fn generate_key() -> Result<String, anyhow::Error> {
        // let unique_id = Uuid::new_v4();
        // let sqids = Sqids::builder().min_length(10).build()?;
        // let (p1, p2) = unique_id.as_u64_pair();
        // let key = sqids.encode(&[p1, p2])?;
        // Ok(key)
        let key = nanoid!(10);
        Ok(key)
    }

    pub async fn get_url(&self, key: &str) -> Result<Option<String>, anyhow::Error> {
        let url = self.pool.get(key).await?;
        Ok(url)
    }

    pub async fn create_key(&self, url: &str) -> Result<String, anyhow::Error> {
        let key = Database::generate_key()?;
        self.pool.set(&key, url, None, None, false).await?;
        Ok(key)
    }
}
