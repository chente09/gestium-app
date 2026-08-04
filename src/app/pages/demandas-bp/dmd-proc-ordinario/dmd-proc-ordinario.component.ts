import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DocumentoService } from '../../../services/document/documento.service';
import { NumberUtilsService } from '../../../services/number-utils/number-utils.service';
import { CommonModule } from '@angular/common';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import {  RouterModule } from '@angular/router';

@Component({
  selector: 'app-dmd-proc-ordinario',
  imports: [
    ReactiveFormsModule,
    CommonModule,
    NzFormModule,
    NzInputModule,
    NzDatePickerModule,
    NzButtonModule,
    NzIconModule,
    NzBreadCrumbModule,
    RouterModule
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
    private documentoService: DocumentoService,
    private numberUtils: NumberUtilsService
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
      saldoCapital: ['', [ Validators.pattern("^[0-9,]*$")]],
      frcCapital: [''],
      interesFinanciado: ['', [ Validators.pattern("^[0-9,]*$")]],
      frcInteresFinanciado: [''],
      interesDiferido: ['', [ Validators.pattern("^[0-9,]*$")]],
      frcInteresDiferido: [''],
      interesMora: ['', [ Validators.pattern("^[0-9,]*$")]],
      frcInteresMora: [''],
      costosOperativos: ['', [ Validators.pattern("^[0-9,]*$")]],
      frcCostosOperativos: [''],
      totalAdeudado: ['', [ Validators.pattern("^[0-9,]*$")]],
      frcTotalAdeudado: [''],
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
    const valorFormateado = this.numberUtils.formatearNumeroConMiles(valorSinComas);

    // Almacenar el valor formateado para mostrarlo en el input
    this.valoresFormateados[campo] = valorFormateado;

    // Convertir el número a letras (usar valorSinComas para evitar problemas con comas)
    this.valoresEnLetras[campo] = valorSinComas ? this.numberUtils.convertirNumeroALetras(Number(valorSinComas)).toUpperCase() : '';
  }

  onSubmit() {
    if (this.demandaForm.valid) {
      // Obtener los valores del formulario
      const valoresFormulario = this.demandaForm.value;
  
      // Formatear los valores numéricos con separadores de miles
      const saldoCapitalFormateado = this.numberUtils.formatearNumeroConMiles(valoresFormulario.saldoCapital);
      const interesFinanciadoFormateado = this.numberUtils.formatearNumeroConMiles(valoresFormulario.interesFinanciado);
      const interesDiferidoFormateado = this.numberUtils.formatearNumeroConMiles(valoresFormulario.interesDiferido);
      const interesMoraFormateado = this.numberUtils.formatearNumeroConMiles(valoresFormulario.interesMora);
      const costosOperativosFormateado = this.numberUtils.formatearNumeroConMiles(valoresFormulario.costosOperativos);
      const totalAdeudadoFormateado = this.numberUtils.formatearNumeroConMiles(valoresFormulario.totalAdeudado);
  
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
      this.documentoService.generarDmdProcOrd(datos);
    } else {
      console.warn('El formulario no es válido.');
    }
  }

  formatearFecha(fecha: string | Date): string {
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
  
    // Verifica si fecha es un objeto Date, y si es así, convierte a formato 'YYYY-MM-DD'
    let fechaObj: Date;
    if (fecha instanceof Date) {
      fechaObj = fecha;
    } else {
      fechaObj = new Date(fecha); // Convierte la cadena 'YYYY-MM-DD' a Date
    }
  
    const dia = fechaObj.getDate().toString().padStart(2, '0');
    const mes = fechaObj.getMonth(); // Mes en base 0
    const anio = fechaObj.getFullYear();
  
    const nombreMes = meses[mes]; // Nombre del mes en español
  
    return `${dia} de ${nombreMes} de ${anio}`;
  }
  
}