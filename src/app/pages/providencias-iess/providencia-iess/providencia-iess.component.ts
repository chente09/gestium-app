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
import * as ExcelJS from 'exceljs';
import { NzAlertModule } from 'ng-zorro-antd/alert';

interface Abogado {
  nombre: string;
  pronombre: string;
  genero: string;
  correos?: string;
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
    NzUploadModule,
    NzAlertModule
  ],
  templateUrl: './providencia-iess.component.html',
  styleUrl: './providencia-iess.component.css'
})
export class ProvidenciaIessComponent implements OnInit {

  providenciaForm!: FormGroup;
  tipoProvidencia: 'individual' | 'agrupados' | 'rpv' | 'opi' = 'individual';
  tipoDocumento: 'individual' | 'agrupados' = 'individual';
  tipoPersona: 'natural' | 'juridica' = 'natural';
  providenciasAcumuladas: any[] = [];
  horaBase: Date | null = null;
  contadorMinutos: number = 0;
  editingProvidenciaIndex: number | null = null;

  abogados: Abogado[] = [
    { nombre: 'AB. WILLIAM MARCELO MENA MENA', pronombre: 'el', genero: 'o', correos: 'marcelo.mena.coactivaiess@gmail.com / notificaciones.iess.gestium@gmail.com' },
    { nombre: 'AB. JESSICA VICTORIA ORDOÑEZ PARRAGA', pronombre: 'la', genero: 'a', correos: 'jessica.ordonez.coactivaiess@gmail.com / notificaciones.iess.gestium@gmail.com' },
    { nombre: 'AB. MAYRA ALEXANDRA ORDOÑEZ PARRAGA', pronombre: 'la', genero: 'a', correos: 'mayra.ordonezcoactivaiess@gmail.com / notificaciones.iess.gestium@gmail.com' },
    { nombre: 'AB. JOSE LUIS RUEDA BUSTE', pronombre: 'el', genero: 'o', correos: 'jose.rueda.coactivaiess@gmail.com / notificaciones.iess.gestium@gmail.com' }
  ];

  conceptosDisponibles: string[] = [
    'RESP. PATRONAL',
    'FONDOS DE RESERVA',
    'PLANILLA DE APORTES',
    'PRESTAMOS'
  ];

