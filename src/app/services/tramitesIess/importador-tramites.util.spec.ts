import { Celda, TablaHoja } from '../titulosCredito/importador-titulos.util';
import {
  COLUMNAS_TRAMITES,
  HOJA_TRAMITES,
  TramiteImportable,
  armarTramite,
  filasInstruccionesTramites,
  leerTramites,
  marcarDuplicados,
  origenesRadiografia
} from './importador-tramites.util';
import { Tramite, claveCliente, etapaActual, esperandoA, totalesDe } from './tramites-iess.util';

const usuario = { uid: 'u1', nombre: 'VICENTE NENGER' };
const ahora = new Date(2026, 9, 28, 10, 0, 0);
const HOY = '2026-10-28';

const ENCABEZADOS = COLUMNAS_TRAMITES.map(c => c.encabezado);

// Una hoja con el encabezado de la plantilla y las filas que se le pasen
// como { encabezado: valor }.
function hoja(filas: Record<string, Celda>[], nombre = HOJA_TRAMITES): TablaHoja {
  return { nombre, filas: [ENCABEZADOS, ...filas.map(f => ENCABEZADOS.map(e => (f[e] ?? null) as Celda))] };
}

function item(extra: Record<string, Celda> = {}): TramiteImportable {
  const lectura = leerTramites([hoja([{ 'Cliente': 'Ejemplo S.A.', 'Tipo de trámite': 'Radiografía', ...extra }])])!;
  if (lectura.items.length !== 1) throw new Error('no se leyó la fila: ' + JSON.stringify(lectura.errores));
  return lectura.items[0];
}

function error(extra: Record<string, Celda>): string {
  const lectura = leerTramites([hoja([{ 'Cliente': 'Ejemplo S.A.', 'Tipo de trámite': 'Radiografía', ...extra }])])!;
  return lectura.errores[0]?.mensaje ?? 'sin error';
}

describe('importador de trámites · hoja', () => {
  it('reconoce todos los encabezados de la plantilla', () => {
    const lectura = leerTramites([hoja([])]);
    expect(lectura !== null).toBe(true);
    expect(lectura!.items.length).toBe(0);
  });

  it('busca la hoja de trámites aunque no sea la primera', () => {
    const otra: TablaHoja = { nombre: 'Instrucciones', filas: [['Cómo llenar', 'algo']] };
    const lectura = leerTramites([otra, hoja([{ 'Cliente': 'A', 'Tipo de trámite': 'Radiografía' }])]);
    expect(lectura!.items.length).toBe(1);
  });

  it('devuelve null si ninguna hoja tiene el encabezado', () => {
    expect(leerTramites([{ nombre: 'Datos', filas: [['a', 'b'], ['c', 'd']] }])).toBe(null);
  });

  it('ignora las filas vacías y numera las filas del Excel', () => {
    const tabla = hoja([{}, { 'Cliente': 'A', 'Tipo de trámite': 'Radiografía' }, { 'Cliente': 'B', 'Tipo de trámite': 'Radiografía' }]);
    const lectura = leerTramites([tabla])!;
    expect(lectura.items.length).toBe(2);
    expect(lectura.items[0].fila).toBe(3);
    expect(lectura.items[1].fila).toBe(4);
  });

  it('las instrucciones explican cada columna y las etapas', () => {
    const titulos = filasInstruccionesTramites().map(f => f[0]);
    expect(titulos.includes('Cliente (obligatorio)')).toBe(true);
    expect(titulos.includes('Etapas de «Anulación · actas de finiquito»')).toBe(true);
  });
});

