import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NumberUtilsService {

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
   * Convierte un número a su representación en letras (Hasta 999,999,999)
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
}
