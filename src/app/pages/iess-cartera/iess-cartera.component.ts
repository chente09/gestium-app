import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';

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
import { NzRadioModule } from 'ng-zorro-antd/radio';

import {
  CoactivadosService,
  CoactivadoConEstado,
  CoactivadoPendienteDeRegistro,
  ResumenCartera,
  ResumenCancelados,
  normalizarBusqueda
} from '../../services/coactivados/coactivados.service';
import { formatoMoneda } from '../../services/titulosCredito/titulos-credito.util';
import { IessNavegacionService } from '../../services/iessNavegacion/iess-navegacion.service';
import { IessNavComponent } from '../../components/iess-nav/iess-nav.component';

export type FiltroCasos = 'todos' | 'sin-gestion' | 'sin-llamada' | 'con-llamada';
const FILTROS: FiltroCasos[] = ['todos', 'sin-gestion', 'sin-llamada', 'con-llamada'];

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
    NzBreadCrumbModule,
    NzRadioModule,
    IessNavComponent
  ],
  templateUrl: './iess-cartera.component.html',
  styleUrl: './iess-cartera.component.css'
})
export class IessCarteraComponent implements OnInit, OnDestroy {
  cartera = '';
  resumen: ResumenCartera | null = null;
  resumenCancelados: ResumenCancelados | null = null;
  cargando = false;
  filtro = '';
  filtroCasos: FiltroCasos = 'todos';
  readonly formatoMoneda = formatoMoneda;
  private suscripcion?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coactivadosService: CoactivadosService,
    private navegacion: IessNavegacionService
  ) { }

  // La barra de navegación cambia de cartera con la misma pantalla abierta:
  // se atiende cada cambio de parámetros, no solo el primero. El parámetro
  // "filtro" deja la lista ya filtrada (por ejemplo, los casos sin gestión).
  ngOnInit(): void {
    this.suscripcion = combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([params, query]) => {
      const cartera = params.get('cartera') ?? '';
      const filtro = query.get('filtro') as FiltroCasos | null;
      this.filtroCasos = filtro && FILTROS.includes(filtro) ? filtro : 'todos';
      if (cartera !== this.cartera) {
        this.cartera = cartera;
        this.filtro = '';
        void this.cargar();
      }
    });
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
  }

  private async cargar(): Promise<void> {
    if (!this.cartera) return;
    const cartera = this.cartera;
    this.cargando = true;
    this.resumen = null;
    this.resumenCancelados = null;
    try {
      const [resumen, cancelados] = await Promise.all([
        this.coactivadosService.getResumenCartera(cartera),
        this.coactivadosService.getResumenCancelados(cartera)
      ]);
      // Si mientras cargaba se pasó a otra cartera, esta lectura ya no sirve.
      if (cartera !== this.cartera) return;
      this.resumen = resumen;
      this.resumenCancelados = cancelados;
      // Lo que se acaba de leer le sirve al panel "Sin gestión" de la ficha.
      this.navegacion.publicarSinGestion(cartera, resumen.pendientes);
    } catch (error) {
      console.error('Error cargando la cartera:', error);
    } finally {
      if (cartera === this.cartera) this.cargando = false;
    }
  }

  // Se refleja en la dirección: así se puede volver a esta lista tal cual estaba.
  cambiarFiltro(filtro: FiltroCasos): void {
    this.filtroCasos = filtro;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { filtro: filtro === 'todos' ? null : filtro },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  get filtrados(): CoactivadoConEstado[] {
    if (!this.resumen) return [];
    const t = normalizarBusqueda(this.filtro);
    return this.resumen.todos.filter(c => (!t || c.nombreBusqueda.includes(t)) && this.cumpleFiltro(c));
  }

  private cumpleFiltro(c: CoactivadoConEstado): boolean {
    switch (this.filtroCasos) {
      case 'sin-gestion': return !c.tieneGestion;
      case 'sin-llamada': return !c.tieneLlamada;
      case 'con-llamada': return c.tieneLlamada;
      default: return true;
    }
  }

  // La ficha se abre con el panel de navegación en la lista que se estaba
  // recorriendo, para seguir con el siguiente caso sin volver acá.
  abrirFicha(c: { cedula: string }): void {
    const modo = this.filtroCasos === 'sin-gestion' ? 'sin-gestion' : 'cartera';
    void this.router.navigate(['/iess/bitacora'], { queryParams: { cedula: c.cedula, modo } });
  }

  trackByCedula(index: number, c: { cedula: string }): string {
    return c.cedula;
  }
}