describe('importador de trámites · datos', () => {
  it('normaliza el nombre, el RUC y el tipo', () => {
    const t = item({ 'Cliente': ' cliente   uno ', 'RUC/Cédula': 400000000001, 'Tipo de trámite': 'anulacion · ruc suspendido' });
    expect(t.datos.clienteNombre).toBe('CLIENTE UNO');
    expect(t.datos.clienteRuc).toBe('0400000000001');
    expect(t.datos.tipo).toBe('anulacion_ruc');
  });

  it('lee cada columna de la plantilla', () => {
    const t = item({
      'Teléfono': '0990000000', 'Contacto': 'Representante legal', 'Qué falta': 'Certificado del SRI',
      'Nro. de ingreso (IESS)': 'IESS-SDNGD-2026-5276-E', 'Nro. de resolución': 'IESS-CPCCP-2026-2559-M'
    });
    expect(t.datos.telefono).toBe('0990000000');
    expect(t.datos.contacto).toBe('Representante legal');
    expect(t.datos.pendiente).toBe('Certificado del SRI');
    expect(t.datos.nroIngreso).toBe('IESS-SDNGD-2026-5276-E');
    expect(t.datos.nroResolucion).toBe('IESS-CPCCP-2026-2559-M');
  });

  it('el tipo Otro pide el detalle', () => {
    expect(error({ 'Tipo de trámite': 'Otro trámite' })).toBe('Escribe qué trámite es.');
    expect(item({ 'Tipo de trámite': 'Otro trámite', 'Detalle (solo en Otro)': 'Claves SUT' }).datos.tipoDetalle).toBe('Claves SUT');
  });

  it('rechaza un tipo, un estado o un RUC que no existen', () => {
    expect(error({ 'Tipo de trámite': 'Inventado' }).startsWith('Tipo de trámite no reconocido')).toBe(true);
    expect(error({ 'Estado': 'Quién sabe' }).startsWith('Estado no reconocido')).toBe(true);
    expect(error({ 'RUC/Cédula': '12345' })).toBe('El RUC o la cédula debe tener 10 o 13 dígitos.');
  });

  it('una fila con datos pero sin cliente es un error', () => {
    const lectura = leerTramites([hoja([{ 'Tipo de trámite': 'Radiografía', 'Honorario': 100 }])])!;
    expect(lectura.errores[0].mensaje).toBe('Falta el nombre del cliente.');
    expect(lectura.items.length).toBe(0);
  });

  it('lee montos y fechas en los formatos de Excel', () => {
    const t = item({
      'Honorario': '1.500,50', 'Cobrado': 750,
      'Fecha de presentación': new Date(Date.UTC(2026, 6, 1)), 'Fecha de resolución': '02/06/2026'
    });
    expect(t.datos.honorario).toBe(1500.5);
    expect(t.cobrado).toBe(750);
    expect(t.datos.fechaPresentacion).toBe('2026-07-01');
    expect(t.datos.fechaResolucion).toBe('2026-06-02');
  });

  it('avisa si lo cobrado supera el honorario, pero la carga', () => {
    const lectura = leerTramites([hoja([{ 'Cliente': 'A', 'Tipo de trámite': 'Radiografía', 'Honorario': 100, 'Cobrado': 150 }])])!;
    expect(lectura.items.length).toBe(1);
    expect(lectura.avisos.length).toBe(1);
  });
});

describe('importador de trámites · etapas y estado', () => {
  it('sin etapa ni estado, queda en curso sin iniciar', () => {
    const t = item({ 'Tipo de trámite': 'Anulación · actas de finiquito' });
    expect(t.estado).toBe('en_curso');
    expect(t.etapasHechas.length).toBe(0);
  });

  it('la etapa actual deja hechas las anteriores', () => {
    const t = item({ 'Tipo de trámite': 'Anulación · actas de finiquito', 'Etapa actual': 'Esperar la resolución del IESS' });
    expect(t.etapasHechas.join(',')).toBe('verificar,analizar,sut,contrato,acta,ingresar');
  });

  it('un trámite terminado tiene todas sus etapas hechas', () => {
    const t = item({ 'Tipo de trámite': 'Radiografía', 'Estado': 'Terminado' });
    expect(t.estado).toBe('terminado');
    expect(t.etapasHechas.join(',')).toBe('solicitar_info,revision,resultados');
  });

  it('una etapa de otro tipo de trámite es un error que lista las válidas', () => {
    expect(error({ 'Tipo de trámite': 'Radiografía', 'Etapa actual': 'Acta de finiquito' }).includes('Solicitar información al cliente')).toBe(true);
  });

  it('esperando a se reconoce por su nombre', () => {
    expect(item({ 'Esperando a': 'cliente' }).datos.esperandoAManual).toBe('cliente');
    expect(error({ 'Esperando a': 'nadie' }).startsWith('«Esperando a» no reconocido')).toBe(true);
  });
});

