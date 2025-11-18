import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzUploadModule, NzUploadFile } from 'ng-zorro-antd/upload';
import { NzMessageService } from 'ng-zorro-antd/message';
import { DocumentoService } from '../../../services/document/documento.service';
import * as XLSX from 'xlsx';

interface Abogado {
  nombre: string;
  pronombre: string;
  genero: string;
}

@Component({
  selector: 'app-providencia-iess',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzSelectModule,
    NzDatePickerModule,
    NzTimePickerModule,
    NzIconModule,
    NzBreadCrumbModule,
    NzTableModule,
    NzModalModule,
    NzUploadModule
  ],
  templateUrl: './providencia-iess.component.html',
  styleUrl: './providencia-iess.component.css'
})
export class ProvidenciaIessComponent implements OnInit {

  providenciaForm!: FormGroup;
  tipoProvidencia: 'individual' | 'agrupados' = 'individual';
  tipoPersona: 'natural' | 'juridica' = 'natural';
  providenciasAcumuladas: any[] = []; // Array para acumular providencias
  horaBase: Date | null = null; // Hora base para incrementar
  contadorMinutos: number = 0; // Contador de minutos

  // Lista de abogados
  abogados: Abogado[] = [
    { nombre: 'AB. WILLIAM MARCELO MENA MENA', pronombre: 'el', genero: 'o' },
    { nombre: 'AB. JESSICA VICTORIA ORDOÑEZ PARRAGA', pronombre: 'la', genero: 'a' },
    { nombre: 'AB. MAYRA ALEXANDRA ORDOÑEZ PARRAGA', pronombre: 'la', genero: 'a' },
    { nombre: 'AB. JOSE LUIS RUEDA BUSTE', pronombre: 'el', genero: 'o' }
  ];

  // Conceptos disponibles para títulos
  conceptosDisponibles: string[] = [
    'RESP. PATRONAL',
    'FONDOS DE RESERVA',
    'PLANILLA DE APORTES',
    'PRESTAMOS'
  ];

  // Modal para agregar título manualmente
  isModalVisible = false;
  tituloForm!: FormGroup;
  editingIndex: number | null = null;