  isModalVisible = false;
  tituloForm!: FormGroup;
  editingIndex: number | null = null;
  isModalProvidenciasVisible = false;
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
    this.route.params.subscribe(params => {
      const routePath = this.router.url;

      if (routePath.includes('rpv-iess/natural')) {
        this.tipoProvidencia = 'rpv';
        this.tipoPersona = 'natural';
      } else if (routePath.includes('rpv-iess/juridica')) {
        this.tipoProvidencia = 'rpv';
        this.tipoPersona = 'juridica';
      } else if (routePath.includes('opi-iess/individual-natural')) {
        this.tipoProvidencia = 'opi';
        this.tipoDocumento = 'individual';
        this.tipoPersona = 'natural';
      } else if (routePath.includes('opi-iess/individual-juridica')) {
        this.tipoProvidencia = 'opi';
        this.tipoDocumento = 'individual';
        this.tipoPersona = 'juridica';
      } else if (routePath.includes('opi-iess/agrupados-natural')) {
        this.tipoProvidencia = 'opi';
        this.tipoDocumento = 'agrupados';
        this.tipoPersona = 'natural';
      } else if (routePath.includes('opi-iess/agrupados-juridica')) {
        this.tipoProvidencia = 'opi';
        this.tipoDocumento = 'agrupados';
        this.tipoPersona = 'juridica';
      } else if (routePath.includes('individual-natural')) {
        this.tipoProvidencia = 'individual';
        this.tipoDocumento = 'individual';
        this.tipoPersona = 'natural';
      } else if (routePath.includes('individual-juridica')) {
        this.tipoProvidencia = 'individual';
        this.tipoDocumento = 'individual';
        this.tipoPersona = 'juridica';
      } else if (routePath.includes('agrupados-natural')) {
        this.tipoProvidencia = 'agrupados';
        this.tipoDocumento = 'agrupados';
        this.tipoPersona = 'natural';
      } else if (routePath.includes('agrupados-juridica')) {
        this.tipoProvidencia = 'agrupados';
        this.tipoDocumento = 'agrupados';
        this.tipoPersona = 'juridica';
      }

      this.initForm();
    });
  }

  initForm(): void {
    const horaDefecto = new Date();
    horaDefecto.setHours(8, 0, 0, 0);

    const baseForm: any = {
      fechaProvidencia: [null, Validators.required],
      cedula: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      abogadoSeleccionado: [null, Validators.required]
    };

    if (this.tipoProvidencia !== 'rpv') {
      baseForm.horaProvidencia = [horaDefecto, Validators.required];
      baseForm.razonSocial = ['', Validators.required];
      baseForm.ruc = ['', [Validators.required, Validators.pattern('^[0-9]{13}$')]];
    }

    if (this.tipoProvidencia === 'rpv' && this.tipoPersona === 'juridica') {
      baseForm.razonSocial = ['', Validators.required];
      baseForm.ruc = ['', [Validators.required, Validators.pattern('^[0-9]{13}$')]];
    }

    if ((this.tipoProvidencia !== 'rpv' && this.tipoPersona === 'juridica') || this.tipoProvidencia === 'rpv') {
      baseForm.representanteLegal = ['', Validators.required];
    }

    if (this.tipoProvidencia === 'rpv' || this.tipoProvidencia === 'individual' ||
      (this.tipoProvidencia === 'opi' && this.esIndividual)) {
      baseForm.numeroTC = ['', Validators.required];
    }

    if (this.tipoProvidencia === 'individual') {
      baseForm.capital = ['', [Validators.required, Validators.pattern('^[0-9]+([.,][0-9]{1,3})*([.,][0-9]{1,2})?$')]];
      baseForm.comprobante = ['', [Validators.required, Validators.pattern('^[0-9]*$')]];
      baseForm.fechaCancelacion = [null, Validators.required];
      baseForm.cancelacion = ['', [Validators.required, Validators.pattern('^[0-9]+([.,][0-9]{1,3})*([.,][0-9]{1,2})?$')]];
    }

    if (this.tipoProvidencia === 'opi' && this.esIndividual) {
      baseForm.capital = ['', [Validators.required, Validators.pattern('^[0-9]+([.,][0-9]{1,3})*([.,][0-9]{1,2})?$')]];
      baseForm.liquidacion = ['', [Validators.required, Validators.pattern('^[0-9]+([.,][0-9]{1,3})*([.,][0-9]{1,2})?$')]];
      baseForm.fechanotificacionRPV = [null, Validators.required];
      baseForm.concepto = ['', Validators.required];
    }

    if (this.tipoProvidencia === 'agrupados') {
      baseForm.titulos = this.fb.array([]);
      baseForm.cancelaciones = this.fb.array([]);
      baseForm.conceptoGeneral = ['', Validators.required];
    }

    if (this.tipoProvidencia === 'opi' && this.esAgrupados) {
      baseForm.titulos = this.fb.array([]);
      baseForm.fechanotificacionRPV = [null, Validators.required];
      baseForm.conceptoGeneral = ['', Validators.required];
    }

    this.providenciaForm = this.fb.group(baseForm);

    const tituloFormConfig: any = {
      orden: ['', Validators.required],
      numeroTC: ['', [Validators.required, Validators.pattern('^[0-9]*$')]],
      valorCapital: ['', [Validators.required, Validators.pattern('^[0-9,.]*$')]]
    };

    if (this.tipoProvidencia === 'opi') {
      tituloFormConfig.valorLiquidacion = ['', [Validators.required, Validators.pattern('^[0-9,.]*$')]];
    }

    if (this.tipoProvidencia !== 'opi') {
      tituloFormConfig.comprobante = ['', [Validators.required, Validators.pattern('^[0-9]*$')]];
      tituloFormConfig.fechaCancelacion = ['', Validators.required];
      tituloFormConfig.valorCancelado = ['', [Validators.required, Validators.pattern('^[0-9,.]*$')]];
    }

    this.tituloForm = this.fb.group(tituloFormConfig);
  }

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
    return this.tipoProvidencia === 'agrupados' ||
      (this.tipoProvidencia === 'opi' && this.tipoDocumento === 'agrupados');
  }

  get esIndividual(): boolean {
    return this.tipoProvidencia === 'individual' ||
      (this.tipoProvidencia === 'opi' && this.tipoDocumento === 'individual');
  }

  get esRpv(): boolean {
    return this.tipoProvidencia === 'rpv';
  }

  get esOpi(): boolean {
    return this.tipoProvidencia === 'opi';
  }

  mostrarModalTitulo(): void {
    const conceptoGeneral = this.providenciaForm.get('conceptoGeneral')?.value;

    if (!conceptoGeneral) {
      this.message.warning('Primero debe seleccionar el Concepto General');
      return;
    }

    this.editingIndex = null;
    this.tituloForm.reset();
    const siguienteOrden = this.titulos.length + 1;
    this.tituloForm.patchValue({
      orden: siguienteOrden
    });
    this.isModalVisible = true;
  }

  handleOkModal(): void {
    if (this.tituloForm.valid) {
      const titulo = this.tituloForm.value;
      const conceptoGeneral = this.providenciaForm.get('conceptoGeneral')?.value;
      titulo.concepto = conceptoGeneral;

      if (this.editingIndex !== null) {
        this.titulos.at(this.editingIndex).patchValue(titulo);
        this.message.success('Título actualizado correctamente');
      } else {
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
    this.tituloForm.patchValue({
      orden: titulo.orden,
      numeroTC: titulo.numeroTC,
      valorCapital: titulo.valorCapital,
      comprobante: titulo.comprobante,
      fechaCancelacion: titulo.fechaCancelacion,
      valorCancelado: titulo.valorCancelado,
      valorLiquidacion: titulo.valorLiquidacion
    });
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

  beforeUpload = (file: NzUploadFile): boolean => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';

    if (!isExcel) {
      this.message.error('Solo se permiten archivos Excel (.xlsx, .xls)');
      return false;
    }

    if (file.originFileObj) {
      this.importarDesdeExcel(file.originFileObj as File);
    }

    return false;
  };

  async importarDesdeExcel(file: File): Promise<void> {
    const reader = new FileReader();

    reader.onload = async (e: any) => {
      try {
        const buffer = e.target.result;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
          this.message.error('El archivo Excel no contiene hojas');
          return;
        }

        const conceptoGeneral = this.providenciaForm.get('conceptoGeneral')?.value;

        if (!conceptoGeneral) {
          this.message.warning('Primero debe seleccionar el Concepto General antes de importar');
          return;
        }

        const jsonData: any[] = [];
        let headers: string[] = [];

        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell, colNumber) => {
          headers[colNumber] = String(cell.value).toUpperCase();
        });

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            const rowData: any = {};
            row.eachCell((cell, colNumber) => {
              const header = headers[colNumber];
              if (header) {
                rowData[header] = cell.value;
              }
            });

            if (Object.keys(rowData).length > 0) {
              jsonData.push(rowData);
            }
          }
        });

        if (jsonData.length === 0) {
          this.message.error('El archivo Excel está vacío');
          return;
        }

        this.providenciaForm.setControl('titulos', this.fb.array([]));

        jsonData.forEach((row, index) => {
          this.titulos.push(this.fb.group({
            orden: [row['ORDEN'] || (index + 1), Validators.required],
            numeroTC: [row['NUMERO_TC'] || row['TC'] || '', Validators.required],
            concepto: [conceptoGeneral, Validators.required],
            valorCapital: [row['VALOR_CAPITAL'] || row['CAPITAL'] || '', [Validators.required, Validators.pattern('^[0-9,.]*$')]],
            comprobante: [row['COMPROBANTE'] || '', Validators.required],
            fechaCancelacion: [row['FECHA_CANCELACION'] || row['FECHA'] || '', Validators.required],
            valorCancelado: [row['VALOR_CANCELADO'] || row['CANCELADO'] || '', [Validators.required, Validators.pattern('^[0-9,.]*$')]]
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

  onValueChange(campo: string): void {
    const valor = this.providenciaForm.get(campo)?.value;

    if (!valor) {
      this.valoresEnLetras[campo] = '';
      return;
    }

    try {
      const valorNormalizado = this.normalizarValorConDecimales(valor);
      const { entero, fraccion } = this.separarEnteroYDecimal(valorNormalizado);
      const valorEnLetras = this.convertirNumeroALetras(entero).toUpperCase();
      this.valoresEnLetras[campo] = `${valorEnLetras} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${fraccion}/100 (USD$ ${this.formatearNumeroConMiles(valorNormalizado)})`;
    } catch (error) {
      console.error('Error al convertir valor:', error);
      this.valoresEnLetras[campo] = '';
    }
  }

  formatearNumeroConMiles(valor: string | number): string {
    if (!valor && valor !== 0) return '0.00';

    const valorNormalizado = this.normalizarValorConDecimales(valor);
    const partes = valorNormalizado.split('.');
    const entero = partes[0];
    const decimal = partes[1] || '00';
    const enteroFormateado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return `${enteroFormateado}.${decimal}`;
  }

  formatearValorTabla(valor: any): string {
    if (!valor) return '0.00';
    const valorNormalizado = this.normalizarValorConDecimales(valor);
    return this.formatearNumeroConMiles(valorNormalizado);
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

  formatearValorRetencion(capitalString: string): string {
    if (!capitalString) return '';

    try {
      const capitalNormalizado = capitalString.toString().replace(/,/g, '.');
      const capitalNumerico = parseFloat(capitalNormalizado);

      if (isNaN(capitalNumerico)) return '';

      const valorRetencion = Math.ceil(capitalNumerico * 1.30);
      return valorRetencion.toFixed(2);
    } catch (error) {
      console.error('Error al calcular valor de retención:', error);
      return '';
    }
  }

  calcularValorRetencion(capital: number): number {
    return Math.ceil(capital * 1.30);
  }

  calcularValorRetencionTotal(): string {
    if (this.titulos.length === 0) return '$0.00';

    try {
      const totalStr = this.calcularTotalLiquidacion();
      const totalLimpio = totalStr.replace(/\$|,/g, '');
      const totalNumerico = parseFloat(totalLimpio);

      if (isNaN(totalNumerico)) return '$0.00';

      const valorRetencion = Math.ceil(totalNumerico * 1.30);
      return `$${valorRetencion.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    } catch (error) {
      console.error('Error al calcular valor de retención total:', error);
      return '$0.00';
    }
  }

  calcularTotalLiquidacion(): string {
    if (this.titulos.length === 0) return '$0.00';

    let total = 0;
    this.titulos.value.forEach((titulo: any) => {
      const valorLiquidacion = titulo.valorLiquidacion || titulo.valorCapital || '0';
      const valorNormalizado = this.normalizarValorConDecimales(valorLiquidacion);
      total += parseFloat(valorNormalizado);
    });

    const totalFormateado = total.toFixed(2);
    return `$${totalFormateado.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }

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

  convertirNombreMinusculas(nombre: string): string {
    const palabras = nombre.split(' ');
    return palabras.map((palabra, index) => {
      if (index === 0) {
        return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
      }
      return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
    }).join(' ');
  }

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

    const formValues = this.providenciaForm.value;
    const abogadoSeleccionado = this.abogados.find(a => a.nombre === formValues.abogadoSeleccionado);

    if (!abogadoSeleccionado) {
      this.message.error('Debe seleccionar un abogado');
      return;
    }

    if (this.tipoProvidencia === 'rpv') {
      const datos: any = {
        fechaProvidencia: this.formatearFecha(formValues.fechaProvidencia),
        numeroTC: formValues.numeroTC,
        cedula: formValues.cedula,
        representanteLegal: formValues.representanteLegal,
        abogadoNombreMinusculas: this.convertirNombreMinusculas(abogadoSeleccionado.nombre),
        genero: abogadoSeleccionado.genero,
        pronombre: abogadoSeleccionado.pronombre,
        correosAb: abogadoSeleccionado.correos
      };

      if (this.tipoPersona === 'juridica') {
        datos.razonSocial = formValues.razonSocial;
        datos.ruc = formValues.ruc;
      }

      this.guardarOActualizarProvidencia(datos, formValues);
      return;
    }

    if (this.editingProvidenciaIndex === null) {
      if (!this.horaBase) {
        this.horaBase = formValues.horaProvidencia;
      } else {
        this.contadorMinutos += 2;
        this.horaBase = new Date(formValues.horaProvidencia.getTime() + this.contadorMinutos * 60000);
      }
    }

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

    if (this.tipoPersona === 'juridica') {
      datos.representanteLegal = formValues.representanteLegal;
    }

    if (this.tipoProvidencia === 'opi') {
      if (this.esIndividual) {
        datos.nroProcedimientoCoactivo = formValues.numeroTC;
        datos.numeroTC = formValues.numeroTC;

        if (formValues.fechanotificacionRPV) {
          const fechaRPV = formValues.fechanotificacionRPV instanceof Date ?
            formValues.fechanotificacionRPV :
            new Date(formValues.fechanotificacionRPV);
          datos.fechanotificacionRPV = this.formatearFecha(fechaRPV);
        }
        datos.concepto = formValues.concepto;

        const capitalNorm = this.normalizarValorConDecimales(formValues.capital);
        const capDes = this.separarEnteroYDecimal(capitalNorm);
        datos.capital = this.formatearNumeroConMiles(capitalNorm);
        datos.valorLetrasCapital = `${this.convertirNumeroALetras(capDes.entero).toUpperCase()} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${capDes.fraccion}/100`;

        const liqNorm = this.normalizarValorConDecimales(formValues.liquidacion);
        const liqDes = this.separarEnteroYDecimal(liqNorm);
        datos.liquidacion = this.formatearNumeroConMiles(liqNorm);
        datos.valorLetrasLiquidacion = `${this.convertirNumeroALetras(liqDes.entero).toUpperCase()} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${liqDes.fraccion}/100`;

        const valRetencion = (parseFloat(liqNorm) * 1.30);
        const retencionFinal = Math.ceil(valRetencion).toFixed(2);
        const retDes = this.separarEnteroYDecimal(retencionFinal);

        datos.valorRetencion = this.formatearNumeroConMiles(retencionFinal);
        datos.valorLetrasRetencion = `${this.convertirNumeroALetras(retDes.entero).toUpperCase()} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${retDes.fraccion}/100`;

      } else {
        if (this.titulos.length === 0) {
          this.message.error('Debe agregar al menos un título de crédito');
          return;
        }

        if (formValues.fechanotificacionRPV) {
          const fechaRPV = formValues.fechanotificacionRPV instanceof Date ?
            formValues.fechanotificacionRPV :
            new Date(formValues.fechanotificacionRPV);
          datos.fechanotificacionRPV = this.formatearFecha(fechaRPV);
        }

        datos.titulos = this.titulos.value.map((titulo: any) => {
          const liqNorm = this.normalizarValorConDecimales(titulo.valorLiquidacion || titulo.valorCapital);
          const retencionPorTitulo = (parseFloat(liqNorm) * 1.30);
          const retencionFinal = Math.ceil(retencionPorTitulo).toFixed(2);

          return {
            orden: titulo.orden,
            numeroTC: titulo.numeroTC,
            concepto: Array.isArray(titulo.concepto) ? titulo.concepto.join(', ') : titulo.concepto,
            valorCapital: this.formatearNumeroConMiles(this.normalizarValorConDecimales(titulo.valorCapital)),
            valorRetencion: this.formatearNumeroConMiles(retencionFinal)
          };
        });

        datos.liquidaciones = this.titulos.value.map((titulo: any) => ({
          orden: titulo.orden,
          numeroTC: titulo.numeroTC,
          valorLiquidacion: this.formatearNumeroConMiles(this.normalizarValorConDecimales(titulo.valorLiquidacion || titulo.valorCapital))
        }));

        const totalCap = this.calcularTotalConFraccion();
        datos.totalCapital = totalCap.formateado;
        datos.totalCapitalLetras = `${this.convertirNumeroALetras(totalCap.entero).toUpperCase()} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${totalCap.fraccion}/100`;

        const totalLiq = this.calcularTotalLiquidacionConFraccion();
        datos.totalLiquidacion = totalLiq.formateado;
        datos.totalLiquidacionLetras = `${this.convertirNumeroALetras(totalLiq.entero).toUpperCase()} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${totalLiq.fraccion}/100`;

        const totalLiqNum = parseFloat(`${totalLiq.entero}.${totalLiq.fraccion}`);
        const retencionTotal = Math.ceil(totalLiqNum * 1.30).toFixed(2);
        const retTotalDes = this.separarEnteroYDecimal(retencionTotal);

        datos.valorRetencion = this.formatearNumeroConMiles(retencionTotal);
        datos.valorLetrasRetencion = `${this.convertirNumeroALetras(retTotalDes.entero).toUpperCase()} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${retTotalDes.fraccion}/100`;
      }

      this.guardarOActualizarProvidencia(datos, formValues);
      return;
    }

    if (this.tipoProvidencia === 'individual') {
      datos.nroProcedimientoCoactivo = formValues.numeroTC;
      datos.numeroTC = formValues.numeroTC;
      datos.comprobante = formValues.comprobante;
      datos.fechaCancelacion = formValues.fechaCancelacion instanceof Date ? this.formatearFecha(formValues.fechaCancelacion) : formValues.fechaCancelacion;

      const capNorm = this.normalizarValorConDecimales(formValues.capital);
      const capDes = this.separarEnteroYDecimal(capNorm);
      datos.capital = this.formatearNumeroConMiles(capNorm);
      datos.valorLetrasCapital = `${this.convertirNumeroALetras(capDes.entero).toUpperCase()} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${capDes.fraccion}/100`;

      const cancNorm = this.normalizarValorConDecimales(formValues.cancelacion);
      const cancDes = this.separarEnteroYDecimal(cancNorm);
      datos.cancelacion = this.formatearNumeroConMiles(cancNorm);
      datos.valorLetrasCancelacion = `${this.convertirNumeroALetras(cancDes.entero).toUpperCase()} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${cancDes.fraccion}/100`;

    } else {
      if (this.titulos.length === 0) {
        this.message.error('Debe agregar al menos un título de crédito');
        return;
      }

      datos.titulos = this.titulos.value.map((titulo: any) => ({
        orden: titulo.orden,
        numeroTC: titulo.numeroTC,
        concepto: Array.isArray(titulo.concepto) ? titulo.concepto.join(', ') : titulo.concepto,
        valorCapital: this.formatearNumeroConMiles(this.normalizarValorConDecimales(titulo.valorCapital))
      }));

      const totalCap = this.calcularTotalConFraccion();
      datos.totalCapital = totalCap.formateado;
      datos.totalCapitalLetras = `${this.convertirNumeroALetras(totalCap.entero).toUpperCase()} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON ${totalCap.fraccion}/100`;

      datos.cancelaciones = this.titulos.value.map((titulo: any) => ({
        orden: titulo.orden,
        numeroTC: titulo.numeroTC,
        concepto: Array.isArray(titulo.concepto) ? titulo.concepto.join(', ') : titulo.concepto,
        comprobante: titulo.comprobante || '',
        fechaCancelacion: titulo.fechaCancelacion instanceof Date ? this.formatearFechaCorta(titulo.fechaCancelacion) : titulo.fechaCancelacion || '',
        valorCancelado: this.formatearNumeroConMiles(this.normalizarValorConDecimales(titulo.valorCancelado || titulo.valorCapital))
      }));
    }

    this.guardarOActualizarProvidencia(datos, formValues);
  }

  guardarOActualizarProvidencia(datos: any, formValues: any): void {
    const nuevaProvidencia = {
      tipo: this.tipoProvidencia,
      tipoDocumento: this.tipoDocumento,
      personaTipo: this.tipoPersona,
      datos: datos,
      fechaOriginal: formValues.fechaProvidencia,
      horaOriginal: this.horaBase || formValues.horaProvidencia,
      formValuesOriginal: JSON.parse(JSON.stringify(formValues))
    };

    let etiquetaTipo = 'Providencia';
    if (this.tipoProvidencia === 'rpv') etiquetaTipo = 'RPV';
    else if (this.tipoProvidencia === 'opi') etiquetaTipo = 'OPI';

    const numeroSecuencial = this.editingProvidenciaIndex !== null
      ? this.editingProvidenciaIndex + 1
      : this.providenciasAcumuladas.length + 1;

    const mensajeHora = datos.horaProvidencia ? `. Hora: ${datos.horaProvidencia}` : '';

    if (this.editingProvidenciaIndex !== null) {
      this.providenciasAcumuladas[this.editingProvidenciaIndex] = nuevaProvidencia;
      this.message.success(`${etiquetaTipo} ${numeroSecuencial} actualizado${mensajeHora}`);
      this.editingProvidenciaIndex = null;
    } else {
      this.providenciasAcumuladas.push(nuevaProvidencia);
      this.message.success(`${etiquetaTipo} ${numeroSecuencial} agregado${mensajeHora}`);
    }

    this.resetFormularioParaSiguiente();
  }

  resetFormularioParaSiguiente(): void {
    const fechaActual = this.providenciaForm.get('fechaProvidencia')?.value;
    const horaActual = this.providenciaForm.get('horaProvidencia')?.value;
    const abogadoActual = this.providenciaForm.get('abogadoSeleccionado')?.value;
    const conceptoActual = this.providenciaForm.get('conceptoGeneral')?.value;

    this.providenciaForm.reset();

    const valoresARestaurar: any = {
      fechaProvidencia: fechaActual,
      abogadoSeleccionado: abogadoActual
    };

    if (this.tipoProvidencia !== 'rpv') {
      valoresARestaurar.horaProvidencia = horaActual;
    }

    if (this.esAgrupados && conceptoActual) {
      valoresARestaurar.conceptoGeneral = conceptoActual;
    }

    this.providenciaForm.patchValue(valoresARestaurar);

    if (this.tipoProvidencia === 'agrupados' || (this.tipoProvidencia === 'opi' && this.esAgrupados)) {
      if (this.providenciaForm.contains('titulos')) {
        this.providenciaForm.setControl('titulos', this.fb.array([]));
      }
    }

    this.valoresEnLetras = {};
  }

  verProvidenciasAcumuladas(): void {
    if (this.providenciasAcumuladas.length === 0) {
      this.message.info('No hay providencias acumuladas');
      return;
    }

    this.isModalProvidenciasVisible = true;
  }

  cerrarModalProvidencias(): void {
    this.isModalProvidenciasVisible = false;
  }

  eliminarProvidenciaDesdeModal(index: number): void {
    this.modal.confirm({
      nzTitle: '¿Eliminar esta providencia?',
      nzContent: `¿Está seguro de eliminar la providencia de ${this.providenciasAcumuladas[index].datos.razonSocial}?`,
      nzOkText: 'Eliminar',
      nzOkDanger: true,
      nzOnOk: () => {
        this.providenciasAcumuladas.splice(index, 1);
        this.message.success('Providencia eliminada');

        if (this.providenciasAcumuladas.length === 0) {
          this.cerrarModalProvidencias();
        }
      },
      nzCancelText: 'Cancelar'
    });
  }

  editarProvidenciaDesdeModal(index: number): void {
    this.cerrarModalProvidencias();
    this.editarProvidencia(index);
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
        this.editingProvidenciaIndex = null;
        this.message.success('Providencias acumuladas eliminadas');
      },
      nzCancelText: 'Cancelar'
    });
  }

  editarProvidencia(index: number): void {
    const providencia = this.providenciasAcumuladas[index];

    if (!providencia.formValuesOriginal) {
      this.message.error('No se pueden cargar los datos originales');
      return;
    }

    this.editingProvidenciaIndex = index;

    const valoresRestaurados = { ...providencia.formValuesOriginal };

    if (valoresRestaurados.fechaProvidencia && !(valoresRestaurados.fechaProvidencia instanceof Date)) {
      valoresRestaurados.fechaProvidencia = new Date(valoresRestaurados.fechaProvidencia);
    }

    if (valoresRestaurados.horaProvidencia && !(valoresRestaurados.horaProvidencia instanceof Date)) {
      valoresRestaurados.horaProvidencia = new Date(valoresRestaurados.horaProvidencia);
    }

    if (valoresRestaurados.fechaCancelacion && !(valoresRestaurados.fechaCancelacion instanceof Date)) {
      valoresRestaurados.fechaCancelacion = new Date(valoresRestaurados.fechaCancelacion);
    }

    if (valoresRestaurados.fechanotificacionRPV && !(valoresRestaurados.fechanotificacionRPV instanceof Date)) {
      valoresRestaurados.fechanotificacionRPV = new Date(valoresRestaurados.fechanotificacionRPV);
    }

    this.providenciaForm.patchValue(valoresRestaurados);

    if (providencia.tipo === 'agrupados') {
      this.providenciaForm.setControl('titulos', this.fb.array([]));

      if (valoresRestaurados.titulos) {
        valoresRestaurados.titulos.forEach((titulo: any) => {
          this.titulos.push(this.fb.group({
            orden: titulo.orden,
            numeroTC: titulo.numeroTC,
            concepto: titulo.concepto,
            valorCapital: titulo.valorCapital,
            comprobante: titulo.comprobante || '',
            fechaCancelacion: titulo.fechaCancelacion || '',
            valorCancelado: titulo.valorCancelado || titulo.valorCapital
          }));
        });
      }
    }

    if (providencia.tipo === 'opi' && providencia.tipoDocumento === 'agrupados') {
      this.providenciaForm.setControl('titulos', this.fb.array([]));

      if (valoresRestaurados.titulos) {
        valoresRestaurados.titulos.forEach((titulo: any) => {
          this.titulos.push(this.fb.group({
            orden: titulo.orden,
            numeroTC: titulo.numeroTC,
            concepto: titulo.concepto,
            valorCapital: titulo.valorCapital,
            valorLiquidacion: titulo.valorLiquidacion || titulo.valorCapital
          }));
        });
      }
    }

    if (providencia.horaOriginal) {
      this.horaBase = new Date(providencia.horaOriginal);
      this.contadorMinutos = 0;
    }

    this.message.info('Providencia cargada para edición. Haga los cambios y presione "Guardar Cambios"');
  }

  async onSubmit(): Promise<void> {
    if (this.editingProvidenciaIndex !== null) {
      this.acumularProvidencia();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.providenciasAcumuladas.length === 0) {
      this.editingProvidenciaIndex = null;
      this.acumularProvidencia();
    }

    if (this.providenciasAcumuladas.length === 0) {
      return;
    }

    try {
      if (this.tipoProvidencia === 'rpv') {
        this.message.info(`Generando ${this.providenciasAcumuladas.length} RPV...`);

        const fechaRpv = this.providenciasAcumuladas[0].fechaOriginal;
        await this.documentoService.generarRpvMultiples(this.providenciasAcumuladas, fechaRpv);
        this.message.success('RPV generados correctamente');

        this.providenciasAcumuladas = [];
        this.editingProvidenciaIndex = null;
        this.providenciaForm.reset();

        return;
      }

      if (this.tipoProvidencia === 'opi') {
        this.message.info(`Generando ${this.providenciasAcumuladas.length} OPI...`);

        const fechaOpi = this.providenciasAcumuladas[0].fechaOriginal;
        await this.documentoService.generarOpiMultiples(this.providenciasAcumuladas, fechaOpi);
        this.message.success('OPI generados correctamente');

        this.providenciasAcumuladas = [];
        this.horaBase = null;
        this.contadorMinutos = 0;
        this.editingProvidenciaIndex = null;

        if (this.providenciaForm.contains('titulos')) {
          this.providenciaForm.setControl('titulos', this.fb.array([]));
        }

        this.providenciaForm.reset();

        const horaDefecto = new Date();
        horaDefecto.setHours(8, 0, 0, 0);
        this.providenciaForm.patchValue({
          horaProvidencia: horaDefecto
        });

        return;
      }

      this.message.info(`Generando documento con ${this.providenciasAcumuladas.length} providencia(s)...`);

      const fechaProvidencia = this.providenciasAcumuladas[0].fechaOriginal;
      await this.documentoService.generarProvidenciasMultiples(this.providenciasAcumuladas, fechaProvidencia);
      this.message.success('Documento generado correctamente');

      this.providenciasAcumuladas = [];
      this.horaBase = null;
      this.contadorMinutos = 0;
      this.editingProvidenciaIndex = null;

      if (this.providenciaForm.contains('titulos')) {
        this.providenciaForm.setControl('titulos', this.fb.array([]));
      }

      this.providenciaForm.reset();

      const horaDefecto = new Date();
      horaDefecto.setHours(8, 0, 0, 0);
      this.providenciaForm.patchValue({
        horaProvidencia: horaDefecto
      });

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

  calcularTotal(): string {
    const total = this.calcularTotalConFraccion();
    return total.formateado;
  }

  calcularTotalConFraccion(): { entero: number, fraccion: string, formateado: string } {
    let totalDecimal = 0;

    this.titulos.controls.forEach((titulo: any) => {
      const valor = titulo.value.valorCapital;
      if (valor) {
        const valorNormalizado = this.normalizarValorConDecimales(valor);
        totalDecimal += parseFloat(valorNormalizado);
      }
    });

    const totalStr = totalDecimal.toFixed(2);
    const partes = totalStr.split('.');

    return {
      entero: parseInt(partes[0]),
      fraccion: partes[1],
      formateado: this.formatearNumeroConMiles(totalStr)
    };
  }

  calcularTotalLiquidacionConFraccion(): { entero: number, fraccion: string, formateado: string } {
    let total = 0;

    this.titulos.value.forEach((titulo: any) => {
      const valorLiquidacion = titulo.valorLiquidacion || titulo.valorCapital || '0';
      const valorNormalizado = this.normalizarValorConDecimales(valorLiquidacion);
      total += parseFloat(valorNormalizado);
    });

    const totalStr = total.toFixed(2);
    const partes = totalStr.split('.');

    return {
      entero: parseInt(partes[0], 10),
      fraccion: partes[1] || '00',
      formateado: this.formatearNumeroConMiles(totalStr)
    };
  }

  calcularRetencionPorTitulo(valorLiquidacion: string | number): string {
    if (!valorLiquidacion) return '$0.00';

    const valorNormalizado = this.normalizarValorConDecimales(valorLiquidacion.toString());
    const retencion = parseFloat(valorNormalizado) * 1.30;
    const retencionRedondeada = Math.ceil(retencion).toFixed(2);

    return this.formatearNumeroConMiles(retencionRedondeada);
  }

  private normalizarValorConDecimales(valor: string | number): string {
    if (!valor) return '0.00';

    let valorStr = String(valor).trim();

    const ultimoPunto = valorStr.lastIndexOf('.');
    const ultimaComa = valorStr.lastIndexOf(',');

    if (ultimoPunto > -1 && ultimaComa > -1) {
      if (ultimoPunto > ultimaComa) {
        valorStr = valorStr.replace(/,/g, '');
      } else {
        valorStr = valorStr.replace(/\./g, '').replace(',', '.');
      }
    } else if (ultimaComa > -1) {
      const partesDespuesComa = valorStr.split(',')[1];
      if (partesDespuesComa && partesDespuesComa.length <= 2) {
        valorStr = valorStr.replace(',', '.');
      } else {
        valorStr = valorStr.replace(/,/g, '');
      }
    }

    const numero = parseFloat(valorStr);

    if (isNaN(numero)) return '0.00';

    return numero.toFixed(2);
  }

  private separarEnteroYDecimal(valor: string): { entero: number, fraccion: string } {
    const valorNormalizado = this.normalizarValorConDecimales(valor);
    const partes = valorNormalizado.split('.');

    return {
      entero: parseInt(partes[0]),
      fraccion: partes[1] || '00'
    };
  }
}