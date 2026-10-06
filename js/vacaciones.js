// Vacaciones del personal. Se capturan en el Calendario (calendario_eventos, tipo «vacaciones», con personaId)
// y Personal las cuenta. Los usan calendarios/index.html y personal/index.html.
import { esFeriado } from './feriados.js?v=20261005-5';

const DESCANSO_DEFAULT = [0]; // domingo
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Persona de un evento de vacaciones, en este orden:
// 1. la ligada (personaId; el admin la elige en el Calendario o en Personal);
// 2. la única persona cuyo nombre de pila aparece en el título o la nota (eventos viejos o capturados por el operario);
// 3. la persona ligada al usuario que capturó el evento (usuarios = perfiles de users con uid y email).
// Devuelve { persona, adivinada } o null.
export function personaDeVacacion(ev, personas, usuarios = []) {
    const ligada = ev.personaId && personas.find(p => p.id === ev.personaId);
    if (ligada) return { persona: ligada, adivinada: false };
    const texto = ` ${norm(`${ev.titulo || ''} ${ev.nota || ''}`).replace(/[^a-z0-9]+/g, ' ')} `;
    const hallados = personas.filter(p => { const pila = norm(p.nombre).split(/\s+/)[0]; return pila && texto.includes(` ${pila} `); });
    if (hallados.length === 1) return { persona: hallados[0], adivinada: true };
    if (hallados.length) return null;
    const autor = ev.creadoPor && usuarios.find(u => u.email && u.email.toLowerCase() === String(ev.creadoPor).toLowerCase());
    const suya = autor && personas.find(p => p.uid === autor.uid);
    return suya ? { persona: suya, adivinada: true } : null;
}

// Días de un evento que cuentan como vacaciones: sin los días de descanso de la persona ni feriados oficiales
export function diasDeVacacion(ev, persona) {
    const descanso = persona?.descanso?.length ? persona.descanso : DESCANSO_DEFAULT;
    const fin = ev.fin && ev.fin >= ev.inicio ? ev.fin : ev.inicio;
    const dias = [];
    for (let d = deISO(ev.inicio); iso(d) <= fin; d.setDate(d.getDate() + 1)) {
        if (!descanso.includes(d.getDay()) && !esFeriado(iso(d))) dias.push(iso(d));
    }
    return dias;
}

export const descansoDe = persona => persona?.descanso?.length ? persona.descanso : DESCANSO_DEFAULT;

function deISO(f) { const [y, m, d] = f.split('-').map(Number); return new Date(y, m - 1, d); }
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