describe('importador de trámites · terceros', () => {
  it('lee el costo a un tercero', () => {
    const t = item({ 'Tercero: concepto': 'Tramitador del IESS', 'Tercero: nombre': 'maría pérez', 'Tercero: pactado': 200, 'Tercero: pagado': 50 });
    expect(t.costo!.concepto).toBe('tramitador_iess');
    expect(t.costo!.tercero).toBe('MARÍA PÉREZ');
    expect(t.costo!.pactado).toBe(200);
    expect(t.costo!.pagado).toBe(50);
  });

  it('sin nombre queda POR DEFINIR y sin concepto, Otro', () => {
    const t = item({ 'Tercero: pactado': 100 });
    expect(t.costo!.tercero).toBe('POR DEFINIR');
    expect(t.costo!.concepto).toBe('otro');
  });

  it('si solo viene lo pagado, eso es lo pactado', () => {
    expect(item({ 'Tercero: pagado': 30 }).costo!.pactado).toBe(30);
  });

  it('un tercero sin ningún monto es un error', () => {
    expect(error({ 'Tercero: nombre': 'Alguien' })).toBe('Tercero: falta el monto pactado.');
  });

  it('sin datos de tercero no hay costo', () => {
    expect(item().costo).toBe(undefined);
  });
});

describe('importador de trámites · lo que se guarda', () => {
  const nuevoId = () => 'costo-1';

  it('arma cobro, costo, etapas y gestiones con quién importó', () => {
    const t = armarTramite(
      item({
        'Tipo de trámite': 'Anulación · actas de finiquito', 'Honorario': 350, 'Cobrado': 175,
        'Tercero: concepto': 'Tramitador del IESS', 'Tercero: pactado': 50, 'Tercero: pagado': 50,
        'Etapa actual': 'Esperar la resolución del IESS', 'Nro. de ingreso (IESS)': 'IESS-SDNGD-2026-36938-E',
        'Fecha de presentación': '01/07/2026', 'Notas': 'Actas cerradas'
      }),
      usuario, ahora, HOY, nuevoId
    );
    expect(t.estado).toBe('en_curso');
    expect(t.pagos.length).toBe(1);
    expect(t.pagos[0].monto).toBe(175);
    expect(t.pagos[0].fecha).toBe(HOY);
    expect(t.pagos[0].registradoPor.uid).toBe('u1');
    expect(t.costosTerceros[0].id).toBe('costo-1');
    expect(t.costosTerceros[0].pagos[0].monto).toBe(50);
    expect(t.etapas!['acta'].estado).toBe('hecha');
    expect(etapaActual(t)!.id).toBe('resolucion');
    expect(t.gestiones.map(g => g.texto).join(' | ')).toBe('Trámite importado desde Excel | Actas cerradas');
    expect(t.gestiones[1].tipo).toBe('nota');
    expect(t.nroIngreso).toBe('IESS-SDNGD-2026-36938-E');
    const totales = totalesDe(t);
    expect(totales.porCobrar).toBe(175);
    expect(totales.utilidad).toBe(300);
  });

  it('sin cobros ni terceros no crea pagos ni costos', () => {
    const t = armarTramite(item(), usuario, ahora, HOY, nuevoId);
    expect(t.pagos.length).toBe(0);
    expect(t.costosTerceros.length).toBe(0);
  });

  it('un trámite terminado guarda la fecha de cierre de la resolución', () => {
    const t = armarTramite(item({ 'Estado': 'Terminado', 'Fecha de resolución': '15/05/2026' }), usuario, ahora, HOY, nuevoId);
    expect(t.estado).toBe('terminado');
    expect(t.fechaCierre).toBe('2026-05-15');
  });

  it('sin resolución no inventa la fecha de cierre', () => {
    const t = armarTramite(item({ 'Estado': 'Terminado' }), usuario, ahora, HOY, nuevoId);
    expect(t.fechaCierre).toBe(undefined);
  });

  it('esperando a manual manda sobre la etapa', () => {
    const t = armarTramite(item({ 'Tipo de trámite': 'Anulación · cónyuges', 'Esperando a': 'Cliente' }), usuario, ahora, HOY, nuevoId);
    expect(esperandoA(t)).toBe('cliente');
  });
});

