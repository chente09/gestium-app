import { Component, OnInit } from '@angular/core';
import { ItinerarioService, Itinerario } from '../../services/itinerario/itinerario.service';// Asegúrate de que la ruta sea correcta
import { CommonModule } from '@angular/common';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { RouterModule } from '@angular/router';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ChangeDetectorRef } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';

enum Estado {
  COMPLETADO = 'completado',
  INCOMPLETO = 'incompleto',
  PENDIENTE = 'pendiente'
}

@Component({
  selector: 'app-history-itinerario',
  standalone: true,
  imports: [
    CommonModule,
    NzTagModule,
    NzTableModule,
    FormsModule,
    NzPopconfirmModule,
    NzButtonModule,
    NzIconModule,
    RouterModule,
    NzDatePickerModule,
    ReactiveFormsModule,
    NzSelectModule,
    NzModalModule,
    NzListModule,
    NzBreadCrumbModule
  ],
  templateUrl: './history-itinerario.component.html',
  styleUrl: './history-itinerario.component.css'
})
export class HistoryItinerarioComponent implements OnInit {

  itinerarios: Itinerario[] = [];
  editCache: { [key: string]: { edit: boolean; data: any } } = {};
  filteredItinerarios: Itinerario[] = [];
  setOfCheckedId = new Set<string>(); // IDs seleccionados
  selectedArea = new FormControl('');
  selectedDate = new FormControl<[Date | null, Date | null]>([null, null]);
  areas: string[] = ['ISSFA', 'Bco. Pichincha', 'Bco. Produbanco', 'BNF', 'Inmobiliaria', 'David', 'Otro'];
  selectedEstado = new FormControl(null);
  estados: string[] = ['Completado', 'Incompleto', 'Pendiente']; // Agrega los estados que manejes
  listOfCurrentPageData: Itinerario[] = [];
  checked = false;
  indeterminate = false;
  Estado = Estado;
  isHistorialVisible = false; // Controla la visibilidad del modal
  historialActual: any[] = []; // Almacena el historial actual

  constructor(
    private itinerarioService: ItinerarioService,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef
  ) { }

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.itinerarioService.getItinerarios().subscribe((data) => {
      this.itinerarios = data;
      this.updateEditCache(this.itinerarios);
      this.filterItinerarios();  // Filtrar al cargar los datos
    });

    this.initEditCache();

    this.selectedArea.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
  this.selectedDate.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
  this.selectedEstado.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  filterItinerarios(): void {
    const selectedAreaValue = this.selectedArea.value;
    const selectedEstadoValue = this.selectedEstado.value;
    const [fechaInicio, fechaFin] = this.selectedDate.value || [null, null];

    this.filteredItinerarios = this.itinerarios.filter(item => {
      const estadoStr = String(item.estado).toLowerCase();
      const isEstadoMatch = selectedEstadoValue ? estadoStr === String(selectedEstadoValue).toLowerCase() : true;
      const isAreaMatch = selectedAreaValue ? item.area === selectedAreaValue : true;

      const fechaSolicitud = new Date(item.fechaSolicitud);
      const isDateInRange =
        (!fechaInicio || fechaSolicitud >= new Date(fechaInicio)) &&
        (!fechaFin || fechaSolicitud <= new Date(fechaFin));

      return isEstadoMatch && isAreaMatch && isDateInRange;
    });

    this.cdr.detectChanges();
  }

  showAllAreas(): void {
    this.selectedArea.setValue('');
    this.selectedDate.setValue([null, null]);
    this.selectedEstado.setValue(null);
    this.filterItinerarios();
  }
  getEstadoColor(estado: Estado): string {
    switch (estado) {
      case Estado.COMPLETADO:
        return 'green'; // Completado
      case Estado.INCOMPLETO:
        return 'orange'; // Incompleto
      case Estado.PENDIENTE:
        return 'red'; // Pendiente
      default:
        return 'gray'; // En caso de que el estado no sea válido
    }
  }

  getEstadoTexto(estado: Estado): string {
    switch (estado) {
      case Estado.COMPLETADO:
        return 'Completado';
      case Estado.INCOMPLETO:
        return 'Incompleto';
      case Estado.PENDIENTE:
        return 'Pendiente';
      default:
        return 'Estado desconocido'; // En caso de que el estado no sea válido
    }
  }

  private initEditCache(): void {
    this.itinerarios.forEach(item => {
      if (!this.editCache[item.id]) {
        this.editCache[item.id] = { edit: false, data: { ...item } };
      }
    });
  }
  trackById(index: number, item: any): string | number {
    return item.id ?? index;  // Evita que Angular reciba `undefined`
  }
  startEdit(id: string): void {
    if (this.editCache[id]) {
      this.editCache[id].edit = true;
    }
  }
  cancelEdit(id: string): void {
    const index = this.itinerarios.findIndex(item => item.id === id);
    if (index !== -1) {
      this.editCache[id] = {
        data: { ...this.itinerarios[index] },
        edit: false
      };
    }
  }
  async saveEdit(id: string): Promise<void> {
    if (!this.editCache[id]) return;
  
    const updatedItinerario = this.editCache[id].data;
    const index = this.itinerarios.findIndex(item => item.id === id);
    if (index === -1) return;
  
    if (JSON.stringify(this.itinerarios[index]) === JSON.stringify(updatedItinerario)) {
      this.message.info('No se han realizado cambios.');
      this.editCache[id].edit = false;
      return;
    }
  
    try {
      await this.itinerarioService.updateItinerario(id, updatedItinerario);
      this.itinerarios[index] = { ...updatedItinerario };
      this.editCache[id].edit = false;
      this.message.success('Itinerario actualizado correctamente.');
    } catch (error) {
      this.message.error('Error al actualizar el itinerario. Intente nuevamente.');
      console.error('Error al actualizar el itinerario', error);
    }
  }
  
  updateEditCache(itinerarios: Itinerario[]): void {
    itinerarios.forEach(item => {
      if (!this.editCache[item.id]) { // Solo agregar si no existe
        this.editCache[item.id] = {
          edit: false,
          data: { ...item }
        };
      }
    });
  }
  eliminar(id: string): void {
    this.itinerarioService.deleteItinerario(id).then(() => {
      this.message.success('Itinerario eliminado correctamente.');
      this.itinerarios = this.itinerarios.filter(it => it.id !== id);
      this.filterItinerarios(); // Asegurar que la vista refleje la eliminación
    }).catch(error => {
      this.message.error('Error al eliminar el itinerario.');
      console.error(error);
    });
  }


  verHistorial(item: any): void {
    this.historialActual = item.historial || []; // Asigna el historial del item
    this.isHistorialVisible = true; // Abre el modal
  }

  cerrarHistorial(): void {
    this.isHistorialVisible = false; // Cierra el modal
    this.historialActual = []; // Limpia el historial
  }

}
