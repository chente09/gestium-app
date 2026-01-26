import { Injectable } from '@angular/core';
import { serverTimestamp, Timestamp } from '@angular/fire/firestore';

/**
 * Servicio centralizado para manejo de fechas y timestamps
 * Garantiza consistencia usando Firebase Server Timestamp
 * y zona horaria de Ecuador (America/Guayaquil - UTC-5)
 */
@Injectable({
  providedIn: 'root'
})
export class DateUtilsService {
  
  private readonly ECUADOR_TIMEZONE = 'America/Guayaquil';
  
  constructor() {}
  
  // ==================== MÉTODOS PARA UI (PROVISIONAL) ====================
  
  /**
   * Obtiene la fecha actual de Ecuador para mostrar en UI
   * Usa zona horaria America/Guayaquil (UTC-5)
   * @returns Fecha en formato YYYY-MM-DD
   */
  getFechaActualEcuador(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.ECUADOR_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    return formatter.format(new Date());
  }
  
  /**
   * Obtiene la hora actual de Ecuador para mostrar en UI
   * @returns Hora en formato HH:MM (24 horas)
   */
  getHoraActualEcuador(): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.ECUADOR_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(new Date());
    const hora = parts.find(p => p.type === 'hour')?.value || '00';
    const minuto = parts.find(p => p.type === 'minute')?.value || '00';
    
