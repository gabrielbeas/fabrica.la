// Encabezado único de todos los exports (PDF/impresión) del panel (18/11/2026), tomado de la «Hoja de datos»:
// título en Roboto Black 18 px, una o dos líneas grises de 10.5 px debajo, logo a la derecha (logo-export.png, con margen para que no se
// corte) y línea gruesa de tinta debajo. Todo export arma su encabezado con `cabeceraExport` y pega `CSS_CABECERA` en sus estilos.
// `titulo` y `lineas` van ya escapados (HTML); `logo` es la ruta de `css/logo-export.png` relativa a la página que imprime.

export const CSS_CABECERA = `
.lf-cab { display: flex !important; flex-direction: row-reverse; justify-content: space-between; align-items: center; gap: 16px; border-bottom: 2px solid #1b2430; padding: 0 0 10px !important; margin: 0 0 8px !important; font-family: Roboto, Arial, sans-serif; color: #1b2430; }
.lf-cab img { height: 42px !important; width: auto !important; display: block; flex: none; margin: 0 !important; }
.lf-cab h1 { margin: 0 0 3px !important; padding: 0 !important; font-size: 18px !important; line-height: 1.15 !important; font-weight: 900 !important; text-align: left !important; letter-spacing: 0 !important; text-transform: none !important; color: #1b2430 !important; }
.lf-cab p { margin: 0 !important; padding: 0 !important; color: #5f6670 !important; font-size: 10.5px !important; line-height: 1.35 !important; text-align: left !important; font-weight: 400 !important; }`;

export const cabeceraExport = (titulo, lineas, logo) =>
    `<div class="lf-cab"><img src="${logo}" alt="La Fábrica de Chocolate"><div><h1>${titulo}</h1>${(lineas || []).filter(Boolean).map(l => `<p>${l}</p>`).join('')}</div></div>`;

// Nombre de archivo único de todo export (el que sugiere el navegador al guardar como PDF), 18/11/2026:
//   «Documento · Local N · Nombre · AAAA-MM-DD»   (sin los caracteres que Windows no admite)
// `partes` = lo que va antes de la fecha (se omiten las vacías); `fecha` = la del documento (por defecto, hoy).
export const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const nombreArchivo = (partes, fecha = hoyISO()) => [...partes, fecha]
    .filter(x => x !== undefined && x !== null && String(x).trim() !== '')
    .map(x => String(x).trim()).join(' · ').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ');
