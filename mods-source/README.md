# mods-source/

Coloca aquí los `.jar` de los mods que quieres distribuir de forma privada.

No se sirven directamente: `tools/publish-mod.ts` los **cifra** con la clave
maestra del backend y los registra en la base de datos. Los `.jar` y `.enc`
están excluidos de git.

Flujo:

```bash
# desde la raíz del proyecto
npm run mods:publish -- --file mi-mod.jar --id mi-mod --version 1.0.0
npm run mods:manifest

# mod opcional, solo para ciertos servidores:
npm run mods:publish -- --file extra.jar --id extra --version 1.0.0 --optional --servers endersafio
```

Ejemplo de manifiesto resultante:

```json
{
  "minecraft": "1.21.1",
  "loader": "fabric",
  "loaderVersion": "0.16.5",
  "mods": [
    {
      "id": "mi-mod",
      "version": "1.0.0",
      "sha256": "…64 hex…",
      "size": 123456,
      "required": true,
      "fileName": "mi-mod.jar"
    }
  ]
}
```
