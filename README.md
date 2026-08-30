# fabrica.la

La Fábrica de Chocolate.

## Publicación

- Sitio público: `https://fabrica.la/`
- Panel administrativo: `https://fabrica.la/admin/`
- Fuente del panel: `dashboard/public/agua/`

GitHub Pages publica contenido estático y no ejecuta el backend ubicado en
`dashboard/src`. El acceso a `/admin/*` debe protegerse en Cloudflare Access;
una contraseña implementada únicamente en HTML o JavaScript no protege los
archivos del panel.

Las rutas anteriores `/dashboard/` y `/dashboard/agua/` se conservan solamente
como redirecciones hacia `/admin/`.
