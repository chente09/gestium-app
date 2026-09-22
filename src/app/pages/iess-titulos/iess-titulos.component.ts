import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';

import { SharedDataService } from '../../services/sharedData/shared-data.service';
import { CoactivadosService } from '../../services/coactivados/coactivados.service';
import { TitulosCreditoService, CargaTitulos } from '../../services/titulosCredito/titulos-credito.service';
import { EstadoEntrega, formatoMoneda, fechaCorta } from '../../services/titulosCredito/titulos-credito.util';
import {
  TablaHoja,
  FormatoDetectado,
  FilaTitulo,
  FilaInvalida,
  GestionHistorica,
  PlanCarga,
  ItemPlan,
  detectarFormato,
  extraerFilas
} from '../../services/titulosCredito/importador-titulos.util';
import { planificarCarga } from '../../services/titulosCredito/importador-titulos.util';
import { leerArchivoTablas } from './lector-archivo.util';

interface HojaCandidata {
  tabla: TablaHoja;
  formato: FormatoDetectado | null;
  incluida: boolean;
  // Se precarga con lo detectado automáticamente (nombre de hoja / columnas
  // de entrega), pero el admin lo puede corregir antes de analizar.
  estadoEntrega: EstadoEntrega | null;
}

@Component({
  selector: 'app-iess-titulos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzCardModule,
    NzButtonModule,
    NzIconModule,
    NzTagModule,
    NzTableModule,
    NzSelectModule,
    NzRadioModule,
    NzCheckboxModule,
    NzCollapseModule,
    NzPopconfirmModule,
    NzAlertModule,
    NzEmptyModule,
    NzStatisticModule,
    NzBreadCrumbModule
  ],
  templateUrl: './iess-titulos.component.html',
  styleUrl: './iess-titulos.component.css'
})
export class IessTitulosComponent implements OnInit {
  readonly carteras: string[];
  readonly formatoMoneda = formatoMoneda;
  readonly fechaCorta = fechaCorta;

  // Paso 1: archivo y hojas detectadas
  archivo: File | null = null;
  leyendo = false;
  hojas: HojaCandidata[] = [];

  // Paso 2: a qué cartera va la carga
  origenCartera: 'una' | 'archivo' = 'una';
  carteraSeleccionada: string | null = null;
  // Solo para la carga inicial de una cartera — ver nota en importador-titulos.util.
  migrarObservaciones = false;

  // Paso 3: plan y confirmación
  analizando = false;
  plan: PlanCarga | null = null;
  confirmando = false;

  // Historial de cargas (auditoría, solo lectura)
  cargas: CargaTitulos[] = [];
  cargandoHistorial = false;
  deshaciendoCarga: string | null = null;

  // Zona de peligro: vaciar una cartera completa para empezar de cero.
  carteraAVaciar: string | null = null;
  resumenVaciado: { coactivados: number; titulos: number; gestiones: number } | null = null;
  calculandoVaciado = false;
  vaciando = false;

  constructor(
    private sharedData: SharedDataService,
    private titulosService: TitulosCreditoService,
    private coactivadosService: CoactivadosService,
    private message: NzMessageService
  ) {
    this.carteras = this.sharedData.getCarterasIess();
  }

  ngOnInit(): void {
    this.cargarHistorial();
  }

  private async cargarHistorial(): Promise<void> {
    this.cargandoHistorial = true;
    try {
      this.cargas = await this.titulosService.getCargas();
    } catch (error) {
      console.error('Error cargando el historial de importaciones:', error);
    } finally {
      this.cargandoHistorial = false;
    }
  }

