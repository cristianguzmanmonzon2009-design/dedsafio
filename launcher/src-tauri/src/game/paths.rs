use std::path::{Path, PathBuf};

/// Distribución de directorios de la instalación (estilo `.minecraft`).
#[derive(Debug, Clone)]
pub struct Paths {
    pub root: PathBuf,
    pub server_id: String,
}

impl Paths {
    pub fn new(root: PathBuf, server_id: impl Into<String>) -> Self {
        Self {
            root,
            server_id: server_id.into(),
        }
    }

    pub fn default_root() -> PathBuf {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("DedsafioLauncher")
    }

    pub fn ensure_root(&self) -> std::io::Result<()> {
        std::fs::create_dir_all(&self.root)
    }

    pub fn runtime(&self) -> PathBuf {
        self.root.join("runtime")
    }
    pub fn java_dir(&self) -> PathBuf {
        self.runtime().join("java")
    }
    pub fn java_exe(&self) -> PathBuf {
        self.java_dir().join("bin").join("java.exe")
    }

    pub fn libraries(&self) -> PathBuf {
        self.root.join("libraries")
    }
    pub fn assets(&self) -> PathBuf {
        self.root.join("assets")
    }
    pub fn assets_indexes(&self) -> PathBuf {
        self.assets().join("indexes")
    }
    pub fn assets_objects(&self) -> PathBuf {
        self.assets().join("objects")
    }
    pub fn versions(&self) -> PathBuf {
        self.root.join("versions")
    }
    pub fn version_dir(&self, id: &str) -> PathBuf {
        self.versions().join(id)
    }
    pub fn version_jar(&self, id: &str) -> PathBuf {
        self.version_dir(id).join(format!("{id}.jar"))
    }
    pub fn version_json(&self, id: &str) -> PathBuf {
        self.version_dir(id).join(format!("{id}.json"))
    }
    pub fn natives(&self, id: &str) -> PathBuf {
        self.versions().join(id).join("natives")
    }

    pub fn instance(&self) -> PathBuf {
        self.root.join("instances").join(&self.server_id)
    }
    pub fn mods(&self) -> PathBuf {
        self.instance().join("mods")
    }

    pub fn resolve_or_default(install: Option<&str>, server_id: &str) -> Paths {
        let root = install
            .filter(|s| !s.is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(Self::default_root);
        Paths::new(root, server_id)
    }
}

/// Crea el directorio padre de un archivo si no existe.
pub fn ensure_parent(path: &Path) -> std::io::Result<()> {
    if let Some(p) = path.parent() {
        std::fs::create_dir_all(p)?;
    }
    Ok(())
}
