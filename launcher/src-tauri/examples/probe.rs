use std::time::Duration;

#[tokio::main]
async fn main() {
    let client = reqwest::Client::builder()
        .user_agent("DedsafioProbe/0.1")
        .timeout(Duration::from_secs(30))
        .build()
        .unwrap();

    let urls = [
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
        "https://libraries.minecraft.net/ca/weblite/java-objc-bridge/1.1/java-objc-bridge-1.1.jar",
        "https://resources.download.minecraft.net/b6/b62ca8ec10d07e6bf5ac8dae0c8c1d2e6a1e3356",
        "https://piston-data.mojang.com/v1/objects/30c73b1c5da787909b2f73340419fdf13b9def88/client.jar",
        "https://meta.fabricmc.net/v2/versions/loader/1.21.1",
        "https://maven.fabricmc.net/",
    ];

    for u in urls {
        match client.get(u).send().await {
            Ok(r) => println!("OK   {}  {}", r.status(), u),
            Err(e) => println!("ERR  {}  =>  {}", u, e),
        }
    }
}
