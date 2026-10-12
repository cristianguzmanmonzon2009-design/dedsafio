/**
 * Variables de entorno para tests. Se ejecuta antes de importar los módulos.
 * Las claves son de prueba y NO deben usarse en producción.
 */
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://dedsafio:dedsafio@localhost:5432/dedsafio_test?schema=public";
process.env.ACCESS_TOKEN_SECRET =
  "test_access_secret_0123456789_0123456789_ab";
process.env.LICENSE_TOKEN_SECRET =
  "test_license_secret_0123456789_0123456789_a";
process.env.DOWNLOAD_URL_SECRET =
  "test_download_secret_0123456789_0123456789";
process.env.SIGNING_PRIVATE_KEY_PEM_B64 =
  "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1DNENBUUF3QlFZREsyVndCQ0lFSUdaM3FGMmhqYkV0blNodUd0LzNCR2dnNzVoZGFhMERpY1ZTNTdtZzF6ei8KLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQo=";
process.env.SIGNING_PUBLIC_KEY_PEM_B64 =
  "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUNvd0JRWURLMlZ3QXlFQURIRGJ6U1h1Y1NUK0ozWkxzTnVsU0NMaUlCVkYyQXdTT2VVRktFaXJ1eEU9Ci0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQo=";
process.env.MOD_MASTER_KEY_B64 = "rTwNL660Vtavy+lVhdpv51nU5bfNNX5DZILrJfwor04=";
process.env.SERVER_ID = "endersafio";
