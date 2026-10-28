// Excel de trámites: la plantilla para cargarlos (o el mismo archivo con filas
// ya llenas). Lo lee el importador, que ignora las hojas ocultas.

import { saveAs } from 'file-saver';

import { FormatoColumna } from '../../services/titulosCredito/plantilla-titulos.util';
import {
  COLUMNAS_TRAMITES,
  CampoTramite,
  ESTADOS_TRAMITE,
  FilaPlantillaTramite,
  HOJA_INSTRUCCIONES_TRAMITES,
  HOJA_LISTAS_TRAMITES,
  HOJA_TRAMITES,
  NOMBRE_PLANTILLA_TRAMITES,
  OPCIONES_ESPERANDO,
  filasInstruccionesTramites
} from '../../services/tramitesIess/importador-tramites.util';
import { CONCEPTOS_TERCERO, TIPOS_TRAMITE } from '../../services/tramitesIess/tramites-iess.util';

const COLOR_ENCABEZADO = 'FF0D141B';
const FILAS_CON_LISTA = 500;

const FORMATO_EXCEL: Record<FormatoColumna, string> = {
  texto: '@',
  dinero: '#,##0.00',
  fecha: 'dd/mm/yyyy'
};

// Columnas con lista desplegable: cada una lee su lista de la hoja oculta.
const LISTAS: { campo: CampoTramite; nombres: string[] }[] = [
  { campo: 'tipo', nombres: TIPOS_TRAMITE.map(t => t.nombre) },
  { campo: 'concepto', nombres: CONCEPTOS_TERCERO.map(c => c.nombre) },
  { campo: 'estado', nombres: ESTADOS_TRAMITE.map(e => e.nombre) },
  { campo: 'esperando', nombres: OPCIONES_ESPERANDO.map(o => o.nombre) }
];

const posicion = (campo: CampoTramite) => COLUMNAS_TRAMITES.findIndex(c => c.campo === campo) + 1; // 1-based

export async function crearLibroTramites(filas: FilaPlantillaTramite[] = []): Promise<any> {
  // exceljs pesa bastante: se carga recién al descargar, no con la app.
  const modulo: any = await import('exceljs');
  const Workbook = modulo.Workbook ?? modulo.default?.Workbook;
  const libro = new Workbook();
  libro.created = new Date();

  const hoja = libro.addWorksheet(HOJA_TRAMITES);
  hoja.columns = COLUMNAS_TRAMITES.map(c => ({
    header: c.encabezado,
    width: c.ancho,
    style: c.formato ? { numFmt: FORMATO_EXCEL[c.formato] } : {}
  }));
  filas.forEach(fila => hoja.addRow(COLUMNAS_TRAMITES.map(c => fila[c.campo] ?? null)));

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ENCABEZADO } };
  hoja.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  const listas = libro.addWorksheet(HOJA_LISTAS_TRAMITES, { state: 'hidden' });
  LISTAS.forEach(({ campo, nombres }, k) => {
    nombres.forEach((nombre, i) => { listas.getCell(i + 1, k + 1).value = nombre; });
    const letra = String.fromCharCode(65 + k);
    const rango = `${HOJA_LISTAS_TRAMITES}!$${letra}$1:$${letra}$${nombres.length}`;
    for (let fila = 2; fila <= FILAS_CON_LISTA + 1; fila++) {
      hoja.getCell(fila, posicion(campo)).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [rango],
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Valor de la lista',
        error: 'Elige un valor de la lista.'
      };
    }
  });

  const instrucciones = libro.addWorksheet(HOJA_INSTRUCCIONES_TRAMITES);
  instrucciones.columns = [{ width: 38 }, { width: 100 }];
  filasInstruccionesTramites().forEach(([titulo, detalle], i) => {
    const fila = instrucciones.addRow([titulo, detalle]);
    fila.getCell(1).font = { bold: true, size: i === 0 ? 13 : 11 };
    fila.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    fila.getCell(1).alignment = { vertical: 'top', wrapText: true };
  });

  return libro;
}

export async function descargarPlantillaTramites(): Promise<void> {
  const libro = await crearLibroTramites();
  const buffer = await libro.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    NOMBRE_PLANTILLA_TRAMITES
  );
}
