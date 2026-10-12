# Mod Fabric (Dedsafio Guard)

Mod que corre en **cliente y servidor** (Fabric 1.21.1) y aplica la política de
acceso de Dedsafio: el servidor exige que cada cliente complete un *handshake* de
licencia contra el backend y que traiga el conjunto de mods esperado.

## Estructura

```
mod/
├── build.gradle / settings.gradle / gradle.properties
└── src/main/
    ├── resources/fabric.mod.json
    └── java/com/dedsafio/mod/
        ├── DedsafioMod.java      # servidor: registro de payloads + guardia
        ├── DedsafioClient.java   # cliente: responde al reto
        ├── LicenseClient.java    # HTTP contra /license/validate
        └── net/
            ├── HandshakePayload.java   # S2C
            └── LicensePayload.java     # C2S
```

## Flujo del handshake

1. Al entrar un jugador, el servidor envía `HandshakePayload` (nonce, serverId,
   versión de manifiesto).
2. El cliente responde con `LicensePayload` (nonce, licencia, hardwareId,
   usuario, versión de manifiesto, lista de mods).
3. El servidor valida el nonce, la versión del manifiesto, la lista de mods y
   llama a `POST /api/v1/license/validate`. Si algo falla, expulsa al jugador.

## Variables de entorno

| Variable | Lado | Descripción |
|---|---|---|
| `DEDSAFIO_LICENSE` | cliente | Token de licencia (lo inyecta el launcher) |
| `DEDSAFIO_HWID` | cliente | Identificador de hardware (lo inyecta el launcher) |
| `DEDSAFIO_SERVER_ID` | servidor | Id del servidor (por defecto `endersafio`) |
| `DEDSAFIO_MANIFEST_VERSION` | servidor | Versión de manifiesto exigida (opcional) |
| `DEDSAFIO_EXPECTED_MODS` | servidor | Ids de mods obligatorios separados por comas |
| `DEDSAFIO_API_URL` | ambos | URL del backend |

## Compilar

Requiere **JDK 21** y **Gradle** (o usa el wrapper). Ver `docs/DEV.md`.

```
# En la carpeta mod/
gradle build          # genera build/libs/dedsafio-guard-1.0.0.jar
```

El jar resultante se sube al backend con:

```bash
npx tsx tools/publish-mod.ts --file mod/build/libs/dedsafio-guard-1.0.0.jar --id dedsafio --version 1.0.0
npm run mods:manifest
```

## Limitaciones (honestas)

- Un mod debe ser **cargable en claro** por Fabric: no puede estar cifrado en
  tiempo de ejecución. Cifrado en reposo + entrega autenticada, sí.
- La ofuscación dificulta la ingeniería inversa pero **no es irrompible**.
- El cliente es hostil por definición: la **autoridad real es el servidor** y el
  backend (este guard). Todo lo que ocurre solo en el cliente puede falsificarse.
