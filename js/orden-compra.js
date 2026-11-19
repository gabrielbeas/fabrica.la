// Orden de compra a un proveedor: cuentas, hoja para imprimir (PDF vía impresión) y correo desde admin@fabrica.la.
// El catálogo (productos_compra), los proveedores y las órdenes (ordenes_compra) viven en Firestore; aquí solo está la lógica común.
import { imprimirHojas, LOGO_URL } from './facturacion.js?v=20261118-4';
import { CSS_CABECERA, cabeceraExport, nombreArchivo, cssDoc } from './export-cabecera.js?v=20261118-4';
import { abrirCorreo, CORREO_REMITENTE } from './correos-contrato.js?v=20261014-6';

export const IVA_COMPRAS = 0.16;
const r2 = n => (x => (x < 0 ? -1 : 1) * Math.round(Number((Math.abs(x) * 100).toPrecision(13))) / 100 + 0)(Number(n) || 0);
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const dinero = n => (r2(n) < 0 ? '-$' : '$') + Math.abs(r2(n)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fechaLarga = iso => { const [y, m, d] = String(iso || '').split('-'); return y && m && d ? `${+d} de ${MESES[+m - 1]} de ${y}` : (iso || ''); };

/** Precio con IVA de una unidad de compra */
export const conIva = precioSinIva => r2((Number(precioSinIva) || 0) * (1 + IVA_COMPRAS));

/** Totales de una lista de líneas [{cantidad, precioSinIva}] */
export function totalesOrden(lineas) {
  const subtotal = r2(lineas.reduce((s, l) => s + r2((Number(l.cantidad) || 0) * (Number(l.precioSinIva) || 0)), 0));
  const iva = r2(subtotal * IVA_COMPRAS);
  return { subtotal, iva, total: r2(subtotal + iva) };
}

/** Hoja de la orden de compra (carta vertical) */
export function htmlOrdenCompra(o, prov) {
  const t = totalesOrden(o.lineas);
  const correos = (prov.correos || []).filter(Boolean).join(' · ');
  return `<div class="oc">
    <style>
      ${cssDoc('.oc')}
      ${CSS_CABECERA}
      .oc .lf-cab { margin-bottom: 14px !important; }
      .oc .cajas { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
      .oc .caja { border: 1px solid #dfe3e8; border-radius: 6px; padding: 8px 12px; }
      .oc .caja .k { font-size: 8.5px; text-transform: uppercase; letter-spacing: .05em; color: #5f6670; margin-bottom: 2px; }
      .oc table { margin: 0 0 10px; }
      .oc td .g { color: #5f6670; font-size: 9.5px; }
      .oc tr.sub td { border-bottom: none; padding: 2px 6px; }
    </style>
    ${cabeceraExport('Orden de compra', [`Folio ${esc(o.folio)}`, `Guadalajara, Jalisco, a ${esc(fechaLarga(o.fecha))}`], LOGO_URL)}
    <div class="cajas">
      <div class="caja"><div class="k">Proveedor</div><strong>${esc(prov.nombre)}</strong>${prov.rfc ? `<br><span class="gris">RFC ${esc(prov.rfc)}</span>` : ''}${prov.contacto ? `<br>Atención: ${esc(prov.contacto)}` : ''}${correos ? `<br><span class="gris">${esc(correos)}</span>` : ''}${prov.telefono ? `<br><span class="gris">Tel. ${esc(prov.telefono)}</span>` : ''}${prov.numeroCliente ? `<br><span class="gris">Cliente ${esc(prov.numeroCliente)}</span>` : ''}</div>
      <div class="caja"><div class="k">Solicita</div><strong>LAFABDECHOC S DE RL DE CV</strong><br>La Fábrica de Chocolate${o.entrega ? `<br><span class="gris">Entregar en: ${esc(o.entrega)}</span>` : ''}</div>
    </div>
    <table>
      <thead><tr><th>Producto</th><th>Clave</th><th>Unidad</th><th class="n">Cantidad</th><th class="n">Precio s/IVA</th><th class="n">Importe</th></tr></thead>
      <tbody>
        ${o.lineas.map(l => `<tr><td>${esc(l.nombre)}${l.marca ? `<div class="g">${esc(l.marca)}${l.contenido ? ' · ' + esc(l.contenido) : ''}</div>` : (l.contenido ? `<div class="g">${esc(l.contenido)}</div>` : '')}</td><td>${esc(l.clave || '')}</td><td>${esc(l.unidad || '')}</td><td class="n">${esc(String(l.cantidad))}</td><td class="n">${dinero(l.precioSinIva)}</td><td class="n">${dinero((Number(l.cantidad) || 0) * (Number(l.precioSinIva) || 0))}</td></tr>`).join('')}
        <tr class="sub"><td colspan="5" class="n">Subtotal</td><td class="n">${dinero(t.subtotal)}</td></tr>
        <tr class="sub"><td colspan="5" class="n">IVA 16%</td><td class="n">${dinero(t.iva)}</td></tr>
        <tr class="tot"><td colspan="5" class="n">Total</td><td class="n">${dinero(t.total)}</td></tr>
      </tbody>
    </table>
    ${o.notas ? `<div style="margin:10px 0"><strong>Notas:</strong> ${esc(o.notas).replace(/\n/g, '<br>')}</div>` : ''}
    <div class="nota">Favor de confirmar la recepción de esta orden y la fecha de entrega por correo.</div>
    <div class="firmas"><div>Administración<br><span class="gris">LAFABDECHOC S DE RL DE CV</span></div><div>Recibe el proveedor<br><span class="gris">Nombre, firma y fecha</span></div></div>
  </div>`;
}

/** Abre el diálogo de impresión (Guardar como PDF) con la orden */
export function imprimirOrden(o, prov) {
  imprimirHojas(htmlOrdenCompra(o, prov), nombreArchivo(['Orden de compra', o.folio, prov.nombre], o.fecha), { vertical: true });
}

/** Mensaje de correo de la orden (el PDF se adjunta a mano) */
export function mensajeOrden(o, prov) {
  const t = totalesOrden(o.lineas);
  return {
    asunto: `Orden de compra ${o.folio} · La Fábrica de Chocolate`,
    cuerpo: `Estimados ${prov.nombre}${prov.contacto ? ` (${prov.contacto})` : ''}:

Les hacemos llegar la orden de compra ${o.folio} del ${fechaLarga(o.fecha)}:

${o.lineas.map(l => `- ${l.cantidad} ${l.unidad || ''} · ${l.nombre}${l.clave ? ` (${l.clave})` : ''}`).join('\n')}

Total: ${dinero(t.total)} con IVA.${o.entrega ? `\nEntrega en: ${o.entrega}.` : ''}

Favor de confirmar la recepción de esta orden y la fecha de entrega por este mismo medio. Si detectan alguna diferencia en productos, cantidades o precios, favor de hacérnoslo saber antes de surtirla.

Saludos,
Administración
LAFABDECHOC S DE RL DE CV`
  };
}

/** Abre Gmail (admin@fabrica.la) con la orden preparada para los correos del proveedor */
export function correoOrden(o, prov) {
  const m = mensajeOrden(o, prov);
  return abrirCorreo({ para: (prov.correos || []).filter(Boolean), asunto: m.asunto, cuerpo: m.cuerpo });
}

export { CORREO_REMITENTE };
