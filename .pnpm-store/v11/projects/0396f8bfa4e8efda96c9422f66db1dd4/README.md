# Protección de `/admin`

Este Worker aplica autenticación HTTP Basic a:

- `https://fabrica.la/admin`
- `https://fabrica.la/admin/` y todas sus rutas descendientes

El usuario es `admin`. La contraseña se almacena exclusivamente como el
secreto cifrado `BASIC_PASSWORD` de Cloudflare y nunca debe añadirse al
repositorio.

## Primera publicación

Desde esta carpeta:

```sh
npm install
npx wrangler login
npx wrangler deploy
npx wrangler secret put BASIC_PASSWORD
```

El último comando solicita la contraseña de forma interactiva. Utiliza una
contraseña ASCII larga y única. No la pegues en archivos, commits ni mensajes.

El registro DNS de `fabrica.la` debe estar administrado por Cloudflare y con el
proxy activado. La ruta configurada es `fabrica.la/admin*`; el Worker comprueba
además que la ruta sea exactamente `/admin` o comience con `/admin/`.

## Verificación

1. Abre una ventana privada y visita `https://fabrica.la/admin/`.
2. Confirma que el navegador solicite usuario y contraseña.
3. Comprueba que una contraseña incorrecta devuelva `401`.
4. Comprueba que `https://fabrica.la/` siga siendo público.
