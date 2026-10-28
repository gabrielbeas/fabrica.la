// Reporte completo de un contrato (botón «EXPORTAR REPORTE» de la carátula): junta en un solo documento todo lo del
// arrendatario que el panel guarda: datos y condiciones, renta, pagos de renta, depósito, facturas, agua, seguro, CFE,
// historial de cambios. Se arma al momento con lo que hay en Firestore y se imprime en hoja carta (Guardar como PDF).
import { db } from './auth.js?v=20261023-1';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { cuentaDeposito, BASES_DEPOSITO } from './depositos.js?v=20261023-1';
import { LOGO_URL } from './facturacion.js?v=20261013-1';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dinero = n => typeof n === 'number' && Number.isFinite(n) ? (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
const numero = (n, d = 3) => typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }) : '';
const fecha = f => {
  if (!f) return '';
  if (typeof f.toDate === 'function') f = f.toDate();
  if (f instanceof Date) return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f);
  return m ? `${+m[3]} ${MESES[+m[2] - 1]} ${m[1]}` : String(f);
};
const mesTxt = ym => { const m = /^(\d{4})-(\d{2})$/.exec(ym || ''); return m ? `${MESES[+m[2] - 1]} ${m[1]}` : (ym || ''); };
const ESTADOS = { pendiente: 'Pendiente', pagado: 'Pagado', pago_tarde: 'Pago tarde', en_proceso: 'En proceso' };

const seccion = (titulo, cuerpo) => `<section><h2>${esc(titulo)}</h2>${cuerpo}</section>`;
const datos = pares => {
  const f = pares.filter(([, v]) => v !== undefined && v !== null && v !== '');
  return f.length ? `<dl>${f.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>` : '<p class="vacio">Sin datos.</p>';
};
// cabeceras: [{ t, num }]; filas: arreglos de HTML ya escapado
const tabla = (cabeceras, filas, pie = '') => filas.length
  ? `<table><thead><tr>${cabeceras.map(c => `<th${c.num ? ' class="num"' : ''}>${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${filas.map(r => `<tr>${r.map((v, i) => `<td${cabeceras[i]?.num ? ' class="num"' : ''}>${v}</td>`).join('')}</tr>`).join('')}</tbody>${pie}</table>`
  : '<p class="vacio">Sin registros.</p>';

// Barras de m³ por lectura (SVG sencillo)
function graficaAgua(lects) {
  const v = lects.filter(l => typeof l.consumo === 'number' && l.consumo >= 0);
  if (v.length < 2) return '';
  const W = 700, H = 110, izq = 34, abajo = 16, max = Math.max(1, ...v.map(l => l.consumo)), bw = (W - izq) / v.length;
  const barras = v.map((l, i) => {
    const h = (H - abajo - 6) * l.consumo / max;
    return `<rect x="${izq + i * bw + 1}" y="${H - abajo - h}" width="${Math.max(1, bw - 2)}" height="${h}" fill="#17739f"/>`;
  }).join('');
  const cada = Math.ceil(v.length / 12);
  const etiquetas = v.map((l, i) => i % cada === 0 ? `<text x="${izq + i * bw + bw / 2}" y="${H - 4}" text-anchor="middle" font-size="7" fill="#5f6670">${esc(mesTxt(l.fecha.slice(0, 7)))}</text>` : '').join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="graf" role="img" aria-label="Consumo de agua por lectura"><text x="${izq - 4}" y="12" text-anchor="end" font-size="7" fill="#5f6670">${numero(max, 0)}</text><text x="${izq - 4}" y="${H - abajo}" text-anchor="end" font-size="7" fill="#5f6670">0</text><line x1="${izq}" x2="${W}" y1="${H - abajo}" y2="${H - abajo}" stroke="#dfe3e8"/>${barras}${etiquetas}</svg><p class="nota">m³ consumidos en cada lectura.</p>`;
}