  // ============================================
  // 📄 Paso 1: elegir archivo
  // ============================================
  async onArchivoSeleccionado(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = ''; // para poder re-seleccionar el mismo archivo si hace falta
    if (!archivo) return;

    this.reiniciar();
    this.archivo = archivo;
    this.leyendo = true;
    try {
      const tablas = await leerArchivoTablas(archivo);
      this.hojas = tablas.map(tabla => {
        const formato = detectarFormato(tabla);
        return { tabla, formato, incluida: !!formato, estadoEntrega: formato?.estadoEntrega ?? null };
      });

      if (this.hojas.every(h => !h.formato)) {
        this.message.warning('No se reconoció ninguna hoja con títulos de crédito en este archivo.');
      }

      // Si todas las hojas incluidas ya traen el abogado, se puede usar esa
      // columna en vez de tener que elegir una sola cartera para todo el archivo.
      this.origenCartera = this.hojasIncluidas.length > 0 && this.hojasIncluidas.every(h => h.formato!.traeAbogado)
        ? 'archivo'
        : 'una';
    } catch (error) {
      console.error('Error leyendo el archivo:', error);
      this.message.error('No se pudo leer el archivo. ¿Es un .xlsx o .csv válido?');
      this.archivo = null;
    } finally {
      this.leyendo = false;
    }
  }

  get hojasIncluidas(): HojaCandidata[] {
    return this.hojas.filter(h => h.formato && h.incluida);
  }

  get puedeUsarColumnaArchivo(): boolean {
    return this.hojasIncluidas.length > 0 && this.hojasIncluidas.every(h => h.formato!.traeAbogado);
  }

  private reiniciar(): void {
    this.archivo = null;
    this.hojas = [];
    this.origenCartera = 'una';
    this.carteraSeleccionada = null;
    this.migrarObservaciones = false;
    this.plan = null;
  }

  // ============================================
  // 🔎 Paso 2: analizar (construye el plan, no escribe nada todavía)
  // ============================================
  get listoParaAnalizar(): boolean {
    return this.hojasIncluidas.length > 0 && (this.origenCartera === 'archivo' || !!this.carteraSeleccionada);
  }

  async analizar(): Promise<void> {
    if (!this.listoParaAnalizar) return;

    this.analizando = true;
    this.plan = null;
    try {
      const filas: FilaTitulo[] = [];
      const invalidas: FilaInvalida[] = [];
      for (const h of this.hojasIncluidas) {
        const extraido = extraerFilas(h.tabla, h.formato!);
        // El admin pudo corregir el estado detectado automáticamente.
        const estado = h.estadoEntrega ?? h.formato!.estadoEntrega;
        filas.push(...extraido.filas.map(f => f.estadoEntrega === estado ? f : { ...f, estadoEntrega: estado }));
        invalidas.push(...extraido.invalidas);
      }

      if (filas.length === 0) {
        this.message.warning('El archivo no tiene filas de títulos para cargar.');
        return;
      }

      const rucs = [...new Set(filas.map(f => f.ruc))];
      const [existentes, coactivados, notasHistoricasExistentes] = await Promise.all([
        this.titulosService.getExistentesParaRucs(rucs),
        this.titulosService.getCoactivadosParaRucs(rucs),
        this.migrarObservaciones ? this.titulosService.getNotasHistoricasExistentes(rucs) : Promise.resolve(new Set<string>())
      ]);

      this.plan = planificarCarga(filas, invalidas, existentes, coactivados, {
        carteras: this.carteras,
        carteraForzada: this.origenCartera === 'una' ? this.carteraSeleccionada : null,
        migrarObservaciones: this.migrarObservaciones,
        notasHistoricasExistentes
      });
    } catch (error) {
      console.error('Error analizando el archivo:', error);
      this.message.error('No se pudo analizar el archivo.');
    } finally {
      this.analizando = false;
    }
  }

  // ============================================
  // ✅ Paso 3: confirmar (ahí sí escribe en Firestore)
  // ============================================
  get puedeConfirmar(): boolean {
    if (!this.plan || this.plan.rucSinCartera.length > 0) return false;
    return this.plan.nuevos.length + this.plan.transiciones.length + this.plan.actualizaciones.length + this.plan.gestionesHistoricas.length > 0;
  }

