import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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

import { TitulosCreditoService, CargaPagos } from '../../services/titulosCredito/titulos-credito.service';
import { formatoMoneda, fechaCorta } from '../../services/titulosCredito/titulos-credito.util';
import { FilaPago, PlanPagos, extraerFilasPago, planificarPagos } from '../../services/titulosCredito/pagos-titulos.util';
import { FilaInvalida } from '../../services/titulosCredito/importador-titulos.util';
import { leerArchivoTablas } from '../iess-titulos/lector-archivo.util';

@Component({
  selector: 'app-iess-pagos',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NzCardModule,
    NzButtonModule,
    NzIconModule,
    NzTableModule,
    NzStatisticModule,
    NzAlertModule,
    NzEmptyModule,
    NzCollapseModule,
    NzBreadCrumbModule
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
  plan: PlanPagos | null = null;

  cargas: CargaPagos[] = [];
  cargandoHistorial = false;

  constructor(
    private titulosService: TitulosCreditoService,
    private message: NzMessageService
  ) { }

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
        this.message.warning('No se reconocieron columnas de pagos en este archivo (se esperan RUC, Título de crédito, Honorarios, Total cancelado).');
        this.archivo = null;
        return;
      }

      this.analizando = true;
      const numeros = [...new Set(filasTotales.map(f => f.numero))];
      const existentes = await this.titulosService.getTitulosPorNumeros(numeros);
      this.plan = planificarPagos(filasTotales, invalidasTotales, existentes);
    } catch (error) {
      console.error('Error leyendo el archivo:', error);
      this.message.error('No se pudo leer el archivo. ¿Es un .xlsx o .csv válido?');
      this.archivo = null;
    } finally {
      this.leyendo = false;
      this.analizando = false;
    }
  }

  get puedeConfirmar(): boolean {
    return !!this.plan && this.plan.validos.length > 0;
  }

  async confirmar(): Promise<void> {
    if (!this.plan || !this.archivo || !this.puedeConfirmar) return;

    this.confirmando = true;
    try {
      await this.titulosService.confirmarPagos(this.plan, this.archivo.name);
      this.message.success(`Se aplicaron ${this.plan.validos.length} pago(s) — título marcado como cancelado con honorario cobrado.`);
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
