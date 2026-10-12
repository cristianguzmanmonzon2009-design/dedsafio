use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn log_file() -> Option<PathBuf> {
    let dir = dirs::data_local_dir()?
        .join("com.dedsafio.launcher")
        .join("logs");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join("launcher.log"))
}

fn timestamp() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}

fn write_line(tag: &str, msg: &str) {
    if let Some(path) = log_file() {
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
        {
            use std::io::Write;
            let _ = writeln!(f, "[{}] {} {}", timestamp(), tag, msg);
        }
    }
}

pub fn info(msg: &str) {
    write_line("INFO", msg);
}

pub fn error(msg: &str) {
    write_line("ERROR", msg);
}
