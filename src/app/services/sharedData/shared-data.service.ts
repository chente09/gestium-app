import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SharedDataService {

  // 📋 Datos centralizados para evitar duplicación
  readonly areas: string[] = [
    'ISSFA', 
    'Bco. Pichincha', 
    'Bco. Produbanco', 
    'BNF', 
    'Inmobiliaria', 
    'David', 
    'Otro'
  ];

  readonly unidades: string[] = [
    'Pague Ya',
    'Coordinación de la Unidad Judicial Penal',
    'Municipio', 
    'Notaria', 
    'SUPERCIAS', 
    'AMT', 
    'ANT', 
    'SRI', 
    'ISSFA', 
    'Consejo Provincial', 
    'Registro Propiedad', 
    'Registro Mercantil', 
    'Quitumbe', 
    'Iñaquito', 
    'Mejía', 
    'Cayambe', 
    'Rumiñahui', 
    'Calderon',
    'Otro'
  ];

  readonly materias: string[] = [
    'Archivo', 
    'Ingresos', 
    'Coordinación', 
    'Diligencias no Penales', 
    'Oficina de Citaciones', 
    'Familia', 
    'Laboral', 
    'Penal', 
    'Civil', 
    'Otro'
  ];

  readonly diligencias: string[] = [
    'Copias para Citar', 
    'Desglose', 
    'Requerimiento', 
    'Oficios', 
    'Otro'
  ];

  readonly pisos: string[] = [
    'Pb', 
    '5to', 
    '8vo', 
    'Otro'
  ];

  readonly estados: string[] = [
    'Completado', 
    'Incompleto', 
    'Pendiente'
  ];

  // 🆕 ETAPAS POR TIPO DE PROCESO
  readonly etapasPorTipoProceso: { [key: string]: string[] } = {
    'CANCELACIÓN DE HIPOTECA': [
      'PAGO DE HONORARIOS',
      'ELABORACIÓN MATRIZ',
      'FACTURACIÓN NOTARÍA',
      'REVISIÓN DE MATRIZ',
      'INGRESO A ISSFA',
      'RETIRO DE ISSFA',
      'INGRESO A NOTARIA PARA CIERRE',
      'RETIRO DE ESCRITURA',
      'INSCRIPCIÓN REGISTRO DE LA PROPIEDAD',
      'RETIRO DE REGISTRO DE LA PROPIEDAD',
      'FINALIZADO',
      'Otra'
    ],
    'COMPRAVENTA': [
      'RETIRO EXPEDIENTE',
      'REVISION EXPEDIENTE',
      'COMUNICACION A CLIENTE',
      'SORTEO DE NOTARIA',
      'SOLICITUD CERTIFICADO GRAVAMEN',
      'INGRESO PROFORMA DE GASTOS A ISSFA',
      'ASIGNACION DE NOTARIA',
      'EMISION CERTIFICADO GRAVAMEN',
      'DESEMBOLSO DINERO DE GASTOS',
      'DECLARACION IMPUESTOS MUNICIPIO',
      'RECEPCION DE FIRMAS EN NOTARIA',
      'REVISION DE MATRIZ',
      'INGRESO A FIRMA EN ISSFA',
      'RETIRO ISSFA',
      'CIERRE ESCRITURAS NOTARIA',
      'INGRESO REGISTRO PROPIEDAD',
      'RETIRO REGISTRO PROPIEDAD',
      'SOLICITUD CERTIFICADO GRAVAMEN',
      'EMISION CERTIFICADO DE GRAVAMEN',
      'ELABORACION EXPEDIENTE FINALIZADO',
      'INGRESO EXPEDIENTE FINALIZADO A ISSFA',
      'Otra'
    ],
    // Para procesos personalizados (tipo "Otro"), usar etapas por defecto
    'Otro': [
      'PAGO DE HONORARIOS',
      'ELABORACIÓN MATRIZ',
      'FACTURACIÓN NOTARÍA',
      'REVISIÓN DE MATRIZ',
      'INGRESO A ISSFA',
      'RETIRO DE ISSFA',
      'INGRESO A NOTARIA PARA CIERRE',
      'RETIRO DE ESCRITURA',
      'INSCRIPCIÓN REGISTRO DE LA PROPIEDAD',
      'RETIRO DE REGISTRO DE LA PROPIEDAD',
      'FINALIZADO',
      'Otra'
    ]
  };

  readonly juecesPorPiso: { [key: string]: string[] } = {
    "5to": [
      "Alban Solano Diana Jazmin",
      "Altamirano Ruiz Santiago David",
      "Baño Palomino Patricio Gonzalo",
      "Calero Sánchez Oscar Ramiro",
      "Cevallos Ampudia Edwin",
      "Chacón Ortiz Francisco Gabriel",
      "Eguiguren Bermelo Leonardo Andrés",
      "Espinosa Venegas Celina Cecilia",
      "Landazuri Salazar Luis Fernando",
      "Lemos Trujillo Gabriela Estefanía",
      "López Tapia Edisson Eduardo",
      "Martínez Salazar Karina Alejandra",
      "Mogro Pérez Carlos Alfredo",
      "Molina Andrade Cinthya Guadalupe",
      "Narváez Narváez Paul",
      "Ordoñez Pizarro Rita Geovanna",
      "Palacios Morillo Vinicio",
      "Romero Ramírez Carmen Virginia",
      "Ron Cadena Lizbeth Marisol",
      "Simbaña Quishpe Martha Cecilia",
      "Tafur Salazar Jenny Margoth",
      "Vaca Duque Lucía Alejandra",
      "Zambrano Ortiz Wilmer Ismael",
      "Figueroa Costa Maria Lorena",
    ],
    "8vo": [
      "Chango Baños Edith Cristina",
      "Chinde Chamorro Richard Wilmer",
      "Erazo Navarrete Grimanesa",
      "Fierro Vega Johana Alexia",
      "Flor Pazmiño Monica Jacqueline",
      "Fuentes López Carlos Francisco",
      "López Vargas Melany",
      "Miranda Calvache Jorge Alejandro",
      "Pila Avendaño Viviana Jeanneth",
      "Ponce Toala Brenda Leonor",
      "Rodas Sánchez Silvia Karina",
      "Salto Dávila Luz",
      "Saltos Pinto Luis Sebastián",
      "Sanmartin Solano Dayanna Merced",
      "Silva Pereira Cristian Danilo",
      "Tello Aimacaña Ángel Patricio",
      "Torres Recalde Ana Karina",
      "Vallejo Naranjo Byron Andrés",
      "Vela Ribadeneira María"
    ]
  };

  // 🔄 Métodos getter para facilitar el acceso
  getAreas(): string[] {
    return [...this.areas];
  }

  getUnidades(): string[] {
    return [...this.unidades];
  }

  getMaterias(): string[] {
    return [...this.materias];
  }

  getDiligencias(): string[] {
    return [...this.diligencias];
  }

  getPisos(): string[] {
    return [...this.pisos];
  }

  getEstados(): string[] {
    return [...this.estados];
  }

  getJuecesPorPiso(piso?: string): string[] {
    if (!piso || !this.juecesPorPiso[piso]) {
      return [];
    }
    return [...this.juecesPorPiso[piso]];
  }

  // 🆕 Método para obtener etapas según el tipo de proceso
  getEtapasPorTipoProceso(tipoProceso: string): string[] {
    if (!tipoProceso || !this.etapasPorTipoProceso[tipoProceso]) {
      // Si no existe el tipo, devolver las etapas por defecto (CANCELACIÓN DE HIPOTECA)
      return [...this.etapasPorTipoProceso['CANCELACIÓN DE HIPOTECA']];
    }
    return [...this.etapasPorTipoProceso[tipoProceso]];
  }

  // 🆕 Método para obtener todos los tipos de proceso disponibles
  getTiposProcesosDisponibles(): string[] {
    return Object.keys(this.etapasPorTipoProceso).filter(tipo => tipo !== 'Otro');
  }

  // 🔍 Métodos de utilidad
  isValidArea(area: string): boolean {
    return this.areas.includes(area);
  }

  isValidUnidad(unidad: string): boolean {
    return this.unidades.includes(unidad);
  }

  isValidMateria(materia: string): boolean {
    return this.materias.includes(materia);
  }

  // 🆕 Validar si existe el tipo de proceso
  isValidTipoProceso(tipoProceso: string): boolean {
    return Object.keys(this.etapasPorTipoProceso).includes(tipoProceso);
  }

  // 📊 Estadísticas útiles
  getTotalOptions(): number {
    return this.areas.length + this.unidades.length + this.materias.length + this.diligencias.length;
  }
}