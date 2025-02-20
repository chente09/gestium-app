import { Component, OnInit } from '@angular/core';
import { ItinerarioService, Itinerario } from '../../services/itinerario/itinerario.service';// Asegúrate de que la ruta sea correcta
import { CommonModule } from '@angular/common';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import {NzPopconfirmModule} from 'ng-zorro-antd/popconfirm';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { RouterModule } from '@angular/router';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ChangeDetectorRef } from '@angular/core';


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
  
  listOfCurrentPageData: Itinerario[] = [];
  checked = false;
  indeterminate = false;

  constructor(
    private itinerarioService: ItinerarioService,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.itinerarioService.getItinerarios().subscribe((data) => {
      this.itinerarios = data;
      this.updateEditCache(this.itinerarios);
      this.filterItinerarios();  // Filtrar al cargar los datos
    });
  
    this.initEditCache();
  
    this.selectedArea.valueChanges.subscribe(value => {
      console.log('Cambio en área:', value);
      this.filterItinerarios();
    });
  
    this.selectedDate.valueChanges.subscribe(value => {
      console.log('Cambio en fecha:', value);
      this.filterItinerarios();
    });
  }
  

  filterItinerarios(): void {
    const selectedAreaValue = this.selectedArea.value;
    const [fechaInicio, fechaFin] = this.selectedDate.value || [null, null];
  
    console.log('Aplicando filtros...');
    console.log('Área seleccionada:', selectedAreaValue);
    console.log('Fecha seleccionada:', fechaInicio, fechaFin);
  
    this.filteredItinerarios = this.itinerarios.filter(item => {
      const estadoStr = String(item.estado).toLowerCase();
      const isPendingOrIncomplete = estadoStr === 'false' || estadoStr === 'incompleto';
      const isAreaMatch = selectedAreaValue ? item.area === selectedAreaValue : true;
  
      const fechaSolicitud = new Date(item.fechaSolicitud);
      const isDateInRange =
        (!fechaInicio || fechaSolicitud >= new Date(fechaInicio)) &&
        (!fechaFin || fechaSolicitud <= new Date(fechaFin));
  
      return isPendingOrIncomplete && isAreaMatch && isDateInRange;
    });
  
    console.log('Itinerarios filtrados:', this.filteredItinerarios);
    this.cdr.detectChanges();
  }
  

  showAllAreas(): void {
    this.selectedArea.setValue('');
    this.filterItinerarios();
  }
  getEstadoColor(estado: any): string {
    if (estado === true || estado === 'true') {
      return 'green'; // Completado
    } else if (estado === 'incompleto') {
      return 'orange'; // Incompleto
    } else {
      return 'red'; // Pendiente
    }
  }
  
  getEstadoTexto(estado: any): string {
    if (estado === true || estado === 'true') {
      return 'Completado';
    } else if (estado === 'incompleto') {
      return 'Incompleto';
    } else {
      return 'Pendiente';
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

    // Evitar actualizaciones innecesarias
    if (JSON.stringify(this.itinerarios[index]) === JSON.stringify(updatedItinerario)) {
      console.log('No hay cambios en el itinerario.');
      this.editCache[id].edit = false;
      return;
    }

    try {
      await this.itinerarioService.updateItinerario(id, updatedItinerario);
      console.log('Itinerario actualizado');

      // Actualizar la lista original
      this.itinerarios[index] = { ...updatedItinerario };
      this.editCache[id].edit = false;
    } catch (error) {
      console.error('Error al actualizar el itinerario', error);
    }
  }
  updateEditCache(itinerarios: Itinerario[]): void {
    itinerarios.forEach(item => {
      if (item.id) {
        this.editCache[item.id] = {
          edit: false,
          data: { ...item }
        };
      }
    });
  }
  eliminar(id: string): void {
    this.itinerarioService.deleteItinerario(id).then(() => {
      this.itinerarios = this.itinerarios.filter(it => it.id !== id);
      this.message.success('Itinerario eliminado correctamente.');
    }).catch(error => {
      this.message.error('Error al eliminar el itinerario.');
      console.error(error);
    });
  }


}
