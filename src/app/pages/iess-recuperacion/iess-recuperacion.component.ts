import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';

import { SharedDataService } from '../../services/sharedData/shared-data.service';
import { CoactivadosService, ResumenRecuperacion } from '../../services/coactivados/coactivados.service';
import { formatoMoneda } from '../../services/titulosCredito/titulos-credito.util';

@Component({
  selector: 'app-iess-recuperacion',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NzCardModule,
    NzStatisticModule,
    NzTableModule,
    NzIconModule,
    NzBreadCrumbModule
  ],
  templateUrl: './iess-recuperacion.component.html',
  styleUrl: './iess-recuperacion.component.css'
})
export class IessRecuperacionComponent implements OnInit {
  readonly carteras: string[];
  resumenes: ResumenRecuperacion[] = [];
  cargando = false;
  readonly formatoMoneda = formatoMoneda;

  constructor(
    private sharedData: SharedDataService,
    private coactivadosService: CoactivadosService
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

  trackByCartera(index: number, r: ResumenRecuperacion): string {
    return r.cartera;
  }
}
