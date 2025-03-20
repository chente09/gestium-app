import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DocumentoService } from '../../services/document/documento.service';
import { CommonModule } from '@angular/common';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-matriz-doc-isffa',
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
  templateUrl: './matriz-doc-isffa.component.html',
  styleUrl: './matriz-doc-isffa.component.css'
})
export class MatrizDocIsffaComponent {
  demandaForm: FormGroup;
  valoresEnLetras: { [key: string]: string } = {};
  valoresFormateados: { [key: string]: string } = {};

  constructor(
    private fb: FormBuilder,
    private documentoService: DocumentoService
  ) {
    this.demandaForm = this.fb.group({
      numeroMatriz: ['', Validators.required],
      pronombre: ['', Validators.required],
      nombreCliente: ['', Validators.required],
      estadoCivil: ['', Validators.required],
      fechaEmision: ['', Validators.required],
      fechaVencimiento: ['', Validators.required],
      notaria: ['', Validators.required],
      canton: ['', Validators.required],
      nombreNotario: ['', Validators.required],
      cantonInscripcion: ['', Validators.required],
      fechaLiquidacion: ['', Validators.required],
      tipoPrestamo: ['', Validators.required],
      destinoPrestamo: ['', Validators.required],
      parroquiaUbi: ['', Validators.required],
      cantonUbi: ['', Validators.required],
      provinciaUbi: ['', Validators.required],
      pronombre2: ['', Validators.required],
      numOficio: ['', [Validators.pattern("^[0-9,]*$")]],
      fechaOficio: ['', Validators.required],
      encargadoOficio: ['', Validators.required],
      tipoPrestamoCancel: ['', Validators.required],
      nota: ['', Validators.required],

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
      const numOficioFormateado = this.formatearNumeroConMiles(valoresFormulario.numOficio);


      // Formatear las fechas
      const fechaEmisionFormateada = this.formatearFecha(valoresFormulario.fechaEmision);
      const fechaOtrogamientoFormateada = this.formatearFecha(valoresFormulario.fechaVencimiento);
      const fechaInscripcionFormateada = this.formatearFecha(valoresFormulario.fechaLiquidacion);
      const fechaOficioFormateada = this.formatearFecha(valoresFormulario.fechaOficio);

      // Crear el objeto de datos a enviar
      const datos = {
        ...valoresFormulario, // Datos originales del formulario
        numOficio: numOficioFormateado, // Valor formateado
        numOficioLetras: this.valoresEnLetras['numOficio'],
        fechaEmisionFormateada,
        fechaOtrogamientoFormateada,
        fechaInscripcionFormateada,
        fechaOficioFormateada
      };

      console.log('Datos enviados al documento:', datos);
      this.documentoService.generarMatrizIssfa(datos);
    } else {
      console.warn('El formulario no es válido.');
    }
  }

  /**
   * Formatea una fecha en formato legible.
   * @param fecha - Fecha a formatear (puede ser string o Date)
   * @returns Fecha formateada como cadena
   */
  formatearFecha(fecha: string | Date): string {
    const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const numerosEnTexto: { [key: number]: string } = {
      1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis',
      7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez', 11: 'once', 12: 'doce',
      13: 'trece', 14: 'catorce', 15: 'quince', 16: 'dieciséis', 17: 'diecisiete',
      18: 'dieciocho', 19: 'diecinueve', 20: 'veinte', 21: 'veintiuno',
      22: 'veintidós', 23: 'veintitrés', 24: 'veinticuatro', 25: 'veinticinco',
      26: 'veintiséis', 27: 'veintisiete', 28: 'veintiocho', 29: 'veintinueve',
      30: 'treinta', 31: 'treinta y uno'
    };

    const fechaObj = new Date(fecha);
    if (isNaN(fechaObj.getTime())) {
      throw new Error('Fecha inválida');
    }

    const diaSemana = diasSemana[fechaObj.getDay()];
    const dia = fechaObj.getDate();
    const mes = meses[fechaObj.getMonth()];
    const anio = this.convertirAnioATexto(fechaObj.getFullYear());

    return `${diaSemana} ${numerosEnTexto[dia]} de ${mes} del ${anio}`;
  }

  /**
   * Convierte un año a su representación en texto.
   * @param anio - Año a convertir
   * @returns Representación en texto del año
   */
  convertirAnioATexto(anio: number): string {
    const miles = ['mil', 'dos mil', 'tres mil', 'cuatro mil', 'cinco mil', 'seis mil', 'siete mil', 'ocho mil', 'nueve mil'];
    const centenas = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
    const decenas = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const unidades = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  
    if (anio < 1000) {
      return this.convertirNumeroALetras(anio); // Usar la función existente para números menores a 1000
    }
  
    const mil = Math.floor(anio / 1000);
    const resto = anio % 1000;
  
    let resultado = miles[mil - 1] || '';
  
    if (resto === 0) {
      return resultado; // Años como 2000, 3000, etc.
    }
  
    if (resto < 10) {
      resultado += ` ${unidades[resto]}`;
    } else if (resto < 20) {
      resultado += ` ${especiales[resto - 10]}`;
    } else if (resto < 100) {
      resultado += ` ${decenas[Math.floor(resto / 10)]}`;
      if (resto % 10 !== 0) {
        resultado += ` y ${unidades[resto % 10]}`;
      }
    } else {
      const centena = Math.floor(resto / 100);
      const decenaUnidad = resto % 100;
  
      resultado += ` ${centenas[centena]}`;
  
      if (decenaUnidad < 10) {
        resultado += ` ${unidades[decenaUnidad]}`;
      } else if (decenaUnidad < 20) {
        resultado += ` ${especiales[decenaUnidad - 10]}`;
      } else {
        resultado += ` ${decenas[Math.floor(decenaUnidad / 10)]}`;
        if (decenaUnidad % 10 !== 0) {
          resultado += ` y ${unidades[decenaUnidad % 10]}`;
        }
      }
    }
  
    return resultado.trim();
  }



}
