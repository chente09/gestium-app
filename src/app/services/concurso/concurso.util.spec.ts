import {
  escalar,
  MAX_NOMBRE,
  MAX_RAZON,
  Participante,
  Voto,
  claveNombre,
  resultadosDe,
  validarVoto
} from './concurso.util';

const participante = (id: string, nombre: string, orden: number): Participante => ({ id, nombre, mensaje: '', foto: '', orden });
const voto = (nombre: string, participanteId: string, razon = 'Muy creativo'): Voto => ({ nombre, participanteId, razon });

const PARTICIPANTES = [participante('a', 'VAMPIRO', 1), participante('b', 'PIRATA', 2), participante('c', 'JOKER', 3)];

describe('concurso: tamaño de las fotos', () => {
  it('reduce por el lado mayor y mantiene la proporción', () => {
    expect(JSON.stringify(escalar(4000, 3000, 1600))).toBe('{"ancho":1600,"alto":1200}');
    expect(JSON.stringify(escalar(3000, 4000, 1600))).toBe('{"ancho":1200,"alto":1600}');
  });

  it('nunca agranda una foto pequeña', () => {
    expect(JSON.stringify(escalar(800, 600, 1600))).toBe('{"ancho":800,"alto":600}');
  });

  it('una foto cuadrada o muy angosta no se deforma', () => {
    expect(JSON.stringify(escalar(2000, 2000, 640))).toBe('{"ancho":640,"alto":640}');
    expect(JSON.stringify(escalar(3200, 100, 1600))).toBe('{"ancho":1600,"alto":50}');
  });
});

describe('concurso: clave del jurado', () => {
  it('el mismo nombre escrito distinto es el mismo jurado', () => {
    expect(claveNombre('  María   José ')).toBe('maria-jose');
    expect(claveNombre('maria jose')).toBe('maria-jose');
    expect(claveNombre('MARÍA-JOSÉ')).toBe('maria-jose');
  });

  it('no deja caracteres que no sirven en el id de un documento', () => {
    expect(claveNombre('a/b')).toBe('a-b');
    expect(claveNombre('...')).toBe('');
  });
});

describe('concurso: voto', () => {
  const bueno = { nombre: 'Ana Pérez', participanteId: 'a', razon: 'Muy bien logrado' };

  it('un voto completo es válido', () => {
    expect(validarVoto(bueno)).toBe(null);
  });

  it('pide el nombre', () => {
    expect(validarVoto({ ...bueno, nombre: '  ' })).toBe('Escribe tu nombre.');
    expect(validarVoto({ ...bueno, nombre: 'A' })).toBe('Escribe tu nombre.');
    expect(validarVoto({ ...bueno, nombre: '...' })).toBe('Escribe tu nombre.');
    expect(validarVoto({ ...bueno, nombre: 'x'.repeat(MAX_NOMBRE + 1) })).toBe(`Tu nombre no puede pasar de ${MAX_NOMBRE} caracteres.`);
  });

  it('pide el disfraz', () => {
    expect(validarVoto({ ...bueno, participanteId: null })).toBe('Elige el disfraz por el que votas.');
  });

  it('pide la razón del voto', () => {
    expect(validarVoto({ ...bueno, razon: '  ' })).toBe('Cuéntanos por qué votas por ese disfraz.');
    expect(validarVoto({ ...bueno, razon: 'ok' })).toBe('Cuéntanos por qué votas por ese disfraz.');
    expect(validarVoto({ ...bueno, razon: 'x'.repeat(MAX_RAZON) })).toBe(null);
    expect(validarVoto({ ...bueno, razon: 'x'.repeat(MAX_RAZON + 1) })).toBe(`La razón no puede pasar de ${MAX_RAZON} caracteres.`);
  });
});

describe('concurso: resultados', () => {
  it('cuenta los votos y ordena de mas a menos', () => {
    const r = resultadosDe(PARTICIPANTES, [voto('Ana', 'b'), voto('Beto', 'b'), voto('Carla', 'c')]);
    expect(r.porParticipante.map(x => x.participante.nombre + ':' + x.votos).join(',')).toBe('PIRATA:2,JOKER:1,VAMPIRO:0');
    expect(r.votaron).toBe(3);
  });

  it('el ganador es quien tiene mas votos', () => {
    const r = resultadosDe(PARTICIPANTES, [voto('Ana', 'b'), voto('Beto', 'b'), voto('Carla', 'c')]);
    expect(r.ganadores.map(g => g.nombre).join(',')).toBe('PIRATA');
    expect(r.empate).toBe(false);
  });

  it('si hay empate en el primer lugar salen todos', () => {
    const r = resultadosDe(PARTICIPANTES, [voto('Ana', 'a'), voto('Beto', 'c')]);
    expect(r.ganadores.map(g => g.nombre).join(',')).toBe('VAMPIRO,JOKER');
    expect(r.empate).toBe(true);
  });

  it('sin votos no hay ganador', () => {
    const r = resultadosDe(PARTICIPANTES, []);
    expect(r.ganadores.length).toBe(0);
    expect(r.empate).toBe(false);
    expect(r.votaron).toBe(0);
  });

  it('las razones salen sin el nombre de quien las escribió', () => {
    const r = resultadosDe(PARTICIPANTES, [voto('Secreta Pérez', 'a', 'Me encantó la capa')]);
    expect(r.razones.length).toBe(1);
    expect(r.razones[0].participante).toBe('VAMPIRO');
    expect(r.razones[0].razon).toBe('Me encantó la capa');
    expect(JSON.stringify(r.razones).includes('Secreta')).toBe(false);
  });

  it('un voto para alguien que ya no esta cuenta como voto, pero no se muestra', () => {
    const r = resultadosDe(PARTICIPANTES, [voto('Ana', 'zzz')]);
    expect(r.votaron).toBe(1);
    expect(r.razones.length).toBe(0);
    expect(r.ganadores.length).toBe(0);
  });
});
