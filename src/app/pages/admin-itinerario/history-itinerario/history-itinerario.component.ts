import { Component, OnInit } from '@angular/core';
import { ItinerarioService, Itinerario } from '../../../services/itinerario/itinerario.service';// Asegúrate de que la ruta sea correcta
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
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';

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
    NzBreadCrumbModule,
    NzEmptyModule,
    NzInputModule
  ],
  templateUrl: './history-itinerario.component.html',
  styleUrl: './history-itinerario.component.css'
})
export class HistoryItinerarioComponent implements OnInit {

  itinerarios: Itinerario[] = [];
  editCache: { [key: string]: { edit: boolean; data: any } } = {};
  filteredItinerarios: Itinerario[] = [];
  selectedArea = new FormControl('');
  selectedDate = new FormControl<[Date | null, Date | null]>([null, null]);
  selectedEstado = new FormControl(null);
  estados: string[] = ['Completado', 'Incompleto', 'Pendiente'];
  Estado = Estado;
  isHistorialVisible = false;
  historialActual: any[] = [];

  searchTerm: string = '';
  pageSize = 10;
  pageIndex = 1;

  // 🌟 Agregar los arreglos necesarios para los selects
  areas: string[] = ['ISSFA', 'Bco. Pichincha', 'Bco. Produbanco', 'BNF', 'Inmobiliaria', 'David', 'Otro'];
  unidad: string[] = ['Pague Ya', 'Municipio', 'Notaria', 'SUPERCIAS', 'AMT', 'ANT', 'SRI', 'ISSFA', 'Consejo Provincial', 'Registro Propiedad', 'Registro Mercantil', 'Quitumbe', 'Iñaquito', 'Mejía', 'Cayambe', 'Rumiñahui', 'Calderon', 'Otro'];
  materia: string[] = ['Archivo', 'Ingresos', 'Coordinación', 'Diligencias no Penales', 'Oficina de Citaciones', 'Familia', 'Laboral', 'Penal', 'Civil', 'Otro'];
  diligencia: string[] = ['Copias para Citar', 'Desglose', 'Requerimiento', 'Oficios', 'Otro'];
  piso: string[] = ['Pb', '5to', '8vo', 'Otro'];
  juecesPorPiso: { [key: string]: string[] } = {
    "5to": [
      "Alban Solano Diana",
      "Altamirano Ruiz Santiago",
      "Baño Palomino Patricio",
      "Calero Sánchez Oscar",
      "Cevallos Ampudia Edwin",
      "Chacón Ortiz Francisco",
      "Eguiguren Bermeo Leonardo",
      "Espinoza Venegas Celma",
      "Landazuri Salazar Luis",
      "Lemos Trujillo Gabriel",
      "López Tapia Edison",
      "Martínez Salazar Karina",
      "Mogro Pérez Carlos",
      "Molina Andrade Cintia",
      "Narváez Narváez Paul",
      "Ordóñez Pizarro Rita",
      "Palacios Morillo Vinicio",
      "Romero Ramírez Carmen",
      "Ron Cadena Elizabeth",
      "Simbaña Quispe Martha",
      "Tafur Salazar Jenny",
      "Vaca Duque Lucía",
      "Zambrano Ortiz Wilmer"
    ],
    "8vo": [
      "Chango Baños Edith",
      "Chinde Chamorro Richard",
      "Erazo Navarrete Grimanesa",
      "Fierrro Vega Johana Alexia",
      "Flor Pazmiño Mónica",
      "Fuentes López Carlos",
      "López Vargas Melany",
      "Miranda Calvache Jorge",
      "Pila Avendaño Viviana",
      "Ponce Toala Brenda Leonor",
      "Rodas Sánchez Silvia",
      "Salto Dávila luz",
      "Saltos Pinto Luis",
      "Silva Pereira Cristian",
      "Sanmartin Solano Dayanna Mercedes",
      "Tello Aymacaña Ángel",
      "Torres Recalde Ana",
      "Vallejo Naranjo Byron Andrés",
      "Vela Ribadeneira María"
    ]
  };

  constructor(
    private itinerarioService: ItinerarioService,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef,
  ) { }

  private destroy$ = new Subject<void>();

  onPageIndexChange(pageIndex: number): void {
    this.pageIndex = pageIndex;
  }

  ngOnInit(): void {
    this.itinerarioService.getItinerarios().subscribe((data) => {
      this.itinerarios = data;
      this.updateEditCache(this.itinerarios);
      this.filterItinerarios();
    });

    this.selectedArea.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
    this.selectedDate.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
    this.selectedEstado.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
  }

  onSearch(): void {
    this.filterItinerarios();
  }

  filterItinerarios(): void {
    const selectedAreaValue = this.selectedArea.value;
    const selectedEstadoValue = this.selectedEstado.value;
    const [fechaInicio, fechaFin] = this.selectedDate.value || [null, null];
    const searchTermLower = this.searchTerm.toLowerCase();

    this.filteredItinerarios = this.itinerarios.filter(item => {
      const estadoStr = String(item.estado).toLowerCase();
      const isEstadoMatch = selectedEstadoValue ? estadoStr === String(selectedEstadoValue).toLowerCase() : true;
      const isAreaMatch = selectedAreaValue ? item.area === selectedAreaValue : true;

      const fechaSolicitud = new Date(item.fechaSolicitud);
      const isDateInRange =
        (!fechaInicio || fechaSolicitud >= new Date(fechaInicio)) &&
        (!fechaFin || fechaSolicitud <= new Date(fechaFin));

      const isSearchMatch = searchTermLower === '' ||
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(searchTermLower)
        );

      return isEstadoMatch && isAreaMatch && isDateInRange && isSearchMatch;
    });