  async confirmar(): Promise<void> {
    if (!this.plan || !this.archivo || !this.puedeConfirmar) return;

    this.confirmando = true;
    try {
      const cartera = this.origenCartera === 'una' ? this.carteraSeleccionada! : 'Varias (según el archivo)';
      await this.titulosService.confirmarCarga(this.plan, cartera, this.archivo.name);
      const gestiones = this.plan.gestionesHistoricas.length;
      const actualizaciones = this.plan.actualizaciones.length;
      this.message.success(
        `Carga aplicada: ${this.plan.nuevos.length} título(s) nuevo(s), ` +
        `${this.plan.coactivadosNuevos.length} coactivado(s) nuevo(s), ` +
        `${this.plan.transiciones.length} pasaron a entregado(s)` +
        `${actualizaciones ? `, ${actualizaciones} actualizado(s) de estado` : ''}` +
        `${gestiones ? `, ${gestiones} gestión(es) histórica(s) migrada(s)` : ''}.`
      );
      this.reiniciar();
      await this.cargarHistorial();
    } catch (error) {
      console.error('Error aplicando la carga:', error);
      this.message.error('No se pudo aplicar la carga. No se perdió nada: puedes volver a intentarlo.');
    } finally {
      this.confirmando = false;
    }
  }

  // Deshace solo las gestiones migradas de una carga (títulos y coactivados
  // quedan intactos) — para corregir un doble clic en "Confirmar" o una
  // migración hecha por error.
  async deshacerMigracion(carga: CargaTitulos): Promise<void> {
    if (!carga.id) return;
    this.deshaciendoCarga = carga.id;
    try {
      const n = await this.titulosService.eliminarGestionesMigradasDeCarga(carga.id);
      this.message.success(`Se deshicieron ${n} gestión(es) histórica(s) de esta carga.`);
    } catch (error) {
      console.error('Error deshaciendo la migración:', error);
      this.message.error('No se pudo deshacer la migración.');
    } finally {
      this.deshaciendoCarga = null;
    }
  }

  get capitalNuevos(): number {
    return this.plan ? this.plan.nuevos.reduce((s, f) => s + f.capital, 0) : 0;
  }

  trackByFila(index: number, f: FilaTitulo): string {
    return f.numero;
  }

  trackByItemPlan(index: number, item: ItemPlan): string {
    return item.fila.numero;
  }

  trackByInvalida(index: number, i: FilaInvalida): string {
    return i.fila + (i.numero ?? '');
  }

  trackByCarga(index: number, c: CargaTitulos): string | undefined {
    return c.id;
  }

  trackByGestionHistorica(index: number, g: GestionHistorica): string {
    return g.ruc + '|' + g.descripcion;
  }

  // ============================================
  // 🗑️ Zona de peligro: vaciar una cartera completa
  // ============================================
  onCarteraAVaciarChange(): void {
    this.resumenVaciado = null;
  }

  async calcularVaciado(): Promise<void> {
    if (!this.carteraAVaciar) return;
    this.calculandoVaciado = true;
    this.resumenVaciado = null;
    try {
      this.resumenVaciado = await this.coactivadosService.contarCartera(this.carteraAVaciar);
    } catch (error) {
      console.error('Error calculando el vaciado:', error);
      this.message.error('No se pudo calcular cuánto hay para borrar.');
    } finally {
      this.calculandoVaciado = false;
    }
  }

  async vaciarCartera(): Promise<void> {
    if (!this.carteraAVaciar) return;
    this.vaciando = true;
    try {
      const r = await this.coactivadosService.eliminarCartera(this.carteraAVaciar);
      this.message.success(
        `Se borraron ${r.coactivados} coactivado(s), ${r.titulos} título(s) y ${r.gestiones} gestión(es) de ${this.carteraAVaciar}.`
      );
      this.resumenVaciado = null;
      this.carteraAVaciar = null;
    } catch (error) {
      console.error('Error vaciando la cartera:', error);
      this.message.error('No se pudo vaciar la cartera. Puedes reintentarlo.');
    } finally {
      this.vaciando = false;
    }
  }
}
