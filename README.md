# fabrica.la

La Fábrica de Chocolate.

## Publicación

- Sitio público: `https://fabrica.la/`
- Panel administrativo: `https://fabrica.la/admin/`
- Fuente del panel: `dashboard/public/agua/`

GitHub Pages publica contenido estático y no ejecuta el backend ubicado en
`dashboard/src`. El acceso a `/admin/*` se protege con el Cloudflare Worker
ubicado en `cloudflare/admin-auth/`; una contraseña implementada únicamente en
HTML o JavaScript no protegería los archivos del panel.