    this.filteredItinerarios.sort((a, b) => {
      const fechaA = new Date(a.fechaSolicitud);
      const fechaB = new Date(b.fechaSolicitud);

      const fechaDiff = fechaB.getTime() - fechaA.getTime();
      if (fechaDiff !== 0) {
        return fechaDiff;
      }

      const horaToMinutes = (hora: string | undefined | null) => {
        if (!hora) return 0;
        const partes = hora.split(":");
        if (partes.length < 2) return 0;
        const [horas, minutos] = partes.map(Number);
        return horas * 60 + minutos;
      };

      const horaA = horaToMinutes(a.horaSolicitud);
      const horaB = horaToMinutes(b.horaSolicitud);

      return horaB - horaA;
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
        return 'green';
      case Estado.INCOMPLETO:
        return 'orange';
      case Estado.PENDIENTE:
        return 'red';
      default:
        return 'gray';
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
        return 'Estado desconocido';
    }
  }

  trackById(index: number, item: any): string | number {
    return item.id ?? index;
  }

  // 🌟 Método mejorado para iniciar edición
  startEdit(id: string): void {
    const item = this.filteredItinerarios.find(i => i.id === id);
    if (item) {
      this.editCache[id] = {
        edit: true,
        data: {
          ...item,
          // Asegurar que los campos manuales estén disponibles
          manualArea: item.manualArea || '',
          manualJuzgado: item.manualJuzgado || '',
          manualPiso: item.manualPiso || '',
          manualMateria: item.manualMateria || '',
          manualDiligencia: item.manualDiligencia || ''
        }
      };
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

  // 🌟 Método mejorado para guardar con validaciones
  async saveEdit(id: string): Promise<void> {
    if (!this.editCache[id]) return;

    const editData = this.editCache[id];
    const updatedItinerario = editData.data;
    const index = this.itinerarios.findIndex(item => item.id === id);
    if (index === -1) return;

    // Validaciones básicas
    if (!updatedItinerario.tramite?.trim()) {
      this.message.error('El trámite es obligatorio');
      return;
    }

    if (!updatedItinerario.fechaTermino) {
      this.message.error('La fecha de término es obligatoria');
      return;
    }

    // Validar campos "Otro"
    const validacionesOtro = [
      { campo: 'area', manual: 'manualArea', nombre: 'área' },
      { campo: 'juzgado', manual: 'manualJuzgado', nombre: 'unidad' },
      { campo: 'piso', manual: 'manualPiso', nombre: 'piso' },
      { campo: 'materia', manual: 'manualMateria', nombre: 'materia' },
      { campo: 'diligencia', manual: 'manualDiligencia', nombre: 'diligencia' }
    ];

    for (const validacion of validacionesOtro) {
      if (updatedItinerario[validacion.campo] === 'Otro' &&
        !updatedItinerario[validacion.manual]?.trim()) {
        this.message.error(`Debe especificar ${validacion.nombre} cuando selecciona "Otro"`);
        return;
      }
    }

    if (JSON.stringify(this.itinerarios[index]) === JSON.stringify(updatedItinerario)) {
      this.message.info('No se han realizado cambios.');
      this.editCache[id].edit = false;
      return;
    }

    try {
      await this.itinerarioService.updateItinerario(id, updatedItinerario);
      this.itinerarios[index] = { ...updatedItinerario };
      this.editCache[id].edit = false;
      this.filterItinerarios(); // Refrescar la vista filtrada
      this.message.success('Itinerario actualizado correctamente.');
    } catch (error) {
      this.message.error('Error al actualizar el itinerario. Intente nuevamente.');
      console.error('Error al actualizar el itinerario', error);
    }
  }

  // 🌟 Nuevos métodos para la edición con selects
  getJuecesPorPiso(piso: string): string[] {
    if (!piso || !this.juecesPorPiso[piso]) {
      return [];
    }
    return this.juecesPorPiso[piso];
  }

  onPisoChangeEdit(itemId: string, nuevoPiso: string): void {
    if (this.editCache[itemId]) {
      // Limpiar el juez seleccionado cuando cambia el piso
      this.editCache[itemId].data.juez = '';

      // Si el piso es "Otro", no hay jueces predefinidos
      if (nuevoPiso === 'Otro') {
        this.editCache[itemId].data.juez = '';
      }
    }
  }

  updateEditCache(itinerarios: Itinerario[]): void {
    itinerarios.forEach(item => {
      if (!this.editCache[item.id]) {
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
      this.filterItinerarios();
    }).catch(error => {
      this.message.error('Error al eliminar el itinerario.');
      console.error(error);
    });
  }

  verHistorial(item: any): void {
    this.historialActual = item.historial || [];
    this.isHistorialVisible = true;
  }

  cerrarHistorial(): void {
    this.isHistorialVisible = false;
    this.historialActual = [];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  hasEditingItems(): boolean {
    return Object.values(this.editCache).some(item => item?.edit === true);
  }

}