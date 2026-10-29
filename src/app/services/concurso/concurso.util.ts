// Concurso de disfraces (temporal): participantes, jurados y conteo de votos.
// Sin Angular ni Firestore, para poder probarlo.
//
// Cada jurado se identifica con su correo, que es la clave de su documento:
// así hay un solo voto por correo. El correo no se verifica (no se crean
// cuentas de la app para los jurados): la lista de jurados la arma el admin y
// solo esos correos pueden votar.

export const COLECCION_PARTICIPANTES = 'concurso_participantes';
export const COLECCION_JURADOS = 'concurso_jurados';
export const COLECCION_ESTADO = 'concurso_estado';
export const DOC_ESTADO = 'actual';

export const MAX_MENSAJE = 500;
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

export interface VotoJurado {
  participanteId: string;
  mensaje: string;
  fecha?: Date | any;
}

export interface Jurado {
  correo: string;
  voto: VotoJurado | null;
  creado?: Date | any;
}

// "  Ana@Gestium.COM " -> "ana@gestium.com": el mismo correo escrito distinto
// es el mismo jurado (y la misma clave de documento).
export function claveCorreo(correo: string): string {
  return (correo ?? '').trim().toLowerCase();
}

export function esCorreoValido(correo: string): boolean {
  const c = claveCorreo(correo);
  // Sin '/' ni espacios: el correo es el id del documento.
  return c.length <= 120 && /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(c);
}

export function validarVoto(participanteId: string | null | undefined, mensaje: string | null | undefined): string | null {
  if (!participanteId) return 'Elige el disfraz por el que votas.';
  const texto = (mensaje ?? '').trim();
  if (texto.length < 3) return 'Escribe un mensaje para tu voto.';
  if (texto.length > MAX_MENSAJE) return `El mensaje no puede pasar de ${MAX_MENSAJE} caracteres.`;
  return null;
}

export interface ResultadoParticipante {
  participante: Participante;
  votos: number;
}

export interface MensajeVoto {
  participante: string; // a quien se le dejo
  mensaje: string; // sin el correo de quien lo escribio
}

export interface ResultadoConcurso {
  porParticipante: ResultadoParticipante[]; // de mas a menos votos
  votaron: number;
  totalJurados: number;
  ganadores: Participante[]; // mas de uno si hay empate en el primer lugar
  empate: boolean;
  mensajes: MensajeVoto[];
}

export function resultadosDe(participantes: Participante[], jurados: Jurado[]): ResultadoConcurso {
  const votos = new Map<string, number>();
  const mensajes: MensajeVoto[] = [];
  const nombres = new Map(participantes.map(p => [p.id, p.nombre]));
  let votaron = 0;

  for (const j of jurados) {
    if (!j.voto) continue;
    votaron++;
    votos.set(j.voto.participanteId, (votos.get(j.voto.participanteId) ?? 0) + 1);
    const mensaje = (j.voto.mensaje ?? '').trim();
    // Un voto para alguien que ya no esta en la lista cuenta para el total, pero no se muestra.
    const nombre = nombres.get(j.voto.participanteId);
    if (mensaje && nombre) mensajes.push({ participante: nombre, mensaje });
  }

  const porParticipante = participantes
    .map(participante => ({ participante, votos: (participante.id && votos.get(participante.id)) || 0 }))
    .sort((a, b) => b.votos - a.votos || a.participante.orden - b.participante.orden);

  const maximo = porParticipante[0]?.votos ?? 0;
  const ganadores = maximo > 0 ? porParticipante.filter(r => r.votos === maximo).map(r => r.participante) : [];

  return { porParticipante, votaron, totalJurados: jurados.length, ganadores, empate: ganadores.length > 1, mensajes };
}