const ESTILO = `#hoja-reporte { display: none; }
@page { size: letter portrait; margin: 14mm 14mm; }
@media print {
  body > *:not(#hoja-reporte) { display: none !important; }
  #hoja-reporte { display: block !important; font: 10.5px/1.4 Roboto, Arial, sans-serif; color: #1b2430; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
#hoja-reporte .cab { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1f4e79; padding-bottom: 8px; margin-bottom: 10px; }
#hoja-reporte .cab img { height: 36px; }
#hoja-reporte h1 { margin: 0; font-size: 18px; font-weight: 900; }
#hoja-reporte .sub { color: #5f6670; font-size: 10.5px; margin-top: 2px; }
#hoja-reporte h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #1f4e79; margin: 14px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #dfe3e8; break-after: avoid; }
#hoja-reporte section { break-inside: auto; }
#hoja-reporte .res { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 4px 0 8px; }
#hoja-reporte .res div { border: 1px solid #dfe3e8; border-radius: 6px; padding: 6px 8px; }
#hoja-reporte .res span { display: block; font-size: 8.5px; text-transform: uppercase; letter-spacing: .05em; color: #5f6670; }
#hoja-reporte .res b { font-size: 13px; font-variant-numeric: tabular-nums; }
#hoja-reporte .res small { display: block; font-size: 8.5px; color: #5f6670; }
#hoja-reporte dl { display: grid; grid-template-columns: 150px 1fr; gap: 2px 12px; margin: 0; }
#hoja-reporte dt { color: #5f6670; }
#hoja-reporte dd { margin: 0; font-weight: 600; }
#hoja-reporte table { width: 100%; border-collapse: collapse; }
#hoja-reporte th { text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: .05em; color: #5f6670; border-bottom: 1px solid #1b2430; padding: 4px 5px; }
#hoja-reporte td { padding: 3px 5px; border-bottom: 1px solid #e6e9ee; vertical-align: top; }
#hoja-reporte tr { break-inside: avoid; }
#hoja-reporte thead { display: table-header-group; }
#hoja-reporte .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
#hoja-reporte tfoot td { font-weight: 700; border-top: 1px solid #1b2430; border-bottom: 0; }
#hoja-reporte tr.total td { font-weight: 700; background: #f2f4f7; }
#hoja-reporte .vacio, #hoja-reporte .nota { color: #5f6670; font-size: 9.5px; margin: 4px 0 0; }
#hoja-reporte .graf { width: 100%; height: auto; margin-top: 6px; }
#hoja-reporte .pie { margin-top: 14px; font-size: 9px; color: #5f6670; }`;

/**
 * Genera e imprime el reporte del contrato.
 * c: contrato con `id`; boton: botón que se deshabilita mientras se arma;
 * opc.filasRenta / opc.explicaVigente: HTML del historial de renta tal como lo calcula la carátula (periodos calculados).
 */