  // Conversión de números a letras
  valoresEnLetras: { [key: string]: string } = {};

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private documentoService: DocumentoService,
    private modal: NzModalService,
    private message: NzMessageService
  ) { }

  ngOnInit(): void {
    // Obtener tipo de providencia de la ruta
    this.route.params.subscribe(params => {
      const routePath = this.router.url;

      if (routePath.includes('individual-natural')) {
        this.tipoProvidencia = 'individual';
        this.tipoPersona = 'natural';
      } else if (routePath.includes('individual-juridica')) {
        this.tipoProvidencia = 'individual';
        this.tipoPersona = 'juridica';
      } else if (routePath.includes('agrupados-natural')) {
        this.tipoProvidencia = 'agrupados';
        this.tipoPersona = 'natural';
      } else if (routePath.includes('agrupados-juridica')) {
        this.tipoProvidencia = 'agrupados';
        this.tipoPersona = 'juridica';
      }

      this.initForm();
    });
  }

  initForm(): void {
    const baseForm = {
      fechaProvidencia: [null, Validators.required],
      horaProvidencia: [null, Validators.required],
      razonSocial: ['', Validators.required],
      ruc: ['', Validators.required],
      cedula: ['', Validators.required],
      abogadoSeleccionado: [null, Validators.required]
    };

    // Agregar representante legal si es persona jurídica
    if (this.tipoPersona === 'juridica') {
      Object.assign(baseForm, {
        representanteLegal: ['', Validators.required]
      });
    }

    // Para casos INDIVIDUALES
    if (this.tipoProvidencia === 'individual') {
      Object.assign(baseForm, {
        numeroTC: ['', Validators.required], // Este es el mismo que nroProcedimientoCoactivo
        capital: ['', [Validators.required, Validators.pattern('^[0-9,.]*$')]],
        fraccionCapital: ['', [Validators.pattern('^[0-9]{1,2}$')]],
        comprobante: ['', Validators.required],
        fechaCancelacion: [null, Validators.required],
        cancelacion: ['', [Validators.required, Validators.pattern('^[0-9,.]*$')]],
        fraccionCancelacion: ['', [Validators.pattern('^[0-9]{1,2}$')]]
      });
    }

    // Para casos AGRUPADOS
    if (this.tipoProvidencia === 'agrupados') {
      Object.assign(baseForm, {
        titulos: this.fb.array([]),
        cancelaciones: this.fb.array([])
      });
    }

    this.providenciaForm = this.fb.group(baseForm);

    // Inicializar form para agregar títulos manualmente
    this.tituloForm = this.fb.group({
      orden: ['', Validators.required],
      numeroTC: ['', Validators.required],
      concepto: ['', Validators.required],
      valorCapital: ['', [Validators.required, Validators.pattern('^[0-9,.]*$')]],
      comprobante: ['', Validators.required],
      fechaCancelacion: ['', Validators.required],
      valorCancelado: ['', [Validators.required, Validators.pattern('^[0-9,.]*$')]]
    });
  }

  // ========== GETTERS ==========
  get titulos(): FormArray {
    return this.providenciaForm.get('titulos') as FormArray;
  }

  get cancelaciones(): FormArray {
    return this.providenciaForm.get('cancelaciones') as FormArray;
  }

  get esPersonaJuridica(): boolean {
    return this.tipoPersona === 'juridica';
  }

  get esAgrupados(): boolean {
    return this.tipoProvidencia === 'agrupados';
  }

  // ========== GESTIÓN DE TÍTULOS (AGRUPADOS) ==========

  mostrarModalTitulo(): void {
    this.editingIndex = null;
    this.tituloForm.reset();
    this.isModalVisible = true;
  }

  handleOkModal(): void {
    if (this.tituloForm.valid) {
      const titulo = this.tituloForm.value;

      if (this.editingIndex !== null) {
        // Editar título existente
        this.titulos.at(this.editingIndex).patchValue(titulo);
        this.message.success('Título actualizado correctamente');
      } else {
        // Agregar nuevo título
        this.titulos.push(this.fb.group(titulo));
        this.message.success('Título agregado correctamente');
      }

      this.isModalVisible = false;
      this.tituloForm.reset();
    } else {
      Object.values(this.tituloForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });
    }
  }

  handleCancelModal(): void {
    this.isModalVisible = false;
    this.tituloForm.reset();
  }

  editarTitulo(index: number): void {
    this.editingIndex = index;
    const titulo = this.titulos.at(index).value;
    this.tituloForm.patchValue(titulo);
    this.isModalVisible = true;
  }

  eliminarTitulo(index: number): void {
    this.modal.confirm({
      nzTitle: '¿Está seguro de eliminar este título?',
      nzContent: 'Esta acción no se puede deshacer',
      nzOkText: 'Eliminar',
      nzOkType: 'primary',
      nzOkDanger: true,
      nzOnOk: () => {
        this.titulos.removeAt(index);
        this.message.success('Título eliminado correctamente');
      },
      nzCancelText: 'Cancelar'
    });
  }

  // ========== IMPORTACIÓN DESDE EXCEL ==========

  beforeUpload = (file: NzUploadFile): boolean => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';

    if (!isExcel) {
      this.message.error('Solo se permiten archivos Excel (.xlsx, .xls)');
      return false;
    }

    // NzUploadFile tiene una propiedad originFileObj que es el File nativo
    if (file.originFileObj) {
      this.importarDesdeExcel(file.originFileObj as File);
    }

    return false; // Prevenir subida automática
  };


  importarDesdeExcel(file: File): void {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);

        if (jsonData.length === 0) {
          this.message.error('El archivo Excel está vacío');
          return;
        }

        // Limpiar títulos existentes
        while (this.titulos.length) {
          this.titulos.removeAt(0);
        }

        // Agregar títulos desde Excel
        jsonData.forEach((row, index) => {
          this.titulos.push(this.fb.group({
            orden: [row['ORDEN'] || (index + 1), Validators.required],
            numeroTC: [row['NUMERO_TC'] || row['TC'] || '', Validators.required],
            concepto: [row['CONCEPTO'] || '', Validators.required],
            valorCapital: [row['VALOR_CAPITAL'] || row['CAPITAL'] || '', [Validators.required, Validators.pattern('^[0-9,.]*$')]]
          }));
        });

        this.message.success(`Se importaron ${jsonData.length} títulos correctamente`);
      } catch (error) {
        console.error('Error al importar Excel:', error);
        this.message.error('Error al procesar el archivo Excel');
      }
    };

    reader.readAsArrayBuffer(file);
  }

  // ========== CONTINÚA EN PARTE 2 ==========
  // ========== CONTINUACIÓN DESDE PARTE 1 ==========

  // ========== GESTIÓN DE CANCELACIONES (AGRUPADOS) ==========

  mostrarModalCancelacion(): void {
    // Similar a títulos, pero para cancelaciones
    // Por ahora lo dejamos vacío, se puede implementar después
    this.message.info('Función de cancelaciones en desarrollo');
  }

  // ========== CONVERSIÓN DE NÚMEROS A LETRAS ==========

  onValueChange(campo: string): void {
    const valor = this.providenciaForm.get(campo)?.value;
    const fraccionCampo = campo.includes('capital') ?
      (campo === 'capital' ? 'fraccionCapital' : campo.replace('capital', 'Capital')) :
      (campo === 'cancelacion' ? 'fraccionCancelacion' : '');

    if (!valor) {
      this.valoresEnLetras[campo] = '';
      return;
    }

    const valorSinComas = String(valor).replace(/,/g, '');
    const valorFormateado = this.formatearNumeroConMiles(valorSinComas);

    // Actualizar el control con el valor formateado
    this.providenciaForm.get(campo)?.setValue(valorFormateado, { emitEvent: false });

    // Convertir a letras con formato completo
    const parteEntera = Number(valorSinComas);
    const fraccion = this.providenciaForm.get(fraccionCampo)?.value || '00';
    const fraccionFormateada = String(fraccion).padStart(2, '0');

    this.valoresEnLetras[campo] = parteEntera ?
      `${this.convertirNumeroALetras(parteEntera).toUpperCase()} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${fraccionFormateada}/100` : '';
  }

  formatearNumeroConMiles(valor: string): string {
    const valorSinMiles = valor.replace(/,/g, '');
    const numero = Number(valorSinMiles);

    if (!isNaN(numero)) {
      return numero.toLocaleString('en-US');
    }

    return valorSinMiles;
  }

  convertirNumeroALetras(num: number): string {
    const unidades = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const centenas = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

    if (num < 10) return unidades[num];
    if (num < 20) return especiales[num - 10];
    if (num < 100) {
      if (num === 21) return 'veintiuno';
      return decenas[Math.floor(num / 10)] + (num % 10 ? ' y ' + unidades[num % 10] : '');
    }
    if (num < 1000) {
      if (num === 100) return 'cien';
      if (num < 200) return 'ciento ' + this.convertirNumeroALetras(num % 100);
      return centenas[Math.floor(num / 100)] + (num % 100 ? ' ' + this.convertirNumeroALetras(num % 100) : '');
    }
    if (num < 1000000) {
      let miles = Math.floor(num / 1000);
      let resto = num % 1000;
      if (miles === 1) {
        return 'mil' + (resto ? ' ' + this.convertirNumeroALetras(resto) : '');
      }
      if (miles === 21) {
        return 'veintiún mil' + (resto ? ' ' + this.convertirNumeroALetras(resto) : '');
      }
      if (miles % 10 === 1 && miles !== 11) {
        return this.convertirNumeroALetras(miles).replace(/uno$/, 'un') + ' mil' + (resto ? ' ' + this.convertirNumeroALetras(resto) : '');
      }
      return this.convertirNumeroALetras(miles) + ' mil' + (resto ? ' ' + this.convertirNumeroALetras(resto) : '');
    }
    if (num < 1000000000) {
      let millones = Math.floor(num / 1000000);
      let resto = num % 1000000;
      if (millones === 1) {
        return 'un millón' + (resto ? ' ' + this.convertirNumeroALetras(resto) : '');
      }
      return this.convertirNumeroALetras(millones) + ' millones' + (resto ? ' ' + this.convertirNumeroALetras(resto) : '');
    }
    return 'Número demasiado grande';
  }

  // ========== FORMATEO DE FECHAS ==========

  formatearFecha(fecha: Date): string {
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];

    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = fecha.getMonth();
    const anio = fecha.getFullYear();

    return `${dia} de ${meses[mes]} de ${anio}`;
  }

  formatearHora(fecha: Date): string {
    const horas = fecha.getHours().toString().padStart(2, '0');
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    return `${horas}H${minutos}`;
  }

  // ========== CONVERSIÓN DE NOMBRE ==========

  convertirNombreMinusculas(nombre: string): string {
    // Convierte "AB. WILLIAM MARCELO MENA MENA" a "Ab. William Marcelo Mena Mena"
    const palabras = nombre.split(' ');
    return palabras.map((palabra, index) => {
      if (index === 0) {
        // Primera palabra (AB.) mantener Ab.
        return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
      }
      // Resto de palabras: Primera letra mayúscula, resto minúscula
      return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
    }).join(' ');
  }

  // ========== GENERACIÓN DEL DOCUMENTO ==========

  acumularProvidencia(): void {
    if (this.providenciaForm.invalid) {
      Object.values(this.providenciaForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });
      this.message.error('Por favor complete todos los campos requeridos');
      return;
    }

    // Preparar datos igual que en onSubmit
    const formValues = this.providenciaForm.value;
    const abogadoSeleccionado = this.abogados.find(a => a.nombre === formValues.abogadoSeleccionado);

    if (!abogadoSeleccionado) {
      this.message.error('Debe seleccionar un abogado');
      return;
    }

    // Calcular hora incrementada
    if (!this.horaBase) {
      this.horaBase = formValues.horaProvidencia;
    } else {
      this.contadorMinutos += 2;
      this.horaBase = new Date(formValues.horaProvidencia.getTime() + this.contadorMinutos * 60000);
    }

    // Preparar datos (copiar lógica de onSubmit pero sin generar documento)
    const datos: any = {
      fechaProvidencia: this.formatearFecha(formValues.fechaProvidencia),
      horaProvidencia: this.horaBase ? this.formatearHora(this.horaBase) : this.formatearHora(formValues.horaProvidencia),
      razonSocial: formValues.razonSocial,
      ruc: formValues.ruc,
      cedula: formValues.cedula,
      abogadoNombre: abogadoSeleccionado.nombre,
      abogadoNombreMinusculas: this.convertirNombreMinusculas(abogadoSeleccionado.nombre),
      pronombre: abogadoSeleccionado.pronombre,
      genero: abogadoSeleccionado.genero
    };

    // Agregar representante legal si aplica
    if (this.tipoPersona === 'juridica') {
      datos.representanteLegal = formValues.representanteLegal;
    }

    // Copiar resto de lógica según tipo (individual/agrupados)
    if (this.tipoProvidencia === 'individual') {
      datos.nroProcedimientoCoactivo = formValues.numeroTC;
      datos.numeroTC = formValues.numeroTC;

      const fraccionCapital = (formValues.fraccionCapital || '00').toString().padStart(2, '0');
      const capitalConDecimales = `${formValues.capital}.${fraccionCapital}`;
      datos.capital = this.formatearNumeroConMiles(capitalConDecimales);
      datos.valorLetrasCapital = `${this.convertirNumeroALetras(Number(formValues.capital.replace(/,/g, ''))).toUpperCase()} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${fraccionCapital}/100`;

      datos.comprobante = formValues.comprobante;

      // Formatear fecha de cancelación si es Date
      datos.fechaCancelacion = formValues.fechaCancelacion instanceof Date
        ? this.formatearFecha(formValues.fechaCancelacion)
        : formValues.fechaCancelacion;

      const fraccionCancelacion = (formValues.fraccionCancelacion || '00').toString().padStart(2, '0');
      const cancelacionConDecimales = `${formValues.cancelacion}.${fraccionCancelacion}`;
      datos.cancelacion = this.formatearNumeroConMiles(cancelacionConDecimales);
      datos.valorLetrasCancelacion = `${this.convertirNumeroALetras(Number(formValues.cancelacion.replace(/,/g, ''))).toUpperCase()} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${fraccionCancelacion}/100`;
    } else {
      // Lógica para agrupados
      if (this.titulos.length === 0) {
        this.message.error('Debe agregar al menos un título de crédito');
        return;
      }

      datos.titulos = this.titulos.value.map((titulo: any) => ({
        orden: titulo.orden,
        numeroTC: titulo.numeroTC,
        concepto: Array.isArray(titulo.concepto) ? titulo.concepto.join(', ') : titulo.concepto,
        valorCapital: this.formatearNumeroConMiles(titulo.valorCapital)
      }));

      const totalCalculado = this.calcularTotalConFraccion();
      datos.totalCapital = totalCalculado.formateado;
      datos.totalCapitalLetras = `${this.convertirNumeroALetras(totalCalculado.entero).toUpperCase()} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${totalCalculado.fraccion}/100`;

      datos.cancelaciones = this.titulos.value.map((titulo: any) => ({
        orden: titulo.orden,
        numeroTC: titulo.numeroTC,
        concepto: Array.isArray(titulo.concepto) ? titulo.concepto.join(', ') : titulo.concepto,
        comprobante: titulo.comprobante || '',
        fechaCancelacion: titulo.fechaCancelacion instanceof Date ? this.formatearFechaCorta(titulo.fechaCancelacion) : titulo.fechaCancelacion || '',
        valorCancelado: this.formatearNumeroConMiles(titulo.valorCancelado || titulo.valorCapital)
      }));
    }

    // Agregar a array acumulado
    this.providenciasAcumuladas.push({
      tipo: this.tipoProvidencia,
      personaTipo: this.tipoPersona,
      datos: datos
    });

    this.message.success(`Providencia ${this.providenciasAcumuladas.length} agregada. Hora: ${datos.horaProvidencia}`);

    // Limpiar formulario para siguiente providencia
    this.resetFormularioParaSiguiente();
  }

  resetFormularioParaSiguiente(): void {
    // Mantener fecha, hora y abogado
    const fechaActual = this.providenciaForm.get('fechaProvidencia')?.value;
    const horaActual = this.providenciaForm.get('horaProvidencia')?.value;
    const abogadoActual = this.providenciaForm.get('abogadoSeleccionado')?.value;

    // Reset del formulario
    this.providenciaForm.reset();

    // Restaurar valores que queremos mantener
    this.providenciaForm.patchValue({
      fechaProvidencia: fechaActual,
      horaProvidencia: horaActual,
      abogadoSeleccionado: abogadoActual
    });

    // Limpiar títulos si es agrupados
    if (this.tipoProvidencia === 'agrupados') {
      while (this.titulos.length) {
        this.titulos.removeAt(0);
      }
    }

    // Limpiar valores en letras
    this.valoresEnLetras = {};
  }

  verProvidenciasAcumuladas(): void {
    if (this.providenciasAcumuladas.length === 0) {
      this.message.info('No hay providencias acumuladas');
      return;
    }

    const mensaje = this.providenciasAcumuladas.map((p, i) =>
      `${i + 1}. ${p.datos.razonSocial} - ${p.datos.horaProvidencia}`
    ).join('\n');

    this.modal.info({
      nzTitle: `Providencias Acumuladas (${this.providenciasAcumuladas.length})`,
      nzContent: `<pre>${mensaje}</pre>`,
      nzWidth: '600px'
    });
  }

  limpiarProvidenciasAcumuladas(): void {
    this.modal.confirm({
      nzTitle: '¿Limpiar todas las providencias acumuladas?',
      nzContent: 'Esta acción eliminará todas las providencias que no se han generado',
      nzOkText: 'Limpiar',
      nzOkDanger: true,
      nzOnOk: () => {
        this.providenciasAcumuladas = [];
        this.horaBase = null;
        this.contadorMinutos = 0;
        this.message.success('Providencias acumuladas eliminadas');
      },
      nzCancelText: 'Cancelar'
    });
  }

  async onSubmit(): Promise<void> {
    // Si no hay providencias acumuladas, generar solo la actual
    if (this.providenciasAcumuladas.length === 0) {
      // Agregar providencia actual primero
      this.acumularProvidencia();
    }

    if (this.providenciasAcumuladas.length === 0) {
      return; // No hay nada que generar
    }

    // Generar todas las providencias en UN SOLO documento
    this.message.info(`Generando documento con ${this.providenciasAcumuladas.length} providencia(s)...`);

    try {
      await this.documentoService.generarProvidenciasMultiples(this.providenciasAcumuladas);
      this.message.success('Documento generado correctamente');

      // Limpiar
      this.providenciasAcumuladas = [];
      this.horaBase = null;
      this.contadorMinutos = 0;
    } catch (error) {
      this.message.error('Error al generar el documento');
      console.error('Error:', error);
    }
  }

  formatearFechaCorta(fecha: Date): string {
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  // ========== CALCULAR TOTAL (AGRUPADOS) ==========

  calcularTotal(): string {
    if (this.tipoProvidencia !== 'agrupados' || this.titulos.length === 0) {
      return '0.00';
    }

    const total = this.titulos.value.reduce((sum: number, titulo: any) => {
      const valor = Number(String(titulo.valorCapital).replace(/,/g, ''));
      return sum + (isNaN(valor) ? 0 : valor);
    }, 0);

    return this.formatearNumeroConMiles(total.toFixed(2));
  }

  calcularTotalConFraccion(): { entero: number, fraccion: string, formateado: string } {
    if (this.tipoProvidencia !== 'agrupados' || this.titulos.length === 0) {
      return { entero: 0, fraccion: '00', formateado: '0.00' };
    }

    const total = this.titulos.value.reduce((sum: number, titulo: any) => {
      const valor = Number(String(titulo.valorCapital).replace(/,/g, ''));
      return sum + (isNaN(valor) ? 0 : valor);
    }, 0);

    const parteEntera = Math.floor(total);
    const parteFraccion = Math.round((total - parteEntera) * 100);
    const fraccionFormateada = parteFraccion.toString().padStart(2, '0');

    return {
      entero: parteEntera,
      fraccion: fraccionFormateada,
      formateado: this.formatearNumeroConMiles(total.toFixed(2))
    };
  }

}