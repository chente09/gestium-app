import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';

import { SharedDataService } from '../../services/sharedData/shared-data.service';
import { CoactivadosService, GrupoHonorarioPorCobrar, ResumenRecuperacion } from '../../services/coactivados/coactivados.service';
import { formatoMoneda } from '../../services/titulosCredito/titulos-credito.util';
import { exportarHonorariosPorCobrar } from './honorarios-por-cobrar.export';

@Component({
  selector: 'app-iess-recuperacion',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzCardModule,
    NzStatisticModule,
    NzTableModule,
    NzIconModule,
    NzBreadCrumbModule,
    NzButtonModule,
    NzSelectModule,
    NzInputModule,
    NzEmptyModule
  ],
  templateUrl: './iess-recuperacion.component.html',
  styleUrl: './iess-recuperacion.component.css'
})
export class IessRecuperacionComponent implements OnInit {
  readonly carteras: string[];
  resumenes: ResumenRecuperacion[] = [];
  cargando = false;
  readonly formatoMoneda = formatoMoneda;

  // Detalle de TC con honorario por cobrar (se consulta bajo demanda).
  carteraDetalle: string | null = null;
  grupos: GrupoHonorarioPorCobrar[] | null = null;
  cargandoDetalle = false;
  exportando = false;
  filtroDetalle = '';
  private expandidos = new Set<string>();

  constructor(
    private sharedData: SharedDataService,
    private coactivadosService: CoactivadosService,
    private message: NzMessageService
  ) {
    this.carteras = this.sharedData.getCarterasIess();
  }

  ngOnInit(): void {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando = true;
    try {
      this.resumenes = await Promise.all(this.carteras.map(c => this.coactivadosService.getResumenRecuperacion(c)));
    } catch (error) {
      console.error('Error cargando la estadística de recuperación:', error);
    } finally {
      this.cargando = false;
    }
  }

  get totalHonorarios(): number {
    return this.resumenes.reduce((s, r) => s + r.honorarios, 0);
  }

  get totalMontoCancelado(): number {
    return this.resumenes.reduce((s, r) => s + r.montoCancelado, 0);
  }

  get totalCancelados(): number {
    return this.resumenes.reduce((s, r) => s + r.titulosCancelados, 0);
  }

  get totalAbonos(): number {
    return this.resumenes.reduce((s, r) => s + r.titulosConAbono, 0);
  }

  get totalMontoAbonado(): number {
    return this.resumenes.reduce((s, r) => s + r.montoAbonado, 0);
  }

  get totalHonorariosCobrados(): number {
    return this.resumenes.reduce((s, r) => s + r.honorariosCobrados, 0);
  }

  get totalHonorariosPorCobrar(): number {
    return this.resumenes.reduce((s, r) => s + r.honorariosPorCobrar, 0);
  }

  async cargarDetalle(): Promise<void> {
    this.cargandoDetalle = true;
    try {
      this.grupos = await this.coactivadosService.getHonorariosPorCobrar(this.carteraDetalle ?? undefined);
      this.expandidos.clear();
      this.filtroDetalle = '';
    } catch (error) {
      console.error('Error cargando el detalle de honorarios por cobrar:', error);
      this.message.error('No se pudo cargar el detalle.');
    } finally {
      this.cargandoDetalle = false;
    }
  }

  async exportarDetalle(): Promise<void> {
    if (!this.grupos || this.grupos.length === 0) return;
    this.exportando = true;
    try {
      await exportarHonorariosPorCobrar(this.grupos, this.carteraDetalle ?? undefined);
    } catch (error) {
      console.error('Error exportando honorarios por cobrar:', error);
      this.message.error('No se pudo generar el Excel.');
    } finally {
      this.exportando = false;
    }
  }

  get gruposFiltrados(): GrupoHonorarioPorCobrar[] {
    const t = this.filtroDetalle.trim().toLowerCase();
    if (!t) return this.grupos ?? [];
    return (this.grupos ?? []).filter(g => g.nombre.toLowerCase().includes(t) || g.cedula.includes(t));
  }

  get totalTitulosDetalle(): number {
    return (this.grupos ?? []).reduce((s, g) => s + g.titulos.length, 0);
  }

  get totalHonorarioDetalle(): number {
    return Math.round((this.grupos ?? []).reduce((s, g) => s + g.totalHonorario, 0) * 100) / 100;
  }

  estaExpandido(cedula: string): boolean {
    return this.expandidos.has(cedula);
  }

  alternarExpandido(cedula: string, abierto: boolean): void {
    if (abierto) this.expandidos.add(cedula);
    else this.expandidos.delete(cedula);
  }

  trackByGrupo(index: number, g: GrupoHonorarioPorCobrar): string {
    return g.cedula;
  }

  trackByCartera(index: number, r: ResumenRecuperacion): string {
    return r.cartera;
  }
}
