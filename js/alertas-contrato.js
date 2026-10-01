// Alertas de contratos: vigencia (fin de contrato), incremento de renta y depósito (saldo por pagar).
// Lo usan locales/index.html (punto de color) y locales/caratula.html (detalle).

export const VENTANA_DIAS = 90;
export const PESO_NIVEL = { vencido: 0, '30': 1, '60': 2, '90': 3 };
export const COLOR_NIVEL = { vencido: '#c62828', '30': '#ef6c00', '60': '#f9a825', '90': '#667eea' };
export const TEXTO_NIVEL = { vencido: 'Vencido', '30': 'Próximos 30 días', '60': '31 a 60 días', '90': '61 a 90 días' };

export const hoyISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const diasHasta = f => Math.round((new Date(f + 'T00:00:00') - new Date(hoyISO() + 'T00:00:00')) / 86400000);
export const cuandoTxt = d => d < 0 ? `hace ${-d} días` : d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`;
export const nivelDe = d => d < 0 ? 'vencido' : d <= 30 ? '30' : d <= 60 ? '60' : '90';
const esFecha = f => /^\d{4}-\d{2}-\d{2}$/.test(f || '');

// Devuelve { lista, saldo, peor, total }
//   lista: eventos con fecha dentro de la ventana o ya pasados, del más urgente al menos
//   peor: nivel más urgente (o null si no hay nada)
export function alertasContrato(c) {
    const ev = [];
    // Generan alerta: vigencia del contrato (fin), incremento de renta y depósito (saldo por pagar).
    if (esFecha(c.fin)) ev.push({ fecha: c.fin, tipo: 'Fin de contrato', det: c.plazo ? `Plazo ${c.plazo}` : '' });
    if (esFecha(c.incremento)) ev.push({ fecha: c.incremento, tipo: 'Incremento de renta', det: c.incrementoTipo ? `Tipo ${c.incrementoTipo}` : '' });
    const lista = ev.map(e => ({ ...e, dias: diasHasta(e.fecha) }))
        .filter(e => e.dias <= VENTANA_DIAS)
        .map(e => ({ ...e, nivel: nivelDe(e.dias) }))
        .sort((a, b) => a.dias - b.dias);
    const saldo = typeof c.porPagar === 'number' && c.porPagar > 0 ? c.porPagar : 0;
    const peor = lista.length ? lista[0].nivel : (saldo ? '60' : null);
    return { lista, saldo, peor, total: lista.length + (saldo ? 1 : 0) };
}
