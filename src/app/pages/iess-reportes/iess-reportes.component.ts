import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';

import { RegistersService } from '../../services/registers/registers.service';
import {
  AREA_IESS,
  GestionCoactivado,
  GestionesCoactivadoService,
  TIPOS_GESTION,
  TIPOS_GESTION_SELECCIONABLES
} from '../../services/gestionesCoactivado/gestiones-coactivado.service';
import {
  IntegranteReporte,
  ReporteGestion,
  construirReporte,
  finDelDia,
  inicioDelDia
} from './reporte-gestion.util';
import {
  TipoReporte,
  etiquetaDia,
  exportarExcel as generarExcel,
  exportarPdf as generarPdf
} from './reporte-gestion.export';

type Periodo = 'hoy' | 'ayer' | 'semana' | 'mes' | 'personalizado';

// Tope de días de un rango libre: acota las lecturas de Firestore de una
// sola consulta (una gestión = una lectura).
const MAX_DIAS_RANGO = 92;

@Component({
  selector: 'app-iess-reportes',
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
    NzRadioModule,
    NzDatePickerModule,
    NzStatisticModule,
    NzEmptyModule,
    NzBreadCrumbModule
  ],
  templateUrl: './iess-reportes.component.html',
  styleUrl: './iess-reportes.component.css'
})
export class IessReportesComponent implements OnInit {
  // 'migrado' queda afuera: es historial cargado por el importador de
  // títulos, no actividad del día — mezclarlo desvirtuaría el conteo por
  // integrante que es justamente el propósito de este reporte.
  readonly tipos: TipoReporte[] = TIPOS_GESTION_SELECCIONABLES
    .map(clave => ({ clave, etiqueta: TIPOS_GESTION[clave] }));

  periodo: Periodo = 'hoy';
  rango: Date[] = [];

  cargando = false;
  exportando: 'pdf' | 'excel' | null = null;
  reporte: ReporteGestion | null = null;

  private gestiones: GestionCoactivado[] = [];
  private integrantesBase: IntegranteReporte[] = [];
  private ultimoPedido = 0;

  constructor(
    private gestionesService: GestionesCoactivadoService,
    private registersService: RegistersService,
    private message: NzMessageService
  ) { }

  async ngOnInit(): Promise<void> {
    await this.cargarIntegrantes();
    await this.cargar();
  }

  // El equipo activo del IESS: así el reporte también muestra a quien no
  // registró nada en el período.
  private async cargarIntegrantes(): Promise<void> {
    const usuarios = (await this.registersService.getUsersByArea(AREA_IESS)).filter(u => u.activo);
    this.integrantesBase = usuarios.map(u => ({ uid: u.uid, nombre: u.displayName || u.nickname || u.email }));
  }

  cambiarPeriodo(periodo: Periodo): void {
    this.periodo = periodo;
    if (periodo !== 'personalizado') this.cargar();
  }

  alCambiarRango(rango: Date[]): void {
    this.rango = rango;
    if (rango.length === 2) this.cargar();
  }

  readonly fechaFutura = (fecha: Date): boolean => fecha > new Date();

  private rangoDelPeriodo(): [Date, Date] | null {
    const hoy = new Date();

    switch (this.periodo) {
      case 'hoy':
        return [inicioDelDia(hoy), finDelDia(hoy)];
      case 'ayer': {
        const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
        return [inicioDelDia(ayer), finDelDia(ayer)];
      }
      case 'semana': {
        const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7));
        const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
        return [inicioDelDia(lunes), finDelDia(domingo)];
      }
      case 'mes':
        return [
          new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0),
          finDelDia(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0))
        ];
      default:
        return this.rango.length === 2 ? [inicioDelDia(this.rango[0]), finDelDia(this.rango[1])] : null;
    }
  }

  async cargar(): Promise<void> {
    const rango = this.rangoDelPeriodo();
    if (!rango) return;

    const [desde, hasta] = rango;
    const dias = Math.round((hasta.getTime() - desde.getTime()) / 86_400_000);
    if (dias > MAX_DIAS_RANGO) {
      this.message.warning(`El rango máximo es de ${MAX_DIAS_RANGO} días.`);
      return;
    }

    // Si se cambia de período mientras carga otro, gana el último pedido.
    const pedido = ++this.ultimoPedido;
    this.cargando = true;
    try {
      const gestiones = (await this.gestionesService.getGestionesPorRango(desde, hasta))
        .filter(g => g.tipo !== 'migrado');
      if (pedido !== this.ultimoPedido) return;

      this.gestiones = gestiones;
      this.reporte = construirReporte(gestiones, this.integrantesBase, this.tipos.map(t => t.clave), desde, hasta);
    } catch (error) {
      if (pedido !== this.ultimoPedido) return;
      console.error('Error cargando el reporte de gestión:', error);
      this.message.error('No se pudo cargar el reporte.');
    } finally {
      if (pedido === this.ultimoPedido) this.cargando = false;
    }
  }

  private get generadoPor(): string {
    const register = this.registersService.getCurrentRegister();
    return register?.displayName || register?.email || 'Usuario';
  }

  exportarPdf(): void {
    if (!this.reporte) return;

    this.exportando = 'pdf';
    try {
      generarPdf(this.reporte, this.tipos, this.generadoPor);
    } catch (error) {
      console.error('Error generando el PDF:', error);
      this.message.error('No se pudo generar el PDF.');
    } finally {
      this.exportando = null;
    }
  }

  async exportarExcel(): Promise<void> {
    if (!this.reporte) return;

    this.exportando = 'excel';
    try {
      await generarExcel(this.reporte, this.gestiones, this.tipos, this.generadoPor);
    } catch (error) {
      console.error('Error generando el Excel:', error);
      this.message.error('No se pudo generar el Excel.');
    } finally {
      this.exportando = null;
    }
  }

  etiquetaDia(clave: string): string {
    return etiquetaDia(clave);
  }

  get promedioPorDiaActivo(): number {
    const r = this.reporte;
    return r && r.diasConActividad ? Math.round((r.totalGestiones / r.diasConActividad) * 10) / 10 : 0;
  }

  trackByUid(index: number, i: IntegranteReporte): string {
    return i.uid;
  }
}