export async function exportarReporteContrato(c, boton, opc = {}) {
  const texto = boton?.textContent;
  if (boton) { boton.disabled = true; boton.textContent = 'Preparando reporte…'; }
  try {
    const tubos = (c.facturacion?.tubos || []).map(t => String(t.tubo)).filter(Boolean);
    const valoresTubo = [...new Set(tubos.flatMap(t => [t, Number(t)].filter(v => v === v)))];
    const [sFact, sHist, sLect] = await Promise.all([
      getDocs(query(collection(db, 'facturas'), where('contratoId', '==', c.id))),
      getDocs(collection(db, 'contratos', c.id, 'historial')),
      valoresTubo.length ? getDocs(query(collection(db, 'agua_lecturas'), where('tubo', 'in', valoresTubo.slice(0, 30)))) : Promise.resolve({ docs: [] })
    ]);
    const facturas = sFact.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.mes || '').localeCompare(b.mes || ''));
    const historial = sHist.docs.map(d => d.data()).sort((a, b) => (b.en?.seconds || 0) - (a.en?.seconds || 0));
    const lecturas = sLect.docs.map(d => d.data()).filter(l => l.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pagos = [...(c.pagosRenta || [])].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    const dep = cuentaDeposito(c);
    const hoy = new Date();

    const totalPagado = pagos.reduce((s, p) => s + (p.monto || 0), 0);
    const aguaM3 = lecturas.reduce((s, l) => s + (typeof l.consumo === 'number' && l.consumo > 0 ? l.consumo : 0), 0);
    const aguaImp = lecturas.reduce((s, l) => s + (typeof l.importe === 'number' ? l.importe : 0), 0);
    const nombre = c.nombreComercial || c.razonSocial || c.id;

    const resumen = `<div class="res">
      <div><span>Renta mensual vigente</span><b>${dinero(c.total)}</b><small>${c.totalIva ? dinero(c.totalIva) + ' con IVA' : ''}</small></div>
      <div><span>Pagado de renta</span><b>${dinero(totalPagado)}</b><small>${pagos.length} pago${pagos.length === 1 ? '' : 's'}, con IVA</small></div>
      <div><span>Depósito</span><b>${dinero(dep.pagado)}</b><small>${dep.saldo > 0.005 ? 'por pagar ' + dinero(dep.saldo) : 'cubierto'} · requerido ${dinero(dep.requerido)}</small></div>
      <div><span>Agua cobrada</span><b>${dinero(aguaImp)}</b><small>${numero(aguaM3, 1)} m³ en ${lecturas.length} lecturas</small></div></div>`;

    const contrato = seccion('Arrendatario y contrato', datos([
      ['Razón social', esc(c.razonSocial)], ['RFC', esc(c.rfc)], ['Nombre comercial', esc(c.nombreComercial)],
      [(c.locales || []).length > 1 ? 'Locales' : 'Local', esc((c.locales || []).join(', '))], ['Superficie', c.m2 ? esc(c.m2) + ' m²' : ''],
      ['Giro', esc(c.giro)], ['Representante', esc(c.representante)], ['Teléfono', esc(c.telefono)],
      ['Dirección', (c.direccion || []).map(esc).join('<br>')], ['Acceso al local', esc(c.acceso)],
      ['Notificaciones', (c.correosNotificacion || []).map(esc).join(' · ')], ['Documento', esc(c.documento)],
      ['Estado', esc(c.estado)], ['Firma', fecha(c.firma)], ['Plazo', esc(c.plazo)], ['Inicio', fecha(c.inicio)], ['Fin', fecha(c.fin)],
      ['Próximo incremento', fecha(c.incremento) + (c.incrementoTipo ? ` (${esc(c.incrementoTipo)})` : '')], ['Nota del incremento', esc(c.incrementoNota)],
      ['Fecha límite de pago', esc(c.fechaLimite)], ['Periodo de gracia', esc(c.periodoGracia)], ['Moratorios', esc(c.moratoriosContrato)],
      ['Terminación anticipada', esc(c.terminacionAnticipada)], ['Garantía', esc(c.garantia)],
      ['Obligado solidario', (c.obligadosSolidarios || []).map(esc).join('<br>')], ['Detalle de la garantía', esc(c.garantiaDetalle)],
      ['Seguros requeridos', esc(c.segurosRequeridos)], ['Notas', esc(c.notas)]
    ]));

    const renta = seccion('Historial de renta', c.rentas?.length
      ? `<table><thead><tr><th>Concepto</th><th>Periodo</th><th>Incremento / nota</th><th class="num">Monto mensual</th></tr></thead><tbody>${opc.filasRenta || ''}<tr class="total"><td colspan="3">Renta mensual vigente${opc.explicaVigente || ''}</td><td class="num">${dinero(c.total)}</td></tr></tbody></table>`
      : '<p class="vacio">Sin historial de renta.</p>');

    const cobros = seccion('Pagos de renta recibidos', tabla(
      [{ t: 'Fecha' }, { t: 'Pagó' }, { t: 'Nota' }, { t: 'Importe', num: true }],
      pagos.map(p => [fecha(p.fecha), esc(p.pago), esc([p.nota, p.tags].filter(Boolean).join(' · ')), dinero(p.monto)]),
      pagos.length ? `<tfoot><tr><td colspan="3">Total (${pagos.length} pagos, con IVA, sin depósitos)</td><td class="num">${dinero(totalPagado)}</td></tr></tfoot>` : '')
      + (c.pagosRentaFuente ? `<p class="nota">Fuente: ${esc(c.pagosRentaFuente)}</p>` : ''));

    const depositos = seccion('Depósito en garantía', datos([
      ['Meses de depósito', esc(c.mesesDeposito)], ['Base', esc((BASES_DEPOSITO[dep.baseClave] || '') + ' · ' + dinero(dep.base))],
      ['Requerido', dinero(dep.requerido)], ['Pagado', dinero(dep.pagado)], ['Saldo por pagar', dinero(dep.saldo)],
      ['Primer pago', fecha(dep.primero)], ['Último pago', fecha(dep.ultimo)], ['Nota', esc(c.porPagarNota)]
    ]) + tabla([{ t: 'Fecha' }, { t: 'Pagó' }, { t: 'Banco' }, { t: 'Tipo' }, { t: 'Importe', num: true }],
      [...(c.historialDepositos || [])].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).map(p => [fecha(p.fecha), esc(p.pago), esc(p.banco), esc(p.tipo), dinero(p.monto)])));

    const tipoTot = (f, t) => (f.conceptos || []).filter(x => x.tipo === t).reduce((s, x) => s + (x.total || 0), 0);
    const fa = c.facturacion || {};
    const facturasSec = seccion('Facturas', datos([
      ['Razón social de la factura', esc(fa.razonSocialFactura || c.razonSocial)], ['Concepto de renta', esc(fa.conceptoRenta)], ['Método de pago', esc(fa.metodoPago)],
      ['Correos de envío', (fa.correos || []).map(x => esc(typeof x === 'string' ? x : x.correo || x.email || '')).filter(Boolean).join(' · ')],
      ['Cobra basura', fa.basura ? 'Sí' : 'No'], ['Notas de facturación', esc(fa.notas)]
    ]) + tabla([{ t: 'Mes' }, { t: 'Folio' }, { t: 'Renta', num: true }, { t: 'Agua', num: true }, { t: 'Otros', num: true }, { t: 'Total', num: true }, { t: 'Estado' }, { t: 'Fecha de pago' }],
      facturas.map(f => { const r = tipoTot(f, 'renta'), a = tipoTot(f, 'agua'), otros = Math.round(((f.total || 0) - r - a) * 100) / 100 || 0; return [mesTxt(f.mes), esc(f.folio || ''), dinero(r), dinero(a), dinero(otros), dinero(f.total), esc(ESTADOS[f.estadoPago] || f.estadoPago), fecha(f.fechaPago)]; }),
      facturas.length ? `<tfoot><tr><td colspan="5">${facturas.length} factura${facturas.length === 1 ? '' : 's'} en el panel</td><td class="num">${dinero(facturas.reduce((s, f) => s + (f.total || 0), 0))}</td><td colspan="2"></td></tr></tfoot>` : '')
      + '<p class="nota">El panel guarda las facturas desde que se usa Facturación; el folio aparece cuando se captura en la ficha de la factura.</p>');

    const porAnio = {};
    lecturas.forEach(l => { const a = l.fecha.slice(0, 4); const x = porAnio[a] = porAnio[a] || { n: 0, m3: 0, imp: 0 }; x.n++; if (typeof l.consumo === 'number' && l.consumo > 0) x.m3 += l.consumo; if (typeof l.importe === 'number') x.imp += l.importe; });
    const agua = seccion('Agua', datos([['Tubo(s)', esc(tubos.join(', '))]])
      + (Object.keys(porAnio).length ? tabla([{ t: 'Año' }, { t: 'Lecturas', num: true }, { t: 'm³', num: true }, { t: 'Importe', num: true }],
        Object.entries(porAnio).map(([a, x]) => [a, String(x.n), numero(x.m3, 1), dinero(x.imp)]),
        `<tfoot><tr><td>Total</td><td class="num">${lecturas.length}</td><td class="num">${numero(aguaM3, 1)}</td><td class="num">${dinero(aguaImp)}</td></tr></tfoot>`) : '')
      + graficaAgua(lecturas)
      + tabla([{ t: 'Fecha' }, { t: 'Tubo' }, { t: 'Lectura anterior', num: true }, { t: 'Lectura', num: true }, { t: 'Consumo m³', num: true }, { t: 'Costo m³', num: true }, { t: 'Importe', num: true }],
        lecturas.map(l => [fecha(l.fecha), esc(l.tubo), numero(l.lecturaAnterior), numero(l.lectura), numero(l.consumo), dinero(l.costoM3), dinero(l.importe)]))
      + '<p class="nota">Importes con IVA, al costo por m³ con que quedó grabada cada lectura.</p>');

    const servicios = seccion('CFE, seguro y servicios', datos([
      ['Titular de la luz', esc(c.cfeTitular)], ['No. de servicio', esc(c.cfeServicio)], ['RMU', esc(c.cfeRmu)], ['Cuenta', esc(c.cfeCuenta)], ['Domicilio del servicio', esc(c.cfe)],
      ['Aseguradora', esc(c.seguro?.aseguradora)], ['Póliza', esc(c.seguro?.poliza)], ['A nombre de', esc(c.seguro?.nombre)], ['Vigencia del seguro', fecha(c.seguro?.vigencia)], ['Telmex', esc(c.telmex)]
    ]));

    const cambios = seccion('Historial de cambios del contrato', tabla([{ t: 'Fecha' }, { t: 'Usuario' }, { t: 'Cambio' }],
      historial.map(h => [fecha(h.en), esc(h.por || h.registradoPor || ''), esc(h.nota || Object.keys(h.despues || {}).join(', '))])));

    const cont = document.getElementById('hoja-reporte') || Object.assign(document.createElement('div'), { id: 'hoja-reporte' });
    if (!cont.isConnected) document.body.appendChild(cont);
    let st = document.getElementById('estilo-hoja-reporte');
    if (!st) { st = document.createElement('style'); st.id = 'estilo-hoja-reporte'; document.head.appendChild(st); }
    st.textContent = ESTILO;
    cont.innerHTML = `<div class="cab"><div><h1>Reporte del contrato · ${esc(nombre)}</h1><div class="sub">${esc(c.razonSocial)} · Local ${esc((c.locales || []).join(', '))} · La Fábrica de Chocolate</div></div><img src="${LOGO_URL}" alt="La Fábrica de Chocolate"></div>`
      + resumen + contrato + renta + cobros + depositos + facturasSec + agua + servicios + cambios
      + `<div class="pie">Generado el ${esc(fecha(hoy))} desde el panel de administración, con los datos guardados a esa fecha.</div>`;
    const img = cont.querySelector('img');
    if (img && !img.complete) await new Promise(r => { img.onload = img.onerror = r; });
    const previo = document.title;
    document.title = `Reporte ${nombre} ${hoy.toISOString().slice(0, 10)}`;
    window.print();
    setTimeout(() => { document.title = previo; }, 1000);
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = texto; }
  }
}
