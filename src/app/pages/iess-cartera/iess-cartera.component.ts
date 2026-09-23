import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';

import {
  CoactivadosService,
  CoactivadoConEstado,
  CoactivadoPendienteDeRegistro,
  ResumenCartera,
  ResumenCancelados,
  normalizarBusqueda
} from '../../services/coactivados/coactivados.service';
import { formatoMoneda } from '../../services/titulosCredito/titulos-credito.util';

@Component({
  selector: 'app-iess-cartera',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzCardModule,
    NzInputModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzIconModule,
    NzStatisticModule,
    NzAlertModule,
    NzEmptyModule,
    NzBreadCrumbModule
  ],
  templateUrl: './iess-cartera.component.html',
  styleUrl: './iess-cartera.component.css'
})
export class IessCarteraComponent implements OnInit {
  cartera = '';
  resumen: ResumenCartera | null = null;
  resumenCancelados: ResumenCancelados | null = null;
  cargando = false;
  filtro = '';
  readonly formatoMoneda = formatoMoneda;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coactivadosService: CoactivadosService
  ) { }

  ngOnInit(): void {
    this.cartera = this.route.snapshot.paramMap.get('cartera') ?? '';
    this.cargar();
  }

  private async cargar(): Promise<void> {
    if (!this.cartera) return;
    this.cargando = true;
    try {
      [this.resumen, this.resumenCancelados] = await Promise.all([
        this.coactivadosService.getResumenCartera(this.cartera),
        this.coactivadosService.getResumenCancelados(this.cartera)
      ]);
    } catch (error) {
      console.error('Error cargando la cartera:', error);
    } finally {
      this.cargando = false;
    }
  }

  get filtrados(): CoactivadoConEstado[] {
    if (!this.resumen) return [];
    const t = normalizarBusqueda(this.filtro);
    return t ? this.resumen.todos.filter(c => c.nombreBusqueda.includes(t)) : this.resumen.todos;
  }

  abrirFicha(c: { cedula: string }): void {
    this.router.navigate(['/iess/bitacora'], { queryParams: { cedula: c.cedula } });
  }

  trackByCedula(index: number, c: { cedula: string }): string {
    return c.cedula;
  }
}
