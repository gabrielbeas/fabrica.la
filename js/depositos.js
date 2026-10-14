// Depósito en garantía de un contrato: una sola cuenta para toda la app (Depósitos, carátula, alertas y requerimiento de cobro).
// Base del depósito (campo `depositoBase` del contrato):
//   'con' (por defecto) = renta vigente CON mantenimiento incluido, es decir el `total` del contrato (contratos nuevos, donde ya va integrado);
//   'sin' = renta SIN mantenimiento (contratos donde el mantenimiento va desglosado de la renta): total ÷ (1 + mantenimientoPct), o total − mantenimientoMonto.
// requerido = meses de depósito × base (sin IVA); pagado = pagos que cuentan (los `compartido` no suman); saldo = requerido − pagado.
// Todo se calcula en vivo del contrato: no se guarda ningún total aparte que pueda desfasarse.
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

export const BASES_DEPOSITO = {
  con: 'Renta con mantenimiento incluido',
  sin: 'Renta sin mantenimiento (desglosado)'
};

/** Renta sin mantenimiento de un contrato (si no tiene mantenimiento, es el total) */
export function rentaSinMantenimiento(c) {
  const total = Number(c.total) || 0;
  const pct = Number(c.mantenimientoPct) || 0;
  if (pct > 0) return r2(total / (1 + pct));
  const monto = Number(c.mantenimientoMonto) || 0;
  return monto > 0 ? r2(total - monto) : r2(total);
}

export function cuentaDeposito(c) {
  const pagos = [...(c.historialDepositos || [])].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  const cuentan = pagos.filter(p => p.tipo !== 'compartido');
  const pagado = r2(cuentan.reduce((s, p) => s + (p.monto || 0), 0));
  const meses = Number(c.mesesDeposito) || 0;
  const baseClave = c.depositoBase === 'sin' ? 'sin' : 'con';
  const rentaCon = r2(c.total || 0), rentaSin = rentaSinMantenimiento(c);
  const base = baseClave === 'sin' ? rentaSin : rentaCon;
  const requerido = r2(meses * base);
  return {
    pagos, cuentan, pagado, meses, baseClave, base, rentaCon, rentaSin, requerido, saldo: r2(requerido - pagado),
    primero: cuentan.length ? cuentan[0].fecha : null,
    ultimo: cuentan.length ? cuentan[cuentan.length - 1].fecha : null
  };
}
