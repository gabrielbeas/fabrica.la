# Protección de `/admin`

Este Worker aplica autenticación HTTP Basic a:

- `https://fabrica.la/admin`
- `https://fabrica.la/admin/` y todas sus rutas descendientes

El usuario es `admin`. La contraseña se almacena exclusivamente como el
secreto cifrado `BASIC_PASSWORD` de Cloudflare y nunca debe añadirse al
repositorio. El Worker también funciona como intermediario para que los tokens
y las URL privadas de Google Apps Script no lleguen al navegador.

## Primera publicación

Desde esta carpeta:

```sh
npm install
npx wrangler login
npx wrangler deploy
npx wrangler secret put BASIC_PASSWORD
npx wrangler secret put SHEETS_ACCESS_TOKEN
npx wrangler secret put READINGS_ENDPOINT
```

Los últimos tres comandos solicitan los valores de forma interactiva:

- `BASIC_PASSWORD`: contraseña ASCII larga y única para el panel.
- `SHEETS_ACCESS_TOKEN`: mismo `ACCESS_TOKEN` configurado en las propiedades
  del Apps Script de consulta. Debe rotarse si alguna vez estuvo en Git.
- `READINGS_ENDPOINT`: URL completa del Apps Script de lecturas.

No pegues ninguno de estos valores en archivos, commits ni mensajes.

El registro DNS de `fabrica.la` debe estar administrado por Cloudflare y con el
proxy activado. La ruta configurada es `fabrica.la/admin*`; el Worker comprueba
además que la ruta sea exactamente `/admin` o comience con `/admin/`.

## Verificación

1. Abre una ventana privada y visita `https://fabrica.la/admin/`.
2. Confirma que el navegador solicite usuario y contraseña.
3. Comprueba que una contraseña incorrecta devuelva `401`.
4. Comprueba que `https://fabrica.la/` siga siendo público.
5. Con la sesión abierta, comprueba que
   `https://fabrica.la/admin/api/sheets?book=admin` devuelva JSON.
