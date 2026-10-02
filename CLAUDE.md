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
| `agua/lecturas.html` | Captura de lecturas, calendario propio con punto rojo en días con lecturas, histórico por tubo (clic en la fila). Columna «Costo m³» = costo con que quedó grabada cada lectura; el costo de arriba solo aplica a lecturas nuevas o corregidas ("Guardar lecturas" ya no regraba las que no cambiaron); si difieren, aviso con botón "Recalcular a $X" | admin y operario |
| `agua/siapa.html` | SIAPA (toma general). Sección "Costo por m³": SIAPA (importe ÷ m³ del periodo) contra la tarifa cobrada (moda de `costoM3` de las lecturas de locales del periodo), con gráfica (más dos líneas punteadas: promedio de todo el histórico ponderado por m³, SIAPA y cobrado), resumen por año y tabla por periodo. Tubos especiales: `MTO` = medidor maestro (lo leen ustedes, sigue a SIAPA), `SG` = Servicios Generales es consumo propio (no se cobra ni cuenta como local); el tubo `14` (GB LAFABDECHOC) cuenta como un local más. Muestra: tarjetas de costo real por m³ y % recuperado, gráficas de líneas LAFABDECHOC vs locales vs MTO (acumulado y mes a mes normalizado a 30 días; se omite la primera lectura de cada medidor) y una línea por medidor de local (eje con cada mes; 8 colores y del noveno en adelante punteada; debajo, tabla ordenable con local, tubo, locatario, m³ 12 periodos, promedio, último periodo, total y desde: pasar el mouse por un renglón resalta la línea, clic o su interruptor la oculta, interruptor general apaga/prende todos; con un solo local prendido aparece "Reporte de ... (PDF)": hoja carta con tarjetas, gráfica y lecturas desde el inicio del contrato, vía window.print; cada línea empieza en `inicio` del contrato que tiene ese tubo en `facturacion.tubos`, salvo los tubos de la constante `RENOVADOS` —hoy el 21— que muestran todo su histórico), gráficas de importe y m³, comparación por periodo contra las lecturas de locatarios (sin el tubo MTO, que es el medidor general; cada lectura va al periodo SIAPA más cercano, máx. 20 días), periodos, recibos y pagos; captura de recibo y de pago | admin |
| `calendarios/index.html` | Calendario: eventos automáticos (vencimientos, incrementos, límite de pago día 10, lecturas de agua, feriados LFT 2026–2027) + eventos capturados en `calendario_eventos` | admin y operario |
| `config/index.html` | Configuración: pestaña Usuarios (perfiles de `users`: nombre, rol, activo, alta con UID de la consola, restablecer contraseña) y pestaña Valores (costo de agua, basura, % moratorios, día límite de pago; cambios en `facturacion_config/general.cambios`) | admin |
| `herramientas/` | Importadores de una sola vez (agua, contratos, facturas, carátulas) | admin |

Código viejo (backend Node, Worker de Cloudflare, páginas de agua que usaban Apps Script/Sheets, `admin/public/js/`) se sacó del repo el 01/10/2026 y quedó en `_privado/sacado-del-repo/`. Lo único que sigue de Apps Script es `admin/public/agua/apps-script/Historial.gs` (manda las lecturas al Sheet LFdC_OPERACION; valida el token de Firebase).

### Colecciones de Firestore

- `users`: perfiles y roles.
- `contratos`: un documento por contrato (`contrato_1`, `contrato_7-15`, ...). Incluye `rentas`, `historialDepositos`, `pagosRenta`, `facturacion` (correos, tubos de agua, basura), CFE. Subcolección `historial`.
- `facturas`: id `{contratoId}_{YYYY-MM}`; `conceptos` con `tipo` (renta, extraordinario, moratorios, basura, agua, otro), `moratoriosPct`, `estadoPago`.
- `agua_medidores`, `agua_lecturas` (id `{tubo}_{fecha}`), `agua_config/general` (`costoM3`). Fuente original: Sheet LFdC_OPERACION, pestaña HIDRAULICO (copia en `_privado/agua/hidraulico-2027.csv`; el 02/10/2026 se completaron MTO y SG desde ahí).
- `siapa_periodos` (id = fecha de lectura `YYYY-MM-DD`: lectura, nota, m3, dias, m3Dia, importe), `siapa_recibos` (id = fecha de emisión: periodo, vence, totalMes, totalAPagar, recargos, desglose, cuenta), `siapa_pagos` (id `{fecha}_{centavos}`, fecha real del banco, `origen: banco`). Importados de los PDF en `_privado/siapa/` (resumen en `_privado/siapa/siapa.json`). Solo admin (regla publicada el 01/10/2026).
- `facturacion_config/general`: `basura {subtotal, iva, total}`, `moratoriosPct`, `diaLimitePago`, `cambios` (bitácora). Defaults en `js/facturacion.js` (`BASURA_DEFAULT`, `MORATORIOS_DEFAULT`, `DIA_LIMITE_DEFAULT`).
- `calendario_eventos`: `titulo, tipo (actividad|vacaciones|feriado), inicio, fin, local, nota, creadoPor`.

