import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DocumentoService } from '../../../services/document/documento.service';
import { CommonModule } from '@angular/common';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-dmd-proc-ordinario',
  imports: [
    ReactiveFormsModule,
    CommonModule,
    NzFormModule,
    NzInputModule,
    NzDatePickerModule,
    NzButtonModule,
    NzIconModule
  ],
  templateUrl: './dmd-proc-ordinario.component.html',
  styleUrl: './dmd-proc-ordinario.component.css'
})
export class DmdProcOrdinarioComponent {
  demandaForm: FormGroup;
  valoresEnLetras: { [key: string]: string } = {};
  valoresFormateados: { [key: string]: string } = {}; // Para almacenar valores formateados

  constructor(
    private fb: FormBuilder,
    private documentoService: DocumentoService
  ) {
    this.demandaForm = this.fb.group({
      demandadoNombre: ['', Validators.required],
      demandadoCedula: ['', Validators.required],
      nroFojas: ['', Validators.required],
      nroFojasAbonos: ['', Validators.required],
      fechaEmision: ['', Validators.required],
      nroTC: ['', Validators.required],
      tipoTC: ['', Validators.required],
      fechaVencimiento: ['', Validators.required],
      fechaLiquidacion: ['', Validators.required],
      saldoCapital: ['', [Validators.required, Validators.pattern("^[0-9,]*$")]],
      frcCapital: ['', Validators.required],
      interesFinanciado: ['', [Validators.required, Validators.pattern("^[0-9,]*$")]],
      frcInteresFinanciado: ['', Validators.required],
      interesDiferido: ['', [Validators.required, Validators.pattern("^[0-9,]*$")]],
      frcInteresDiferido: ['', Validators.required],
      interesMora: ['', [Validators.required, Validators.pattern("^[0-9,]*$")]],
      frcInteresMora: ['', Validators.required],
      costosOperativos: ['', [Validators.required, Validators.pattern("^[0-9,]*$")]],
      frcCostosOperativos: ['', Validators.required],
      totalAdeudado: ['', [Validators.required, Validators.pattern("^[0-9,]*$")]],
      frcTotalAdeudado: ['', Validators.required],
    });
  }

  /**
   * Función genérica para convertir cualquier número en el formulario a letras.
   * @param campo - Nombre del campo en el formulario
   */
  onValueChange(campo: string) {
    const valor = this.demandaForm.get(campo)?.value;
  
    // Eliminar comas antes de formatear y convertir
    const valorSinComas = valor.replace(/,/g, '');
  
    // Formatear el valor con separadores de miles si tiene cuatro o más dígitos
    const valorFormateado = this.formatearNumeroConMiles(valorSinComas);
  
    // Almacenar el valor formateado para mostrarlo en el input
    this.valoresFormateados[campo] = valorFormateado;
  
    // Convertir el número a letras (usar valorSinComas para evitar problemas con comas)
    this.valoresEnLetras[campo] = valorSinComas ? this.convertirNumeroALetras(Number(valorSinComas)).toUpperCase() : '';
  }

  /**
   * Formatea un número con separadores de miles.
   * @param valor - Valor a formatear
   * @returns Valor formateado como cadena
   */
  formatearNumeroConMiles(valor: string): string {
    // Eliminar cualquier separador de miles existente
    const valorSinMiles = valor.replace(/,/g, '');

    // Convertir a número y verificar si tiene cuatro o más dígitos
    const numero = Number(valorSinMiles);
    if (!isNaN(numero)) {
      // Formatear el número con separadores de miles
      return numero.toLocaleString('en-US');
    }

    // Devolver el valor original si no necesita formateo
    return valorSinMiles;
  }

  /**
   * Convierte un número a su representación en letras (Hasta 999,999)
   * @param num - Número a convertir
   * @returns Representación en letras del número
   */
  convertirNumeroALetras(num: number): string {
    const unidades = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const centenas = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  
    if (num < 10) return unidades[num];
    if (num < 20) return especiales[num - 10];
    if (num < 100) {
      if (num === 21) return 'veintiuno'; // Sin apócope cuando está solo
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
        return 'veintiún mil' + (resto ? ' ' + this.convertirNumeroALetras(resto) : ''); // Apócope para 21,000
      }
      // Manejo de otros casos (31, 41, 51, etc.)
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

  onSubmit() {
    if (this.demandaForm.valid) {
      // Obtener los valores del formulario
      const valoresFormulario = this.demandaForm.value;
  
      // Formatear los valores numéricos con separadores de miles
      const saldoCapitalFormateado = this.formatearNumeroConMiles(valoresFormulario.saldoCapital);
      const interesFinanciadoFormateado = this.formatearNumeroConMiles(valoresFormulario.interesFinanciado);
      const interesDiferidoFormateado = this.formatearNumeroConMiles(valoresFormulario.interesDiferido);
      const interesMoraFormateado = this.formatearNumeroConMiles(valoresFormulario.interesMora);
      const costosOperativosFormateado = this.formatearNumeroConMiles(valoresFormulario.costosOperativos);
      const totalAdeudadoFormateado = this.formatearNumeroConMiles(valoresFormulario.totalAdeudado);
  
      // Formatear las fechas
      const fechaEmisionFormateada = this.formatearFecha(valoresFormulario.fechaEmision);
      const fechaVencimientoFormateada = this.formatearFecha(valoresFormulario.fechaVencimiento);
      const fechaLiquidacionFormateada = this.formatearFecha(valoresFormulario.fechaLiquidacion);
  
      // Crear el objeto de datos a enviar
      const datos = {
        ...valoresFormulario, // Datos originales del formulario
        saldoCapital: saldoCapitalFormateado, // Valor formateado
        interesFinanciado: interesFinanciadoFormateado, // Valor formateado
        interesDiferido: interesDiferidoFormateado, // Valor formateado
        interesMora: interesMoraFormateado, // Valor formateado
        costosOperativos: costosOperativosFormateado, // Valor formateado
        totalAdeudado: totalAdeudadoFormateado, // Valor formateado
        saldoCapitalLetras: this.valoresEnLetras['saldoCapital'],
        interesFinanciadoLetras: this.valoresEnLetras['interesFinanciado'],
        interesDiferidoLetras: this.valoresEnLetras['interesDiferido'],
        interesMoraLetras: this.valoresEnLetras['interesMora'],
        costosOperativosLetras: this.valoresEnLetras['costosOperativos'],
        totalAdeudadoLetras: this.valoresEnLetras['totalAdeudado'],
        fechaEmisionFormateada, // Fecha de emisión formateada
        fechaVencimientoFormateada, // Fecha de vencimiento formateada
        fechaLiquidacionFormateada // Fecha de liquidación formateada
      };
  
      console.log('Datos enviados al documento:', datos);
      this.documentoService.generarDocumento(datos);
    } else {
      console.warn('El formulario no es válido.');
    }
  }

  formatearFecha(fecha: string): string {
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
  
    // Dividir la fecha en año, mes y día
    const [anio, mes, dia] = fecha.split('-');
  
    // Convertir el mes a número y obtener el nombre del mes
    const nombreMes = meses[Number(mes) - 1]; // Los meses en JavaScript son base 0
  
    // Devolver la fecha en el formato deseado
    return `${dia} de ${nombreMes} de ${anio}`;
  }
}