    return `${hora}:${minuto}`;
  }
  
  // ==================== MÉTODOS PARA FIREBASE ====================
  
  /**
   * Obtiene el timestamp del servidor de Firebase
   * Este es el método MÁS CONFIABLE para guardar fechas
   * @returns Server timestamp de Firebase
   */
  getServerTimestamp() {
    return serverTimestamp();
  }
  
  /**
   * Convierte un Timestamp de Firebase a fecha legible
   * @param timestamp Timestamp de Firestore
   * @returns Fecha en formato YYYY-MM-DD (zona horaria Ecuador)
   */
  timestampToFecha(timestamp: Timestamp): string {
    if (!timestamp || !timestamp.toDate) {
      console.warn('Timestamp inválido recibido');
      return this.getFechaActualEcuador();
    }
    
    const date = timestamp.toDate();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.ECUADOR_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    return formatter.format(date);
  }
  
  /**
   * Convierte un Timestamp de Firebase a hora legible
   * @param timestamp Timestamp de Firestore
   * @returns Hora en formato HH:MM
   */
  timestampToHora(timestamp: Timestamp): string {
    if (!timestamp || !timestamp.toDate) {
      console.warn('Timestamp inválido recibido');
      return this.getHoraActualEcuador();
    }
    
    const date = timestamp.toDate();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.ECUADOR_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const hora = parts.find(p => p.type === 'hour')?.value || '00';
    const minuto = parts.find(p => p.type === 'minute')?.value || '00';
    
    return `${hora}:${minuto}`;
  }
  
  /**
   * Convierte Timestamp a formato completo legible
   * @param timestamp Timestamp de Firestore
   * @returns String formateado (ej: "26 de enero de 2026, 14:30")
   */
  timestampToFechaHoraLegible(timestamp: Timestamp): string {
    if (!timestamp || !timestamp.toDate) {
      return 'Fecha no disponible';
    }
    
    const date = timestamp.toDate();
    const formatter = new Intl.DateTimeFormat('es-EC', {
      timeZone: this.ECUADOR_TIMEZONE,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    return formatter.format(date);
  }
  
  // ==================== MÉTODOS DE COMPARACIÓN ====================
  
  /**
   * Verifica si una fecha está vencida (es anterior a hoy)
   * @param fechaTermino Fecha en formato YYYY-MM-DD
   * @returns true si está vencida (anterior a hoy), false si es hoy o futura
   */
  isFechaVencida(fechaTermino: string): boolean {
    if (!fechaTermino) return false;
    
    const fechaActual = this.getFechaActualEcuador();
    
    // Comparación estricta: solo vencidas (sin incluir hoy)
    return fechaTermino < fechaActual;
  }
  
  /**
   * Verifica si una fecha es hoy
   * @param fecha Fecha en formato YYYY-MM-DD
   * @returns true si la fecha es hoy
   */
  isFechaHoy(fecha: string): boolean {
    if (!fecha) return false;
    
    const fechaActual = this.getFechaActualEcuador();
    return fecha === fechaActual;
  }
  
  /**
   * Verifica si una fecha es futura
   * @param fecha Fecha en formato YYYY-MM-DD
   * @returns true si la fecha es posterior a hoy
   */
  isFechaFutura(fecha: string): boolean {
    if (!fecha) return false;
    
    const fechaActual = this.getFechaActualEcuador();
    return fecha > fechaActual;
  }
  
  /**
   * Calcula los días restantes hasta una fecha
   * @param fechaTermino Fecha objetivo en formato YYYY-MM-DD
   * @returns Número de días (negativo si ya pasó, 0 si es hoy, positivo si es futuro)
   */
  getDiasRestantes(fechaTermino: string): number {
    if (!fechaTermino) return 0;
    
    const fechaActual = new Date(this.getFechaActualEcuador());
    const fechaObjetivo = new Date(fechaTermino);
    
    // Normalizar a medianoche para comparación de días completos
    fechaActual.setHours(0, 0, 0, 0);
    fechaObjetivo.setHours(0, 0, 0, 0);
    
    const diffTime = fechaObjetivo.getTime() - fechaActual.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }
  
  /**
   * Obtiene los días vencidos (valor absoluto)
   * @param fechaTermino Fecha que debió cumplirse
   * @returns Número de días vencidos (siempre positivo)
   */
  getDiasVencidos(fechaTermino: string): number {
    const diasRestantes = this.getDiasRestantes(fechaTermino);
    return diasRestantes < 0 ? Math.abs(diasRestantes) : 0;
  }
  
  // ==================== MÉTODOS DE FORMATO ====================
  
  /**
   * Formatea una fecha a texto legible en español
   * @param fecha Fecha en formato YYYY-MM-DD
   * @returns String formateado (ej: "26 de enero de 2026")
   */
  formatFechaLegible(fecha: string): string {
    if (!fecha) return 'Fecha no disponible';
    
    try {
      const [year, month, day] = fecha.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      const formatter = new Intl.DateTimeFormat('es-EC', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: this.ECUADOR_TIMEZONE
      });
      
      return formatter.format(date);
    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return fecha;
    }
  }
  
  /**
   * Formatea una fecha en formato corto
   * @param fecha Fecha en formato YYYY-MM-DD
   * @returns String formateado (ej: "26/01/2026")
   */
  formatFechaCorta(fecha: string): string {
    if (!fecha) return '';
    
    try {
      const [year, month, day] = fecha.split('-');
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error al formatear fecha corta:', error);
      return fecha;
    }
  }
  
  // ==================== VALIDADORES ====================
  
  /**
   * Valida que una fecha término sea válida (hoy o futura)
   * @param fechaTermino Fecha en formato YYYY-MM-DD
   * @returns true si es válida, false si es pasada
   */
  validarFechaTermino(fechaTermino: string): boolean {
    if (!fechaTermino) return false;
    
    const fechaActual = this.getFechaActualEcuador();
    
    // Fecha término debe ser hoy o posterior
    return fechaTermino >= fechaActual;
  }
  
  /**
   * Valida formato de fecha YYYY-MM-DD
   * @param fecha String a validar
   * @returns true si el formato es correcto
   */
  validarFormatoFecha(fecha: string): boolean {
    if (!fecha) return false;
    
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(fecha)) return false;
    
    const [year, month, day] = fecha.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day;
  }
  
  // ==================== UTILIDADES ====================
  
  /**
   * Obtiene información completa sobre una fecha
   * @param fecha Fecha en formato YYYY-MM-DD
   * @returns Objeto con información detallada
   */
  getInfoFecha(fecha: string): {
    fecha: string;
    fechaLegible: string;
    diasRestantes: number;
    diasVencidos: number;
    esHoy: boolean;
    esVencida: boolean;
    esFutura: boolean;
    estado: 'vencida' | 'hoy' | 'futura';
  } {
    return {
      fecha: fecha,
      fechaLegible: this.formatFechaLegible(fecha),
      diasRestantes: this.getDiasRestantes(fecha),
      diasVencidos: this.getDiasVencidos(fecha),
      esHoy: this.isFechaHoy(fecha),
      esVencida: this.isFechaVencida(fecha),
      esFutura: this.isFechaFutura(fecha),
      estado: this.isFechaVencida(fecha) ? 'vencida' : 
              this.isFechaHoy(fecha) ? 'hoy' : 'futura'
    };
  }
  
  /**
   * Debug: Obtiene información del sistema
   * @returns Objeto con información de debug
   */
  getDebugInfo(): {
    fechaNavegador: string;
    horaNavegador: string;
    fechaEcuador: string;
    horaEcuador: string;
    timezone: string;
    offset: number;
  } {
    const now = new Date();
    
    return {
      fechaNavegador: now.toISOString().split('T')[0],
      horaNavegador: now.toTimeString().slice(0, 5),
      fechaEcuador: this.getFechaActualEcuador(),
      horaEcuador: this.getHoraActualEcuador(),
      timezone: this.ECUADOR_TIMEZONE,
      offset: now.getTimezoneOffset()
    };
  }
}