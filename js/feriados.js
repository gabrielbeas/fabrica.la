// Feriados oficiales (art. 74 de la Ley Federal del Trabajo). Los usan el Calendario y Personal (no cuentan como días de vacaciones).
// Agregar aquí cada año nuevo.
export const FERIADOS = [
    ['2026-01-01', 'Año Nuevo'], ['2026-02-02', 'Día de la Constitución'], ['2026-03-16', 'Natalicio de Benito Juárez'],
    ['2026-05-01', 'Día del Trabajo'], ['2026-09-16', 'Día de la Independencia'], ['2026-11-16', 'Día de la Revolución'],
    ['2026-12-25', 'Navidad'],
    ['2027-01-01', 'Año Nuevo'], ['2027-02-01', 'Día de la Constitución'], ['2027-03-15', 'Natalicio de Benito Juárez'],
    ['2027-05-01', 'Día del Trabajo'], ['2027-06-06', 'Jornada electoral federal'], ['2027-09-16', 'Día de la Independencia'],
    ['2027-11-15', 'Día de la Revolución'], ['2027-12-25', 'Navidad']
];

export const esFeriado = f => FERIADOS.some(([x]) => x === f);
