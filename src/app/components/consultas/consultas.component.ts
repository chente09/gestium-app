import { Component } from '@angular/core';
import { ProcesosService, Proceso } from '../../services/procesos/procesos.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { CommonModule } from '@angular/common';

// Componentes Hijos
import { BusquedaFormComponent } from './componentes/busqueda-form/busqueda-form.component';
import { ResultadosTablaComponent } from './componentes/resultados-tabla/resultados-tabla.component';
import { DetalleProcesoComponent } from "./componentes/detalle-proceso/detalle-proceso.component";

// NG-Zorro Imports
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';

@Component({
  selector: 'app-consultas',
  standalone: true,
  imports: [
    CommonModule,
    BusquedaFormComponent,
    ResultadosTablaComponent,
    DetalleProcesoComponent,
    NzIconModule,
    NzSpinModule
  ],
  templateUrl: './consultas.component.html',
  styleUrls: ['./consultas.component.css']
})
export class ConsultasComponent {
  // Estados para controlar la vista
  isLoading = false;
  showResults = false;
  showDetail = false;

  procesos: Proceso[] = [];
  procesoSeleccionado: Proceso | null = null;

  constructor(
    private procesosService: ProcesosService,
    private messageService: NzMessageService
  ) {}

  async handleSearch(event: { tipo: string, valor: string }): Promise<void> {
    this.isLoading = true;
    const loadingId = this.messageService.loading('Buscando procesos...', { nzDuration: 0 }).messageId;

    try {
      // Búsqueda server-side (Cloud Function 'buscarProceso'): solo llegan
      // al navegador los procesos que realmente coinciden, nunca la
      // colección completa.
      this.procesos = await this.procesosService.buscarProcesoPublico(
        event.tipo as 'cedula' | 'nombre',
        event.valor
      );

      if (this.procesos.length > 0) {
        this.showResults = true;
        this.messageService.success(`Se encontraron ${this.procesos.length} procesos.`);
      } else {
        this.messageService.info('No se encontraron procesos con los criterios de búsqueda.');
      }
    } catch (error) {
      this.messageService.error('Ocurrió un error al buscar los procesos.');
      console.error(error);
    } finally {
      this.isLoading = false;
      this.messageService.remove(loadingId);
    }
  }

  handleSelectProceso(proceso: Proceso): void {
    this.procesoSeleccionado = proceso;
    this.showResults = false;
    this.showDetail = true;
  }

  handleNewSearch(): void {
    this.procesos = [];
    this.procesoSeleccionado = null;
    this.showResults = false;
    this.showDetail = false;
  }
}
