import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Proceso, Etapa } from '../../../../services/procesos/procesos.service'; // Ajusta la ruta a tu servicio
import { CommonModule } from '@angular/common';

// Imports de NG-Zorro
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzGridModule } from 'ng-zorro-antd/grid';

@Component({
  selector: 'app-detalle-proceso',
  standalone: true,
  imports: [
    CommonModule,
    NzCardModule,
    NzIconModule,
    NzTimelineModule,
    NzCollapseModule,
    NzListModule,
    NzButtonModule,
    NzDividerModule,
    NzGridModule
  ],
  templateUrl: './detalle-proceso.component.html',
  styleUrl: './detalle-proceso.component.css'
})
export class DetalleProcesoComponent implements OnChanges {
  @Input() proceso: Proceso | null = null;
  etapasOrdenadas: Etapa[] = [];

  // Usamos OnChanges para reaccionar cuando el input 'proceso' cambia.
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['proceso'] && this.proceso) {
      this.ordenarEtapas();
    }
  }

  private ordenarEtapas(): void {
    if (this.proceso && this.proceso.etapas) {
      // Creamos una copia y la ordenamos de forma descendente (la más reciente primero)
      this.etapasOrdenadas = [...this.proceso.etapas].sort((a, b) => {
        const fechaA = new Date(a.fechaRegistro).getTime();
        const fechaB = new Date(b.fechaRegistro).getTime();
        return fechaB - fechaA;
      });
    }
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return 'Fecha no disponible';
    const fechaObj = new Date(fecha);
    if (isNaN(fechaObj.getTime())) return 'Fecha inválida';
    return fechaObj.toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatearFechaEtapa(fecha: any): string {
    if (!fecha) return '';
    const fechaObj = new Date(fecha);
    if (isNaN(fechaObj.getTime())) return '';
    const opciones: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return new Intl.DateTimeFormat('es-EC', opciones).format(fechaObj);
  }
}
