import { TablaHoja, detectarFormato, extraerFilas } from './importador-titulos.util';
import { COLUMNAS_PLANTILLA, HOJA_TITULOS, POSICION_ABOGADO, encabezadoDe, filasInstrucciones } from './plantilla-titulos.util';

const encabezados = COLUMNAS_PLANTILLA.map(encabezadoDe);

function hoja(...filas: (string | number)[][]): TablaHoja {
  return { nombre: HOJA_TITULOS, filas: [encabezados, ...filas] };
}

describe('plantilla de títulos', () => {
  it('el importador reconoce cada columna de la plantilla en su posición', () => {
    const formato = detectarFormato(hoja())!;
    expect(formato === null).toBe(false);
    COLUMNAS_PLANTILLA.forEach((c, i) => expect(formato.columnas[c.campo]).toBe(i));
  });

  it('sin columnas de entrega se lee como títulos no entregados y trae abogado', () => {
    const formato = detectarFormato(hoja())!;
    expect(formato.estadoEntrega).toBe('no_entregado');
    expect(formato.traeAbogado).toBe(true);
  });

  it('una fila llena se lee completa (los obligatorios llevan asterisco en el encabezado)', () => {
    const tabla = hoja(['43406694', '1790012345001', 'EJEMPLO S.A.', '1250.50', 'Jose Luis Rueda', 'Ana Perez', '0999999999', 'ana@ejemplo.com']);
    const { filas, invalidas } = extraerFilas(tabla, detectarFormato(tabla)!);
    expect(invalidas.length).toBe(0);
    expect(filas.length).toBe(1);
    expect(filas[0].numero).toBe('43406694');
    expect(filas[0].ruc).toBe('1790012345001');
    expect(filas[0].razon).toBe('EJEMPLO S.A.');
    expect(filas[0].capital).toBe(1250.5);
    expect(filas[0].abogado).toBe('JOSE LUIS RUEDA');
    expect(filas[0].representanteLegal).toBe('ANA PEREZ');
    expect(filas[0].telefono).toBe('0999999999');
    expect(filas[0].correo).toBe('ana@ejemplo.com');
  });

  it('solo TC y RUC bastan para que la fila sea válida (el valor vacío queda en cero)', () => {
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
    COLUMNAS_PLANTILLA.forEach(c => expect(textos.includes(encabezadoDe(c))).toBe(true));
  });
});
