import { agruparPendientesPorCoactivado, siguientePendienteTras } from './pendientes-iess.util';

function act(id: string, cedula: string | undefined, dia: number, extra: Record<string, unknown> = {}): any {
  return {
    id,
    titulo: 'Seguimiento',
    descripcion: `llamar ${id}`,
    fechaLimite: new Date(2026, 9, dia, 12, 0, 0),
    estado: 'pendiente',
    area: 'iess',
    responsable: 'u1',
    coactivadoId: cedula,
    coactivadoNombre: cedula ? `NOMBRE ${cedula}` : undefined,
    ...extra
  };
}

describe('siguientePendienteTras', () => {
  const lista = () => [act('a', '1', 10), act('b', '2', 12), act('c', '3', 14)];

  it('al completar uno del medio pasa al que queda en su lugar', () => {
    expect(siguientePendienteTras({ id: 'b', coactivadoId: '2' }, lista())?.coactivadoId).toBe('3');
  });

  it('al completar el primero pasa al segundo', () => {
    expect(siguientePendienteTras({ id: 'a', coactivadoId: '1' }, lista())?.coactivadoId).toBe('2');
  });

  it('al completar el último vuelve al anterior', () => {
    expect(siguientePendienteTras({ id: 'c', coactivadoId: '3' }, lista())?.coactivadoId).toBe('2');
  });

  it('si era el único, ya no quedan pendientes (null)', () => {
    expect(siguientePendienteTras({ id: 'a', coactivadoId: '1' }, [act('a', '1', 10)]) === null).toBe(true);
  });

  it('si el coactivado tiene otro recordatorio abierto, no cambia de caso', () => {
    const dos = [act('a', '1', 10), act('b', '1', 12), act('c', '2', 14)];
    expect(siguientePendienteTras({ id: 'a', coactivadoId: '1' }, dos) === undefined).toBe(true);
  });

  it('si el recordatorio no es de mi lista, no cambia de caso', () => {
    expect(siguientePendienteTras({ id: 'z', coactivadoId: '99' }, lista()) === undefined).toBe(true);
  });
});

describe('agruparPendientesPorCoactivado', () => {
  it('ordena por fecha: los vencidos y más próximos primero', () => {
    const r = agruparPendientesPorCoactivado([act('a', '3', 25), act('b', '1', 10), act('c', '2', 18)]);
    expect(r.map(p => p.coactivadoId).join(',')).toBe('1,2,3');
  });

  it('un coactivado con dos recordatorios es un solo caso, con la fecha más próxima', () => {
    const r = agruparPendientesPorCoactivado([act('a', '1', 25), act('b', '1', 12), act('c', '2', 20)]);
    expect(r.length).toBe(2);
    expect(r[0].coactivadoId).toBe('1');
    expect(r[0].cantidad).toBe(2);
    expect(r[0].fechaLimite.getDate()).toBe(12);
    expect(r[0].descripcion).toBe('llamar b');
    expect(r[0].actividadIds.join(',')).toBe('a,b');
  });

  it('ignora las completadas y las actividades que no son de un coactivado', () => {
    const r = agruparPendientesPorCoactivado([
      act('a', '1', 10, { estado: 'completada' }),
      act('b', undefined, 11),
      act('c', '2', 12, { estado: 'en_progreso' }),
      act('d', '3', 13, { estado: 'pospuesta' })
    ]);
    expect(r.map(p => p.coactivadoId).join(',')).toBe('2,3');
  });

  it('a igual fecha ordena por nombre', () => {
    const r = agruparPendientesPorCoactivado([
      act('a', '2', 15, { coactivadoNombre: 'ZURITA' }),
      act('b', '1', 15, { coactivadoNombre: 'ACOSTA' })
    ]);
    expect(r.map(p => p.coactivadoNombre).join(',')).toBe('ACOSTA,ZURITA');
  });

  it('acepta fechas de Firestore (Timestamp)', () => {
    const conTimestamp = act('a', '1', 10, { fechaLimite: { toDate: () => new Date(2026, 9, 10, 12) } });
    expect(agruparPendientesPorCoactivado([conTimestamp])[0].fechaLimite.getDate()).toBe(10);
  });

  it('sin actividades devuelve una lista vacía', () => {
    expect(agruparPendientesPorCoactivado([]).length).toBe(0);
  });
});