describe('importador de trámites · cliente, enlaces y duplicados', () => {
  const lectura = (filas: Record<string, Celda>[]) => leerTramites([hoja(filas)])!.items;

  it('el cliente se reconoce por RUC y, sin él, por el nombre', () => {
    expect(claveCliente({ clienteRuc: '1700000010001', clienteNombre: 'CLIENTE ZETA' })).toBe('1700000010001');
    expect(claveCliente({ clienteNombre: 'Álvaro Ejemplo' })).toBe('ALVARO EJEMPLO');
  });

  it('la anulación se enlaza con la radiografía del mismo cliente', () => {
    const items = lectura([
      { 'Cliente': 'Cliente Tres', 'RUC/Cédula': '1700000030001', 'Tipo de trámite': 'Radiografía' },
      { 'Cliente': 'Otro', 'RUC/Cédula': '1700000020001', 'Tipo de trámite': 'Radiografía' },
      { 'Cliente': 'Cliente Tres', 'RUC/Cédula': '1700000030001', 'Tipo de trámite': 'Anulación · actas de finiquito' },
      { 'Cliente': 'Cliente Tres', 'RUC/Cédula': '1700000030001', 'Tipo de trámite': 'Otro trámite', 'Detalle (solo en Otro)': 'Claves SUT' }
    ]);
    expect(origenesRadiografia(items).join(',')).toBe(',,0,');
  });

  it('no adivina si el cliente tiene dos radiografías ni si no tiene ninguna', () => {
    const dos = lectura([
      { 'Cliente': 'A', 'Tipo de trámite': 'Radiografía' },
      { 'Cliente': 'A', 'Tipo de trámite': 'Radiografía', 'Honorario': 50 },
      { 'Cliente': 'A', 'Tipo de trámite': 'Anulación · cónyuges' }
    ]);
    expect(origenesRadiografia(dos)[2]).toBe(null);
    const ninguna = lectura([{ 'Cliente': 'B', 'Tipo de trámite': 'Anulación · cónyuges' }]);
    expect(origenesRadiografia(ninguna)[0]).toBe(null);
  });

  it('marca los trámites que ya existen y los repetidos en el archivo', () => {
    const items = lectura([
      { 'Cliente': 'Cliente Zeta', 'RUC/Cédula': '1700000010001', 'Tipo de trámite': 'Radiografía', 'Honorario': 170 },
      { 'Cliente': 'Cliente Zeta', 'RUC/Cédula': '1700000010001', 'Tipo de trámite': 'Radiografía', 'Honorario': 170 },
      { 'Cliente': 'Cliente Zeta', 'RUC/Cédula': '1700000010001', 'Tipo de trámite': 'Anulación · actas de finiquito', 'Honorario': 1800 },
      { 'Cliente': 'Cliente Zeta', 'RUC/Cédula': '1700000010001', 'Tipo de trámite': 'Otro trámite', 'Detalle (solo en Otro)': 'Claves SUT', 'Honorario': 50 }
    ]);
    const existente = { clienteNombre: 'CLIENTE ZETA', clienteRuc: '1700000010001', tipo: 'anulacion_finiquito', honorario: 1800 } as Tramite;
    expect(marcarDuplicados(items, [existente]).join(',')).toBe('false,true,true,false');
  });
});
