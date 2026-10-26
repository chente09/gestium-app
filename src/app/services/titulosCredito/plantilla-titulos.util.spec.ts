import { TablaHoja, detectarFormato, extraerFilas } from './importador-titulos.util';
import { COLUMNAS_PLANTILLA, HOJA_TITULOS, POSICION_ABOGADO, filasInstrucciones } from './plantilla-titulos.util';

const encabezados = COLUMNAS_PLANTILLA.map(c => c.encabezado);

function hoja(...filas: (string | number)[][]): TablaHoja {
  return { nombre: HOJA_TITULOS, filas: [encabezados, ...filas] };
}

describe('plantilla de títulos', () => {
  it('el importador reconoce cada columna de la plantilla en su posición', () => {
    const formato = detectarFormato(hoja())!;
    expect(formato === null).toBe(false);
    COLUMNAS_PLANTILLA.forEach((c, i) => expect(formato.columnas[c.campo]).toBe(i));
  });

  it('trae guía y fecha de sorteo, así que se lee como entregados (el selector lo corrige) y trae abogado', () => {
    const formato = detectarFormato(hoja())!;
    expect(formato.estadoEntrega).toBe('entregado');
    expect(formato.traeAbogado).toBe(true);
  });

  it('una fila llena se lee completa', () => {
    const tabla = hoja(['43406694', '1790012345001', 'EJEMPLO S.A.', '1250.50', 'Jose Luis Rueda', '00133779', '15/10/2026']);
    const { filas, invalidas } = extraerFilas(tabla, detectarFormato(tabla)!);
    expect(invalidas.length).toBe(0);
    expect(filas.length).toBe(1);
    expect(filas[0].numero).toBe('43406694');
    expect(filas[0].ruc).toBe('1790012345001');
    expect(filas[0].razon).toBe('EJEMPLO S.A.');
    expect(filas[0].capital).toBe(1250.5);
    expect(filas[0].abogado).toBe('JOSE LUIS RUEDA');
    expect(filas[0].guia).toBe('133779');
    expect(filas[0].fechaSorteo).toBe('2026-10-15');
  });

  it('la fecha de sorteo también se lee si Excel la guardó como fecha', () => {
    const tabla = hoja(['43406694', '1790012345001', 'EJEMPLO S.A.', 100, 'Jose Luis Rueda', '133779', new Date(Date.UTC(2026, 9, 15)) as any]);
    const { filas } = extraerFilas(tabla, detectarFormato(tabla)!);
    expect(filas[0].fechaSorteo).toBe('2026-10-15');
  });

  it('solo título y RUC bastan para que la fila sea válida (el valor vacío queda en cero)', () => {
    const tabla = hoja(['43406694', '1790012345001']);
    const { filas, invalidas } = extraerFilas(tabla, detectarFormato(tabla)!);
    expect(invalidas.length).toBe(0);
    expect(filas[0].capital).toBe(0);
  });

  it('una cédula con cero inicial escrita como texto no pierde el cero', () => {
    const tabla = hoja(['43406694', '0102030405', 'PEDRO PEREZ', 100]);
    const { filas } = extraerFilas(tabla, detectarFormato(tabla)!);
    expect(filas[0].ruc).toBe('0102030405');
  });

  it('el abogado está en la columna que lleva la lista desplegable', () => {
    expect(encabezados[POSICION_ABOGADO - 1]).toBe('Abogado');
  });

  it('la hoja de instrucciones explica cada columna', () => {
    const textos = filasInstrucciones().map(([titulo]) => titulo);
    COLUMNAS_PLANTILLA.forEach(c => expect(textos.some(t => t.startsWith(c.encabezado))).toBe(true));
  });
});
