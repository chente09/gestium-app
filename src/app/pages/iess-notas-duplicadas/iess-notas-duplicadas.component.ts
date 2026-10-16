import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzMessageService } from 'ng-zorro-antd/message';

import { GestionesCoactivadoService } from '../../services/gestionesCoactivado/gestiones-coactivado.service';
import { GrupoNotasDuplicadas, agruparNotasDuplicadas } from '../../services/gestionesCoactivado/notas-duplicadas.util';
import { exportarRespaldoNotas } from './notas-duplicadas.export';

@Component({
  selector: 'app-iess-notas-duplicadas',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NzCardModule,
    NzButtonModule,
    NzIconModule,
    NzTableModule,
    NzTagModule,
    NzEmptyModule,
    NzAlertModule,
    NzStatisticModule,
    NzPopconfirmModule,
    NzBreadCrumbModule
  ],
  templateUrl: './iess-notas-duplicadas.component.html',
  styleUrl: './iess-notas-duplicadas.component.css'
})
export class IessNotasDuplicadasComponent {
  escaneando = false;
  escaneado = false;
  revisadas = 0;
  grupos: GrupoNotasDuplicadas[] = [];
  expandidos = new Set<string>();

  eliminando = false;
  eliminandoId: string | null = null;

  constructor(
    private gestionesService: GestionesCoactivadoService,
    private message: NzMessageService
  ) { }

  get totalSobrantes(): number {
    return this.grupos.reduce((total, g) => total + g.sobrantes.length, 0);
  }

  async escanear(): Promise<void> {
    if (this.escaneando) return;
    this.escaneando = true;
    try {
      const migradas = await this.gestionesService.getGestionesMigradas();
      this.revisadas = migradas.length;
      this.grupos = agruparNotasDuplicadas(migradas);
      this.expandidos.clear();
      this.escaneado = true;
    } catch (error) {
      console.error('Error buscando notas duplicadas:', error);
      this.message.error('No se pudieron revisar las gestiones.');
    } finally {
      this.escaneando = false;
    }
  }

  alternar(id: string, abierto: boolean): void {
    if (abierto) this.expandidos.add(id);
    else this.expandidos.delete(id);
  }

  async eliminarGrupo(grupo: GrupoNotasDuplicadas): Promise<void> {
    this.eliminandoId = grupo.coactivadoId + grupo.conservar.id;
    try {
      await this.eliminar([grupo]);
    } finally {
      this.eliminandoId = null;
    }
  }

  async eliminarTodos(): Promise<void> {
    this.eliminando = true;
    try {
      await this.eliminar(this.grupos);
    } finally {
      this.eliminando = false;
    }
  }

  // Primero baja el respaldo en Excel: si eso falla no se borra nada.
  private async eliminar(grupos: GrupoNotasDuplicadas[]): Promise<void> {
    if (grupos.length === 0) return;

    try {
      await exportarRespaldoNotas(grupos);
    } catch (error) {
      console.error('Error generando el respaldo de notas:', error);
      this.message.error('No se pudo generar el respaldo en Excel, así que no se eliminó nada.');
      return;
    }

    try {
      const sobrantes = grupos.flatMap(g => g.sobrantes);
      const borradas = await this.gestionesService.eliminarMigradas(sobrantes);
      const eliminadas = new Set(grupos);
      this.grupos = this.grupos.filter(g => !eliminadas.has(g));
      this.message.success(`Se eliminaron ${borradas} nota(s) repetida(s). El respaldo quedó en tu carpeta de descargas.`);
    } catch (error) {
      console.error('Error eliminando notas duplicadas:', error);
      this.message.error('No se pudieron eliminar las notas. Revisa y vuelve a intentar.');
    }
  }

  clave(g: GrupoNotasDuplicadas): string {
    return g.coactivadoId + (g.conservar.id ?? '');
  }

  trackByGrupo(_: number, g: GrupoNotasDuplicadas): string {
    return g.coactivadoId + (g.conservar.id ?? '');
  }
}
