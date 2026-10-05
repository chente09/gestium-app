import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTagModule } from 'ng-zorro-antd/tag';

import { SharedDataService } from '../../services/sharedData/shared-data.service';
import { TitulosCreditoService, CargaPagos } from '../../services/titulosCredito/titulos-credito.service';
import { formatoMoneda, fechaCorta } from '../../services/titulosCredito/titulos-credito.util';
import { FilaPago, PlanPagos, extraerFilasPago, planificarPagos } from '../../services/titulosCredito/pagos-titulos.util';
import { FilaInvalida } from '../../services/titulosCredito/importador-titulos.util';
import { leerArchivoTablas } from '../iess-titulos/lector-archivo.util';
import { descargarPlantillaPagos } from './plantilla-pagos.export';

@Component({
  selector: 'app-iess-pagos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzCardModule,
    NzButtonModule,
    NzIconModule,
    NzTableModule,
    NzStatisticModule,
    NzAlertModule,
    NzEmptyModule,
    NzCollapseModule,
    NzBreadCrumbModule,
    NzRadioModule,
    NzTagModule
  ],
  templateUrl: './iess-pagos.component.html',
  styleUrl: './iess-pagos.component.css'
})
export class IessPagosComponent implements OnInit {
  readonly formatoMoneda = formatoMoneda;
  readonly fechaCorta = fechaCorta;

  archivo: File | null = null;
  leyendo = false;
  analizando = false;
  confirmando = false;
  descargandoPlantilla = false;
  plan: PlanPagos | null = null;
  honorarioYaCobrado = true;

  cargas: CargaPagos[] = [];
  cargandoHistorial = false;

  readonly carteras: string[];

  constructor(
    private titulosService: TitulosCreditoService,
    private sharedData: SharedDataService,
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
      this.cargas = await this.titulosService.getCargasPagos();
    } catch (error) {
      console.error('Error cargando el historial de pagos:', error);
    } finally {
      this.cargandoHistorial = false;
    }
  }

  private reiniciar(): void {
    this.archivo = null;
    this.plan = null;
    this.honorarioYaCobrado = true;
  }

  async onArchivoSeleccionado(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;

    this.reiniciar();
    this.archivo = archivo;
    this.leyendo = true;
    try {
      const tablas = await leerArchivoTablas(archivo);
      const filasTotales: FilaPago[] = [];
      const invalidasTotales: FilaInvalida[] = [];
      for (const tabla of tablas) {
        const { filas, invalidas } = extraerFilasPago(tabla);
        filasTotales.push(...filas);
        invalidasTotales.push(...invalidas);
      }

      if (filasTotales.length === 0 && invalidasTotales.length === 0) {
        this.message.warning('No se reconocieron columnas de pagos en este archivo (se esperan RUC, TC, Total y Honorario — o Capital + Interés en vez de Total).');
        this.archivo = null;
        return;
      }

      this.analizando = true;
      const numeros = [...new Set(filasTotales.map(f => f.numero))];
      const existentes = await this.titulosService.getTitulosPorNumeros(numeros);
      this.plan = planificarPagos(filasTotales, invalidasTotales, existentes, this.carteras);
    } catch (error) {
      console.error('Error leyendo el archivo:', error);
      this.message.error('No se pudo leer el archivo. ¿Es un .xlsx o .csv válido?');
      this.archivo = null;
    } finally {
      this.leyendo = false;
      this.analizando = false;
    }
  }

  async descargarPlantilla(): Promise<void> {
    this.descargandoPlantilla = true;
    try {
      await descargarPlantillaPagos(this.carteras);
    } catch (error) {
      console.error('Error generando la plantilla:', error);
      this.message.error('No se pudo generar la plantilla.');
    } finally {
      this.descargandoPlantilla = false;
    }
  }

  get puedeConfirmar(): boolean {
    return !!this.plan && this.plan.validos.length > 0;
  }

  // Estado del honorario que trae el propio archivo ("Estado honorario").
  // La pregunta al admin solo hace falta para las filas que no lo traen.
  get validosConHonorarioPendiente(): number {
    return this.plan ? this.plan.validos.filter(f => f.honorarioCobrado === false).length : 0;
  }

  get validosConHonorarioCobrado(): number {
    return this.plan ? this.plan.validos.filter(f => f.honorarioCobrado === true).length : 0;
  }

  get validosSinEstadoHonorario(): number {
    return this.plan ? this.plan.validos.filter(f => f.honorarioCobrado === undefined).length : 0;
  }

  etiquetaHonorario(c: CargaPagos): { texto: string; color: string } {
    const cobrados = c.honorariosCobrados ?? (c.honorarioYaCobrado !== false ? c.aplicados : 0);
    if (cobrados === c.aplicados) return { texto: 'Cobrado', color: 'green' };
    if (cobrados === 0) return { texto: 'Pendiente', color: 'orange' };
    return { texto: `Mixto (${cobrados} cobrados)`, color: 'blue' };
  }

  async confirmar(): Promise<void> {
    if (!this.plan || !this.archivo || !this.puedeConfirmar) return;

    this.confirmando = true;
    try {
      const pendientes = this.validosConHonorarioPendiente + (this.honorarioYaCobrado ? 0 : this.validosSinEstadoHonorario);
      await this.titulosService.confirmarPagos(this.plan, this.archivo.name, this.honorarioYaCobrado);
      const detalleHonorario = pendientes === 0
        ? 'con honorario cobrado'
        : pendientes === this.plan.validos.length
          ? 'con honorario aún pendiente de cobrar'
          : `${pendientes} con honorario aún pendiente de cobrar`;
      this.message.success(`Se aplicaron ${this.plan.validos.length} pago(s) — título marcado como cancelado, ${detalleHonorario}.`);
      this.reiniciar();
      await this.cargarHistorial();
    } catch (error) {
      console.error('Error aplicando los pagos:', error);
      this.message.error('No se pudieron aplicar los pagos. No se perdió nada: puedes volver a intentarlo.');
    } finally {
      this.confirmando = false;
    }
  }

  get totalHonorariosValidos(): number {
    return this.plan ? this.plan.validos.reduce((s, f) => s + f.honorario, 0) : 0;
  }

  get totalMontoValidos(): number {
    return this.plan ? this.plan.validos.reduce((s, f) => s + f.montoCancelado, 0) : 0;
  }

  trackByFila(index: number, f: FilaPago): string {
    return f.numero;
  }

  trackByInvalida(index: number, i: FilaInvalida): string {
    return i.fila + (i.numero ?? '');
  }

  trackByCarga(index: number, c: CargaPagos): string | undefined {
    return c.id;
  }
}