## Reglas de negocio

Costo de agua, basura, % de moratorios y día límite de pago se editan en Configuración → Valores (los números de abajo son los vigentes al 01/10/2026). IVA y ventanas de alertas siguen fijos en el código.


- **Agua:** costo por m³ **con IVA incluido** (78.64). Subtotal = total ÷ 1.16. **El agua que se factura es la del mes anterior** (factura de octubre → lectura de septiembre, tomada alrededor del día 21); el periodo que aparece es el mes de la lectura. El tubo 21 se reparte 50/50 entre Proyectos Saraperos y Cine Responsable.
- **Basura:** $158.28 + IVA = $183.60 para locales 16-18, 19-22, 11-13 y 10; periodo = mes de la factura.
- **IVA:** 16%. Renta con IVA = renta × 1.16.
- **Moratorios:** 5% sobre la renta sin IVA, se activan por factura.
- **Pago tarde:** pagos del día 11 en adelante (límite de pago: día 10).
- **Alertas:** aparecen 90 días antes; colores: rojo vencido, naranja ≤30 días, amarillo ≤60, azul ≤90, verde más de 90.

## Pendientes

- SIAPA: confirmar qué significan las notas 210 y 206 junto a la lectura (parecen consumo estimado: la lectura se repite del periodo anterior). Histórico completo de sep 2023 a sep 2026 (jul-ago 2023 no se buscan). Pagos: 17 del banco (`_privado/siapa/pagos-banco.csv`), $347,682 de ago 2023 a sep 2026; cuadran con los recibos salvo $1,729.85 de recargos de 2026 que el recibo de oct 2026 ya no cobra. La cuenta 10016396 que viene en el PDF histórico no es de la plaza.

- Sheet LFdC_OPERACION, pestaña HIDRAULICO: las lecturas de febrero 2026 dicen 01/24/2026; la fecha real es 20/02/2026 (ya corregida en Firestore el 02/10/2026). Corregirla también en el Sheet.
- Crear la cuenta del operario (consola de Firebase → Add user) y darle perfil en Configuración.
- Facturas de septiembre 2026: correr "Actualizar agua y periodos" (siguen ligadas a lecturas del 29/09, que se borraron).
- Tubo 10: lectura anómala del 29/02/2024 (99,998.222 m³) importada del Sheet; confirmar el valor real.
- Depósitos de los locales 6, 7 y 15: hay $6,300 de 2022 sin asignar; el ajuste de Setter Bistro del 15/08/2025 difiere por $6 entre Simplifi y la tabla de Gabriel.

## Seguridad (auditoría 01/10/2026)

- Firebase Auth: el alta de usuarios desde el cliente está **desactivada** (Authentication → Settings → User actions). Los usuarios nuevos se crean en la consola (Authentication → Users → Add user) y luego su perfil en `users/{uid}`.
- La API key del navegador está restringida por HTTP referrer a `fabrica.la`, `www.fabrica.la`, `fabrica-399f2.firebaseapp.com`, `localhost:8000` y `127.0.0.1:8000`. Si se prueba en local con otro puerto o se agrega un dominio, hay que añadirlo en Google Cloud → APIs y servicios → Credenciales.
- Ya no existen: el despliegue viejo de `Code.gs` (archivado), los Workers `fabrica-admin-auth` y `solitary-bar-15bb` (borrados; en Cloudflare solo queda `gbd-mx`, que es de gbd.mx), la cuenta `operario@fabrica.la`. La contraseña de `admin@fabrica.la` se cambió.
