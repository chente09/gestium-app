import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';

import { ItinerarioService, Itinerario } from '../../services/itinerario/itinerario.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { RouterModule } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-itinerario',
  imports: [
    CommonModule,
    NzSelectModule,
    FormsModule,
    NzTableModule,
    ReactiveFormsModule,
    NzTagModule,
    NzButtonModule,
    NzDatePickerModule,
    RouterModule,
    NzIconModule
  ],
  templateUrl: './itinerario.component.html',
  styleUrl: './itinerario.component.css'
})
export class ItinerarioComponent implements OnInit {

  itinerarios: Itinerario[] = [];
  filteredItinerarios: Itinerario[] = [];
  setOfCheckedId = new Set<string>(); // IDs seleccionados
  loading = true;

  // Filtros
  selectedArea = new FormControl('');
  selectedDate = new FormControl<[Date | null, Date | null]>([null, null]);
  areas: string[] = ['ISSFA', 'Bco. Pichincha', 'Bco. Produbanco', 'BNF', 'Inmobiliaria', 'David', 'Otro'];

  listOfCurrentPageData: Itinerario[] = [];
  checked = false;
  indeterminate = false;

  constructor(
    private itinerarioService: ItinerarioService,
    private message: NzMessageService,
  ) { }
  ngOnInit(): void {
    this.itinerarioService.getItinerarios().subscribe(data => {
      this.itinerarios = data;
      this.filterItinerarios();
      this.loading = false;
    });
    // Detectar cambios en los filtros
    this.selectedArea.valueChanges.subscribe(() => this.filterItinerarios());
    this.selectedDate.valueChanges.subscribe(() => this.filterItinerarios());
  }

  filterItinerarios(): void {
    const selectedAreaValue = this.selectedArea.value;
    const [fechaInicio, fechaFin] = this.selectedDate.value || [null, null];
  
    this.filteredItinerarios = this.itinerarios.filter(item => {
      // Convertir `estado` a string para evitar problemas de tipo
      const estadoStr = String(item.estado).toLowerCase();
  
      // Verificar si está pendiente o incompleto
      const isPendingOrIncomplete = estadoStr === 'false' || estadoStr === 'incompleto';
  
      const isAreaMatch = selectedAreaValue ? item.area === selectedAreaValue : true;
  
      const fechaSolicitud = new Date(item.fechaSolicitud);
      const isDateInRange =
        (!fechaInicio || fechaSolicitud >= new Date(fechaInicio)) &&
        (!fechaFin || fechaSolicitud <= new Date(fechaFin));
  
      return isPendingOrIncomplete && isAreaMatch && isDateInRange;
    });
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

  showAllAreas(): void {
    this.selectedArea.setValue('');
    this.filterItinerarios();
  }

  eliminar(id: string): void {
    this.itinerarioService.deleteItinerario(id).then(() => {
      this.itinerarios = this.itinerarios.filter(it => it.id !== id);
      this.setOfCheckedId.delete(id);
      this.filterItinerarios();
      this.refreshCheckedStatus();
      this.message.success('Itinerario eliminado correctamente.');
    }).catch(error => {
      this.message.error('Error al eliminar el itinerario.');
      console.error(error);
    });
  }

  trackById(index: number, item: Itinerario): string | undefined {
    return item.id;
  }

  onCurrentPageDataChange(list: readonly Itinerario[]): void {
    this.listOfCurrentPageData = [...list];
    this.refreshCheckedStatus();
  }

  refreshCheckedStatus(): void {
    const listOfEnabledData = this.listOfCurrentPageData;
    this.checked = listOfEnabledData.every(({ id }) => id && this.setOfCheckedId.has(id));
    this.indeterminate = listOfEnabledData.some(({ id }) => id && this.setOfCheckedId.has(id)) && !this.checked;
  }

  onItemChecked(id: string, checked: boolean): void {
    if (checked) {
      this.setOfCheckedId.add(id);
    } else {
      this.setOfCheckedId.delete(id);
    }
    this.refreshCheckedStatus();
  }
  onAllChecked(checked: boolean): void {
    this.listOfCurrentPageData.forEach(({ id }) => {
      if (id) {
        if (checked) {
          this.setOfCheckedId.add(id);
        } else {
          this.setOfCheckedId.delete(id);
        }
      }
    });
    this.refreshCheckedStatus();
  }
}
