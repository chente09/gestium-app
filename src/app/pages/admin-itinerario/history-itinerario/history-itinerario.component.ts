import { Component, OnInit } from '@angular/core';
import { ItinerarioService, Itinerario } from '../../../services/itinerario/itinerario.service';
import { SharedDataService } from '../../../services/sharedData/shared-data.service';// ✅ NUEVO IMPORT
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
import { UsersService } from '../../../services/users/users.service';

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
  Estado = Estado;
  isHistorialVisible = false;
  historialActual: any[] = [];

  searchTerm: string = '';
  pageSize = 10;
  pageIndex = 1;

  // ✅ USAR SERVICIO CENTRALIZADO EN LUGAR DE ARRAYS LOCALES
  areas: string[] = [];
  unidad: string[] = [];
  materia: string[] = [];
  diligencia: string[] = [];
  piso: string[] = [];
  estados: string[] = [];
  juecesPorPiso: { [key: string]: string[] } = {};

  constructor(
    private itinerarioService: ItinerarioService,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef,
    private usersService: UsersService,
    private sharedDataService: SharedDataService // ✅ INYECTAR SERVICIO
  ) { }

  private destroy$ = new Subject<void>();

  onPageIndexChange(pageIndex: number): void {
    this.pageIndex = pageIndex;
  }

  ngOnInit(): void {
    this.initializeData(); // ✅ INICIALIZAR DATOS DESDE EL SERVICIO

    this.itinerarioService.getItinerarios().subscribe((data) => {
      this.itinerarios = data;
      this.updateEditCache(this.itinerarios);
      this.filterItinerarios();
    });

    this.selectedArea.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
    this.selectedDate.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
    this.selectedEstado.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
  }

  // ✅ NUEVO MÉTODO PARA INICIALIZAR DATOS
  private initializeData(): void {
    this.areas = this.sharedDataService.getAreas();
    this.unidad = this.sharedDataService.getUnidades();
    this.materia = this.sharedDataService.getMaterias();
    this.diligencia = this.sharedDataService.getDiligencias();
    this.piso = this.sharedDataService.getPisos();
    this.estados = this.sharedDataService.getEstados();
    this.juecesPorPiso = this.sharedDataService.juecesPorPiso;
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

  startEdit(id: string): void {
    const item = this.filteredItinerarios.find(i => i.id === id);
    const user = this.usersService.getCurrentUser();

    const usuariosRestringidos = [
      'mmarcillo.gestium@gmail.com',
      'msaguano.gestium@gmail.com'
    ];

    if (item && !usuariosRestringidos.includes(user?.email ?? '')) {
      this.editCache[id] = {
        edit: true,
        data: {
          ...item,
          manualArea: item.manualArea || '',
          manualJuzgado: item.manualJuzgado || '',
          manualPiso: item.manualPiso || '',
          manualMateria: item.manualMateria || '',
          manualDiligencia: item.manualDiligencia || ''
        }
      };
    } else {
      this.message.error('No tienes permiso para editar este itinerario.');
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
      this.filterItinerarios();
      this.message.success('Itinerario actualizado correctamente.');
    } catch (error) {
      this.message.error('Error al actualizar el itinerario. Intente nuevamente.');
      console.error('Error al actualizar el itinerario', error);
    }
  }

  // ✅ USAR EL SERVICIO CENTRALIZADO PARA OBTENER JUECES
  getJuecesPorPiso(piso: string): string[] {
    return this.sharedDataService.getJuecesPorPiso(piso);
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