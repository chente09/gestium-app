// Concurso de disfraces (temporal): participantes, votos y conteo.
// Sin Angular ni Firestore, para poder probarlo.
//
// El enlace de votación se manda solo a personas preseleccionadas y no pide
// cuenta ni correo: cada jurado escribe su nombre y la razón de su voto. Un
// voto por nombre (el nombre es la clave del documento), así que no se puede
// repetir con el mismo nombre; no se verifica que sea quien dice ser.

export const COLECCION_PARTICIPANTES = 'concurso_participantes';
export const COLECCION_VOTOS = 'concurso_votos';
export const COLECCION_ESTADO = 'concurso_estado';
export const DOC_ESTADO = 'actual';

export const MIN_NOMBRE = 2;
export const MAX_NOMBRE = 80;
export const MIN_RAZON = 3;
export const MAX_RAZON = 500;
// Lo que el admin escribe junto a cada participante (qué disfraz es, una frase).
export const MAX_MENSAJE_PARTICIPANTE = 200;
// Las fotos van dentro del documento (como texto): se comprimen antes y se
// rechazan las que aun asi pasan de este tamano.
export const MAX_BYTES_FOTO = 300 * 1024;

export interface Participante {
  id?: string;
  nombre: string;
  mensaje: string;
  foto: string; // data URL (jpeg comprimido)
  orden: number;
  creado?: Date | any;
}

export interface Voto {
  nombre: string; // como lo escribió el jurado
  participanteId: string;
  razon: string;
  fecha?: Date | any;
}

// "  María  José " y "maria jose" son el mismo jurado: la clave sirve de id del
// documento, así que no puede llevar "/" ni quedar vacía.
export function claveNombre(nombre: string): string {
  return (nombre ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/ /g, '-');
}

export function validarVoto(datos: { nombre?: string | null; participanteId?: string | null; razon?: string | null }): string | null {
  const nombre = (datos.nombre ?? '').trim();
  if (nombre.length < MIN_NOMBRE || !claveNombre(nombre)) return 'Escribe tu nombre.';
  if (nombre.length > MAX_NOMBRE) return `Tu nombre no puede pasar de ${MAX_NOMBRE} caracteres.`;
  if (!datos.participanteId) return 'Elige el disfraz por el que votas.';
  const razon = (datos.razon ?? '').trim();
  if (razon.length < MIN_RAZON) return 'Cuéntanos por qué votas por ese disfraz.';
  if (razon.length > MAX_RAZON) return `La razón no puede pasar de ${MAX_RAZON} caracteres.`;
  return null;
}

export interface ResultadoParticipante {
  participante: Participante;
  votos: number;
}

export interface RazonVoto {
  participante: string; // por quien se votó
  razon: string; // sin el nombre de quien la escribió
}

export interface ResultadoConcurso {
  porParticipante: ResultadoParticipante[]; // de mas a menos votos
  votaron: number;
  ganadores: Participante[]; // mas de uno si hay empate en el primer lugar
  empate: boolean;
  razones: RazonVoto[];
}

export function resultadosDe(participantes: Participante[], votos: Voto[]): ResultadoConcurso {
  const conteo = new Map<string, number>();
  const razones: RazonVoto[] = [];
  const nombres = new Map(participantes.map(p => [p.id, p.nombre]));

  for (const v of votos) {
    conteo.set(v.participanteId, (conteo.get(v.participanteId) ?? 0) + 1);
    const razon = (v.razon ?? '').trim();
    // Un voto para alguien que ya no esta en la lista cuenta para el total, pero no se muestra.
    const nombre = nombres.get(v.participanteId);
    if (razon && nombre) razones.push({ participante: nombre, razon });
  }

  const porParticipante = participantes
    .map(participante => ({ participante, votos: (participante.id && conteo.get(participante.id)) || 0 }))
    .sort((a, b) => b.votos - a.votos || a.participante.orden - b.participante.orden);

  const maximo = porParticipante[0]?.votos ?? 0;
  const ganadores = maximo > 0 ? porParticipante.filter(r => r.votos === maximo).map(r => r.participante) : [];

  return { porParticipante, votaron: votos.length, ganadores, empate: ganadores.length > 1, razones };
}
