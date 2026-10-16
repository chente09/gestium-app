import { agruparNotasDuplicadas } from './notas-duplicadas.util';
import { claveGestionHistorica, normalizarClaveGestion } from '../titulosCredito/importador-titulos.util';

const RUC = '1705424297001';
const NOTA = 'ME COMUNIQUE CON EL SEÑOR JORGE CEPEDA, SE ESTA A LA ESPERA DE AGENDAR UNA REUNIÓN, LLAMAR EL DIA MIERCOLES A LAS ';
const OBS = 'NOTIFICACION POR CORREO ELECTRONICO';

// Gestión migrada tal como la dejó el importador anterior: clave SIN normalizar.
function migrada(id: string, hora: string, extra: Record<string, unknown> = {}): any {
  return {
    id,
    coactivadoId: RUC,
    coactivadoNombre: 'QUINCHIGUANGO NICOLASA',
    tipo: 'migrado',
    descripcion: `${NOTA}${hora} (contacto original: EDUARDO MELENDEZ)`,
    observacionGeneral: OBS,
    fecha: new Date(2026, 0, 26, 12, 0, 0),
    claveHistorica: `${RUC}\u0000${NOTA}${hora}\u0000${OBS}`,
    registradoPor: { uid: 'u1', nombre: 'VICENTE NENGER' },
    ...extra
  };
}

describe('normalizarClaveGestion', () => {
  it('ignora la hora, los espacios y las mayúsculas', () => {
    const a = normalizarClaveGestion('1705\u0000llamar a las 10:31  hoy\u0000obs');
    const b = normalizarClaveGestion('1705\u0000LLAMAR A LAS 10:36 hoy\u0000OBS');
    expect(a).toBe(b);
  });

  it('una nota con otra fecha o texto distinto sigue siendo otra nota', () => {
    const a = normalizarClaveGestion('1705\u0000llamar el 12/10 a las 10:31\u0000obs');
    const b = normalizarClaveGestion('1705\u0000llamar el 13/10 a las 10:31\u0000obs');
    expect(a === b).toBe(false);
  });

  it('la clave nueva coincide con la normalización de una clave vieja guardada sin normalizar', () => {
    const vieja = `${RUC}\u0000${NOTA}10:33\u0000${OBS}`;
    expect(claveGestionHistorica(RUC, `${NOTA}10:37`, OBS)).toBe(normalizarClaveGestion(vieja));
  });
});

describe('agruparNotasDuplicadas', () => {
  it('agrupa las variantes que solo cambian en la hora y conserva una', () => {
    const grupos = agruparNotasDuplicadas([migrada('a', '10:31'), migrada('b', '10:32'), migrada('c', '10:36')]);
    expect(grupos.length).toBe(1);
    expect(grupos[0].sobrantes.length).toBe(2);
    expect(grupos[0].conservar.id).toBe('a');
  });

  it('no toca notas distintas ni gestiones registradas a mano', () => {
    const otra = migrada('d', '10:31', { claveHistorica: `${RUC}\u0000OTRA NOTA\u0000${OBS}`, descripcion: 'OTRA NOTA' });
    const manual = { ...migrada('e', '10:31'), tipo: 'llamada' };
    expect(agruparNotasDuplicadas([migrada('a', '10:31'), otra, manual]).length).toBe(0);
  });

  it('una gestión editada a mano se conserva y nunca es sobrante', () => {
    const editada = migrada('b', '10:32', { editadoPor: { uid: 'u2', nombre: 'ALGUIEN' } });
    const grupos = agruparNotasDuplicadas([migrada('a', '10:31'), editada, migrada('c', '10:36')]);
    expect(grupos[0].conservar.id).toBe('b');
    expect(grupos[0].sobrantes.map(g => g.id).sort().join(',')).toBe('a,c');
  });

  it('si todas las repetidas están editadas no propone borrar ninguna', () => {
    const editada = (id: string, hora: string) => migrada(id, hora, { editadoPor: { uid: 'u2', nombre: 'X' } });
    expect(agruparNotasDuplicadas([editada('a', '10:31'), editada('b', '10:32')]).length).toBe(0);
  });

  it('el mismo texto en coactivados distintos no es duplicado', () => {
    const otroRuc = migrada('z', '10:31', {
      coactivadoId: '1790000000001',
      claveHistorica: `1790000000001\u0000${NOTA}10:31\u0000${OBS}`
    });
    expect(agruparNotasDuplicadas([migrada('a', '10:31'), otroRuc]).length).toBe(0);
  });

  it('sin clave guardada compara por el texto de la gestión', () => {
    const sinClave = (id: string, hora: string) => {
      const g = migrada(id, hora);
      delete g.claveHistorica;
      return g;
    };
    expect(agruparNotasDuplicadas([sinClave('a', '10:31'), sinClave('b', '10:35')]).length).toBe(1);
  });
});
