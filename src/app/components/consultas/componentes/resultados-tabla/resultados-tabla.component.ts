import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Proceso } from '../../../../services/procesos/procesos.service'; // Ajusta la ruta
import { CommonModule } from '@angular/common';

// NG-Zorro Imports
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-resultados-tabla',
  standalone: true,
  imports: [
    CommonModule,
    NzTableModule,
    NzButtonModule,
    NzIconModule
  ],
  templateUrl: './resultados-tabla.component.html',
  styleUrls: ['./resultados-tabla.component.css']
})
export class ResultadosTablaComponent {
  @Input() procesos: Proceso[] = [];
  @Output() onSelectProceso = new EventEmitter<Proceso>();
  @Output() onNewSearch = new EventEmitter<void>();

  selectProceso(proceso: Proceso): void {
    this.onSelectProceso.emit(proceso);
  }

  newSearch(): void {
    this.onNewSearch.emit();
  }

  formatDate(fecha: any): string {
    if (!fecha) return 'N/A';
    const fechaObj = new Date(fecha);
    if (isNaN(fechaObj.getTime())) return 'Fecha inválida';
    return fechaObj.toLocaleDateString('es-EC');
  }
}
