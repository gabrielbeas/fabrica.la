# Panel de administración · La Fábrica de Chocolate

Panel interno para administrar la plaza comercial La Fábrica de Chocolate (Guadalajara). El dueño es Gabriel; habla en español y espera respuestas en español.

## Reglas importantes

- **El repo es público.** Nunca subir datos privados: RFCs, correos o teléfonos de inquilinos, montos de contratos, recibos de CFE, escrituras. Todo eso vive en Firestore o en `_privado/` (ignorado en `.gitignore`). Antes de cada commit, revisar que nada privado quede en el código.
- **Interfaz:** fondo blanco, **sin emojis**, textos en español, estilo limpio (bordes `#eee`, morado `#667eea` / gradiente `#667eea → #764ba2`).
- No borrar datos de Firestore sin confirmarlo con Gabriel. Las ediciones de contratos deben dejar entrada en `contratos/{id}/historial`.
- No inventar datos: si algo no está en Firestore o en los archivos, preguntar.
- Los cambios se prueban en local antes de subir: `py -3 -m http.server 8000` desde la raíz del repo y abrir `http://localhost:8000/login.html`.

## Arquitectura

- HTML + JS (ES modules) sin build. Firebase v10.8.0 desde el CDN de gstatic.
- **Firebase Auth** (email/contraseña) + **Firestore**. Perfil en `users/{uid}` con `rol: "admin" | "operario"` y `activo`.
- **GitHub Pages** con GitHub Actions (`.github/workflows/deploy.yml`) arma `dist/`: el sitio público sale de `fabrica/`, el panel de `admin/public/` se publica en `/admin/`. **Cada página nueva del panel hay que agregarla a `deploy.yml`.** El build falla si encuentra `_privado`, `data.json` o `.gs` en `dist/`.
- `basePath()` en `js/auth.js`: `/admin/public/` en local y `/admin/` publicado. Usarlo para todos los enlaces internos.
- Cloudflare solo maneja DNS (ya no hay Worker).
- **Reglas de Firestore:** `firestore.rules` es solo una copia de referencia; las reglas activas se publican a mano en Firebase Console → Firestore → Reglas.

### Archivos compartidos

- `js/auth.js`: login, roles, `basePath()`, `getSeccionesPermitidas()` (menú por rol), exporta `auth` y `db`.
- `js/navbar.js`: barra superior con logo (`admin/public/css/logo.png`).
- `js/facturacion.js`: lógica de facturas, agua, basura y el PDF para contadores. Se importa con `?v=AAAAMMDD-n` en `facturacion/index.html` y `ficha.html`: **cada vez que cambie este archivo, subir el número de versión** en ambos imports (si no, el navegador usa la copia vieja en caché y el PDF sale distinto a la pantalla).
- `js/alertas-contrato.js`: alertas de contratos (fin de contrato, incremento de renta, saldo de depósito por pagar). El seguro NO genera alerta.

### Secciones (`admin/public/`)

| Ruta | Qué hace | Rol |
|---|---|---|
| `index.html` | Home con apps (tarjetas). Vistas internas `#directorio` y `#metrajes` con columnas ordenables | admin (operario solo ve sus apps) |
| `locales/index.html` | Lista de contratos con punto de alerta por color | admin |
| `locales/caratula.html` | Carátula numerada por secciones, Editar (arreglo `CAMPOS`), alertas de vigencia e incremento, CFE (hasta 2 servicios: `cfe*` y `cfe2*`), historial de depósitos y de pagos de renta (pagos del día 11 en adelante en rojo) | admin |
| `facturacion/index.html` | Facturas del mes, interruptor de moratorios (5% de la renta sin IVA), "Actualizar agua y periodos", PDF para contadores | admin |
| `facturacion/ficha.html` | Factura de un locatario; datos de facturación arriba | admin |
| `agua/lecturas.html` | Captura de lecturas, calendario propio con punto rojo en días con lecturas, histórico por tubo (clic en la fila) | admin y operario |
| `calendarios/index.html` | Calendario: eventos automáticos (vencimientos, incrementos, límite de pago día 10, lecturas de agua, feriados LFT 2026–2027) + eventos capturados en `calendario_eventos` | admin y operario |
| `herramientas/` | Importadores de una sola vez (agua, contratos, facturas, carátulas) | admin |

Código viejo (backend Node, Worker de Cloudflare, páginas de agua que usaban Apps Script/Sheets, `admin/public/js/`) se sacó del repo el 01/10/2026 y quedó en `_privado/sacado-del-repo/`. Lo único que sigue de Apps Script es `admin/public/agua/apps-script/Historial.gs` (manda las lecturas al Sheet LFdC_OPERACION; valida el token de Firebase).

### Colecciones de Firestore

- `users`: perfiles y roles.
- `contratos`: un documento por contrato (`contrato_1`, `contrato_7-15`, ...). Incluye `rentas`, `historialDepositos`, `pagosRenta`, `facturacion` (correos, tubos de agua, basura), CFE. Subcolección `historial`.
- `facturas`: id `{contratoId}_{YYYY-MM}`; `conceptos` con `tipo` (renta, extraordinario, moratorios, basura, agua, otro), `moratoriosPct`, `estadoPago`.
- `agua_medidores`, `agua_lecturas` (id `{tubo}_{fecha}`), `agua_config/general` (`costoM3`).
- `calendario_eventos`: `titulo, tipo (actividad|vacaciones|feriado), inicio, fin, local, nota, creadoPor`.

## Reglas de negocio

- **Agua:** costo por m³ **con IVA incluido** (78.64). Subtotal = total ÷ 1.16. **El agua que se factura es la del mes anterior** (factura de octubre → lectura de septiembre, tomada alrededor del día 21); el periodo que aparece es el mes de la lectura. El tubo 21 se reparte 50/50 entre Proyectos Saraperos y Cine Responsable.
- **Basura:** $158.28 + IVA = $183.60 para locales 16-18, 19-22, 11-13 y 10; periodo = mes de la factura.
- **IVA:** 16%. Renta con IVA = renta × 1.16.
- **Moratorios:** 5% sobre la renta sin IVA, se activan por factura.
- **Pago tarde:** pagos del día 11 en adelante (límite de pago: día 10).
- **Alertas:** aparecen 90 días antes; colores: rojo vencido, naranja ≤30 días, amarillo ≤60, azul ≤90, verde más de 90.

## Pendientes

- Publicar en Firebase la regla de `calendario_eventos` (lectura y alta para registrados; editar y borrar solo admin).
- Configuración: gestión de usuarios y crear el perfil del operario.
- Facturas de septiembre 2026: correr "Actualizar agua y periodos" (siguen ligadas a lecturas del 29/09, que se borraron).
- Tubo 10: lectura anómala del 29/02/2024 (99,998.222 m³) importada del Sheet; confirmar el valor real.
- Depósitos de los locales 6, 7 y 15: hay $6,300 de 2022 sin asignar; el ajuste de Setter Bistro del 15/08/2025 difiere por $6 entre Simplifi y la tabla de Gabriel.
- Seguridad (auditoría 01/10/2026), pasos manuales de Gabriel: archivar en script.google.com el despliegue viejo del conector `Code.gs` (sigue vivo, protegido con token, ya nadie lo usa); borrar en Cloudflare el Worker `admin-auth` si sigue existiendo; en Firebase Auth desactivar el alta de usuarios desde el cliente y restringir la API key por dominio (fabrica.la, localhost); cambiar las contraseñas si alguna vez se usaron `admin123456` u `operario123` (quedaron en el historial público de git).
