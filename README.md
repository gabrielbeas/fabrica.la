# fabrica.la

La Fábrica de Chocolate.

- Sitio público: `https://fabrica.la/` (fuente: `fabrica/`)
- Panel administrativo: `https://fabrica.la/admin/` (fuente: `admin/public/`, login en `login.html`)

El panel es HTML + JavaScript estático con Firebase Auth y Firestore. Los datos
(contratos, facturas, lecturas de agua) viven en Firestore y los protegen las
reglas de seguridad de Firebase; en este repositorio no hay datos privados.

Se publica con GitHub Actions (`.github/workflows/deploy.yml`) en GitHub Pages.
Detalles de arquitectura y reglas de trabajo en `CLAUDE.md`.
