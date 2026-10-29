import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzMessageService } from 'ng-zorro-antd/message';

import { CoactivadosService } from '../../services/coactivados/coactivados.service';
import { SharedDataService } from '../../services/sharedData/shared-data.service';
import { IessNavegacionService } from '../../services/iessNavegacion/iess-navegacion.service';
import { IessNavComponent } from '../../components/iess-nav/iess-nav.component';
import { ConvenioPago, TcConvenio, diasSinPagar } from '../../services/titulosCredito/convenios-pago.util';
import { formatoMoneda } from '../../services/titulosCredito/titulos-credito.util';
import { exportarConvenios } from './convenios-pago.export';

const TODOS = '__todos__';

@Component({
  selector: 'app-iess-convenios',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzCardModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    NzEmptyModule,
    NzStatisticModule,
    NzToolTipModule,
    NzBreadCrumbModule,
    IessNavComponent
  ],
  templateUrl: './iess-convenios.component.html',
  styleUrl: './iess-convenios.component.css'
})
export class IessConveniosComponent implements OnInit {
  readonly TODOS = TODOS;
  readonly carteras: string[];
  readonly formatoMoneda = formatoMoneda;

  abogado: string | null = null;
  filtro = '';
  cargando = false;
  cargado = false;
  abogadoCargado: string | null = null;
  convenios: ConvenioPago[] = [];
  filtrados: ConvenioPago[] = [];
  expandidos = new Set<string>();
  exportando = false;
  private suscripcion?: Subscription;

  // Resumen de lo que se ve (según el filtro de texto)
  totalTcCancelados = 0;
  totalTcPendientes = 0;
  totalCapitalPendiente = 0;

  constructor(
    private coactivadosService: CoactivadosService,
    private route: ActivatedRoute,
    private navegacion: IessNavegacionService,
    sharedData: SharedDataService,
    private message: NzMessageService
  ) {
    this.carteras = sharedData.getCarterasIess();
  }

  // Desde la tarjeta de un abogado, la página de su cartera o la barra de
  // navegación se llega con el abogado ya elegido y se carga directo. La
  // pantalla puede seguir abierta cuando cambia el abogado de la dirección.
  ngOnInit(): void {
    this.suscripcion = this.route.queryParamMap.subscribe(params => {
      const abogado = params.get('abogado');
      if (abogado && this.carteras.includes(abogado) && abogado !== this.abogadoCargado) {
        this.abogado = abogado;
        void this.cargar();
      }
    });
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
  }

  // Bajo demanda y por abogado: leer todos los títulos de la base en cada
  // visita sería mucho más caro que leer solo los de quien se quiere revisar.
  async cargar(): Promise<void> {
    if (!this.abogado || this.cargando) return;
    this.cargando = true;
    try {
      this.convenios = await this.coactivadosService.getConveniosDePago(this.abogado === TODOS ? undefined : this.abogado);
      this.abogadoCargado = this.abogado;
      this.cargado = true;
      // Lo leído le sirve al panel "Convenios" de la ficha, sin volver a leerlo.
      if (this.abogado !== TODOS) this.navegacion.publicarConvenios(this.abogado, this.convenios);
      this.expandidos.clear();
      this.filtrar();
    } catch (error) {
      console.error('Error cargando convenios de pago:', error);
      this.message.error('No se pudieron cargar los convenios de pago.');
    } finally {
      this.cargando = false;
    }
  }

  filtrar(): void {
    const t = this.filtro.trim().toLowerCase();
    this.filtrados = !t
      ? this.convenios
      : this.convenios.filter(c => c.nombre.toLowerCase().includes(t) || c.cedula.includes(t));

    this.totalTcCancelados = this.filtrados.reduce((n, c) => n + c.cancelados, 0);
    this.totalTcPendientes = this.filtrados.reduce((n, c) => n + c.pendientes, 0);
    this.totalCapitalPendiente = Math.round(this.filtrados.reduce((n, c) => n + c.capitalPendiente, 0) * 100) / 100;
  }

  clave(c: ConvenioPago): string {
    return `${c.cartera}|${c.cedula}`;
  }

  alternar(clave: string, abierto: boolean): void {
    if (abierto) this.expandidos.add(clave);
    else this.expandidos.delete(clave);
  }

  diasSinPagar(c: ConvenioPago): number | null {
    return diasSinPagar(c);
  }

  // Para ordenar las columnas: sin fecha de pago va al final.
  readonly ordenarPorDias = (a: ConvenioPago, b: ConvenioPago): number =>
    (diasSinPagar(a) ?? -1) - (diasSinPagar(b) ?? -1);
  readonly ordenarPorPendientes = (a: ConvenioPago, b: ConvenioPago): number => a.pendientes - b.pendientes;
  readonly ordenarPorCapital = (a: ConvenioPago, b: ConvenioPago): number => a.capitalPendiente - b.capitalPendiente;

  etiquetaTc(t: TcConvenio): { texto: string; color: string } {
    if (t.estado === 'convenio') return { texto: 'En convenio', color: 'cyan' };
    if (t.estado === 'cancelado') return { texto: 'Cancelado', color: 'red' };
    return t.conAbono ? { texto: 'Con abono', color: 'blue' } : { texto: 'Pendiente', color: 'gold' };
  }

  async exportar(): Promise<void> {
    if (this.filtrados.length === 0 || this.exportando) return;
    this.exportando = true;
    try {
      await exportarConvenios(this.filtrados, this.abogadoCargado && this.abogadoCargado !== TODOS ? this.abogadoCargado : undefined);
    } catch (error) {
      console.error('Error exportando convenios de pago:', error);
      this.message.error('No se pudo generar el Excel.');
    } finally {
      this.exportando = false;
    }
  }

  trackByConvenio(_: number, c: ConvenioPago): string {
    return `${c.cartera}|${c.cedula}`;
  }
}
