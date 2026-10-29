import {
  Jurado,
  MAX_MENSAJE,
  Participante,
  claveCorreo,
  esCorreoValido,
  resultadosDe,
  validarVoto
} from './concurso.util';

const participante = (id: string, nombre: string, orden: number): Participante => ({ id, nombre, mensaje: '', foto: '', orden });
const jurado = (correo: string, participanteId?: string, mensaje = 'Muy creativo'): Jurado => ({
  correo,
  voto: participanteId ? { participanteId, mensaje } : null
});

const PARTICIPANTES = [participante('a', 'VAMPIRO', 1), participante('b', 'PIRATA', 2), participante('c', 'JOKER', 3)];

describe('concurso: correos', () => {
  it('el mismo correo escrito distinto es la misma clave', () => {
    expect(claveCorreo('  Ana@Gestium.COM ')).toBe('ana@gestium.com');
  });

  it('valida el formato del correo', () => {
    expect(esCorreoValido('ana@gestium.com')).toBe(true);
    expect(esCorreoValido('ana@gestium')).toBe(false);
    expect(esCorreoValido('ana gestium.com')).toBe(false);
    expect(esCorreoValido('a/b@gestium.com')).toBe(false);
    expect(esCorreoValido('')).toBe(false);
  });
});

describe('concurso: voto', () => {
  it('pide el disfraz y un mensaje', () => {
    expect(validarVoto(null, 'bonito')).toBe('Elige el disfraz por el que votas.');
    expect(validarVoto('a', '  ')).toBe('Escribe un mensaje para tu voto.');
    expect(validarVoto('a', 'ok')).toBe('Escribe un mensaje para tu voto.');
    expect(validarVoto('a', 'Muy bien logrado')).toBe(null);
  });

  it('limita el largo del mensaje', () => {
    expect(validarVoto('a', 'x'.repeat(MAX_MENSAJE))).toBe(null);
    expect(validarVoto('a', 'x'.repeat(MAX_MENSAJE + 1))).toBe(`El mensaje no puede pasar de ${MAX_MENSAJE} caracteres.`);
  });
});

describe('concurso: resultados', () => {
  it('cuenta los votos y ordena de mas a menos', () => {
    const r = resultadosDe(PARTICIPANTES, [jurado('1@x.com', 'b'), jurado('2@x.com', 'b'), jurado('3@x.com', 'c'), jurado('4@x.com')]);
    expect(r.porParticipante.map(x => x.participante.nombre + ':' + x.votos).join(',')).toBe('PIRATA:2,JOKER:1,VAMPIRO:0');
    expect(r.votaron).toBe(3);
    expect(r.totalJurados).toBe(4);
  });

  it('el ganador es quien tiene mas votos', () => {
    const r = resultadosDe(PARTICIPANTES, [jurado('1@x.com', 'b'), jurado('2@x.com', 'b'), jurado('3@x.com', 'c')]);
    expect(r.ganadores.map(g => g.nombre).join(',')).toBe('PIRATA');
    expect(r.empate).toBe(false);
  });

  it('si hay empate en el primer lugar salen todos', () => {
    const r = resultadosDe(PARTICIPANTES, [jurado('1@x.com', 'a'), jurado('2@x.com', 'c')]);
    expect(r.ganadores.map(g => g.nombre).join(',')).toBe('VAMPIRO,JOKER');
    expect(r.empate).toBe(true);
  });

  it('sin votos no hay ganador', () => {
    const r = resultadosDe(PARTICIPANTES, [jurado('1@x.com'), jurado('2@x.com')]);
    expect(r.ganadores.length).toBe(0);
    expect(r.empate).toBe(false);
    expect(r.votaron).toBe(0);
  });

  it('los mensajes salen sin el correo de quien los dejo', () => {
    const r = resultadosDe(PARTICIPANTES, [jurado('secreto@x.com', 'a', 'Me encantó la capa')]);
    expect(r.mensajes.length).toBe(1);
    expect(r.mensajes[0].participante).toBe('VAMPIRO');
    expect(r.mensajes[0].mensaje).toBe('Me encantó la capa');
    expect(JSON.stringify(r.mensajes).includes('secreto')).toBe(false);
  });

  it('un voto para alguien que ya no esta cuenta como voto, pero no se muestra', () => {
    const r = resultadosDe(PARTICIPANTES, [jurado('1@x.com', 'zzz')]);
    expect(r.votaron).toBe(1);
    expect(r.mensajes.length).toBe(0);
    expect(r.ganadores.length).toBe(0);
  });
});
