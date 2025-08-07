import { Component } from '@angular/core';
import { ProcesosService, Proceso } from '../../services/procesos/procesos.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { CommonModule } from '@angular/common';
import { finalize, first } from 'rxjs/operators'; // Importa el operador 'first'

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

  handleSearch(event: { tipo: string, valor: string }): void {
    this.isLoading = true;
    const loadingId = this.messageService.loading('Buscando procesos...', { nzDuration: 0 }).messageId;

    this.procesosService.getProcesos().pipe(
      first(), // <-- ESTA ES LA CORRECCIÓN: Toma la primera emisión y completa el observable.
      finalize(() => {
        this.isLoading = false;
        this.messageService.remove(loadingId);
      })
    ).subscribe(allProcesos => {
      // Filtrado en el lado del cliente
      const valor = event.valor.toLowerCase();
      let resultados: Proceso[] = [];

      if (event.tipo === 'cedula') {
        resultados = allProcesos.filter(p => p.cedula.toLowerCase() === valor);
      } else {
        resultados = allProcesos.filter(p => p.nombre.toLowerCase().includes(valor));
      }

      // Convertir fechas
      this.procesos = resultados.map(proceso => {
        if (proceso.fechaCreacion && typeof (proceso.fechaCreacion as any).toDate === 'function') {
          proceso.fechaCreacion = (proceso.fechaCreacion as any).toDate();
        }
        if (proceso.etapas) {
          proceso.etapas.forEach(etapa => {
            if (etapa.fechaRegistro && typeof (etapa.fechaRegistro as any).toDate === 'function') {
              etapa.fechaRegistro = (etapa.fechaRegistro as any).toDate();
            }
          });
        }
        return proceso;
      });

      if (this.procesos.length > 0) {
        this.showResults = true;
        this.messageService.success(`Se encontraron ${this.procesos.length} procesos.`);
      } else {
        this.messageService.info('No se encontraron procesos con los criterios de búsqueda.');
      }
    }, error => {
      this.messageService.error('Ocurrió un error al buscar los procesos.');
      console.error(error);
    });
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
