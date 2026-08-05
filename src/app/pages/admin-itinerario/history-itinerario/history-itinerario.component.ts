import { Component, OnInit } from '@angular/core';
import { ItinerarioService, Itinerario } from '../../../services/itinerario/itinerario.service';
import { SharedDataService } from '../../../services/sharedData/shared-data.service';
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
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { UsersService } from '../../../services/users/users.service';
import { RegistersService } from '../../../services/registers/registers.service';
import { ItinerarioEditModalComponent } from '../itinerario-edit-modal/itinerario-edit-modal.component';

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
    NzInputModule,
    NzToolTipModule,
    NzCardModule,
    NzCollapseModule,
    ItinerarioEditModalComponent
  ],
  templateUrl: './history-itinerario.component.html',
  styleUrl: './history-itinerario.component.css'
})
export class HistoryItinerarioComponent implements OnInit {

  itinerarios: Itinerario[] = [];
  filteredItinerarios: Itinerario[] = [];
  isLoadingItinerarios = false;
  readonly diasHistorial = 90;
  selectedArea = new FormControl('');
  selectedDate = new FormControl<[Date | null, Date | null]>([null, null]);
  selectedEstado = new FormControl(null);
  Estado = Estado;
  isHistorialVisible = false;
  historialActual: any[] = [];

  searchTerm: string = '';
  pageSize = 10;
  pageIndex = 1;

  areas: { nombre: string; slug: string }[] = [];
  unidad: string[] = [];
  materia: string[] = [];
  diligencia: string[] = [];
  piso: string[] = [];
  estados: string[] = [];
  juecesPorPiso: { [key: string]: string[] } = {};

  // ========== EDICIÓN (modal compartido con Pendientes) ==========
  editModalVisible = false;
  editingItem: Itinerario | null = null;

  constructor(
    private itinerarioService: ItinerarioService,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef,
    private usersService: UsersService,
    private sharedDataService: SharedDataService,
    private registersService: RegistersService
  ) { }

  isAdmin(): boolean {
    return this.registersService.isCurrentUserAdmin();
  }

  // Trámites queda fuera: tiene requisitos de finalización más estrictos
  // (foto + observación obligatorias), así que no puede reabrir sus propios
  // completados por esta vía.
  puedeRevertir(item: Itinerario): boolean {
    const area = this.registersService.getCurrentRegister()?.areaAsignada;
    return item.estado === Estado.COMPLETADO && area !== 'TRAMITES';
  }

  async revertirAPendiente(id: string): Promise<void> {
    const user = this.usersService.getCurrentUser();
    if (!user) {
      this.message.error('No hay un usuario autenticado.');
      return;
    }
    try {
      await this.itinerarioService.revertirAPendiente(id, {
        uid: user.uid,
        email: user.email ?? undefined,
        nombre: user.displayName ?? undefined,
      });
      this.message.success('Itinerario devuelto a pendiente. Se guardó un registro en el historial.');
      await this.refrescarUnItem(id);
    } catch (error) {
      this.message.error('Error al revertir el itinerario.');
      console.error(error);
    }
  }

  // Sin listener en tiempo real, hay que traer y parchar a mano el ítem que
  // acaba de cambiar en vez de esperar a que Firestore lo empuje solo.
  private async refrescarUnItem(id: string): Promise<void> {
    try {
      const actualizado = await this.itinerarioService.getItinerarioById(id);
      if (!actualizado) return;
      const index = this.itinerarios.findIndex(it => it.id === id);
      if (index !== -1) {
        this.itinerarios[index] = actualizado;
      } else {
        this.itinerarios.push(actualizado);
      }
      this.filterItinerarios();
    } catch (error) {
      console.error('Error al refrescar el itinerario:', error);
    }
  }

  private destroy$ = new Subject<void>();

  onPageIndexChange(pageIndex: number): void {
    this.pageIndex = pageIndex;
  }

  ngOnInit(): void {
    this.initializeData();
    this.cargarItinerarios();

    this.selectedArea.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
    this.selectedDate.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
    this.selectedEstado.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
  }

  private initializeData(): void {
    this.registersService.getActiveAreaEntries().then(entries => {
      this.areas = [...entries, { nombre: 'Otro', slug: 'Otro' }];
    });
    this.unidad = this.sharedDataService.getUnidades();
    this.materia = this.sharedDataService.getMaterias();
    this.diligencia = this.sharedDataService.getDiligencias();
    this.piso = this.sharedDataService.getPisos();
    this.estados = this.sharedDataService.getEstados();
    this.juecesPorPiso = this.sharedDataService.juecesPorPiso;
  }

  // Carga única (no en tiempo real) de los últimos `diasHistorial` días —
  // ver el porqué en ItinerarioService.getItinerariosRecientes. Al no
  // quedarse escuchando cambios en vivo, hay que refrescar a mano.
  async cargarItinerarios(): Promise<void> {
    this.isLoadingItinerarios = true;
    try {
      this.itinerarios = await this.itinerarioService.getItinerariosRecientes(this.diasHistorial);
      this.filterItinerarios();
    } catch (error) {
      console.error('Error al cargar el historial:', error);
      this.message.error('Error al cargar el historial.');
    } finally {
      this.isLoadingItinerarios = false;
    }
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
    this.searchTerm = '';
    this.filterItinerarios();
  }

  // El itinerario guarda el slug del área; esto lo traduce al nombre para mostrar.
  getAreaDisplayName(slug: string): string {
    return this.areas.find(area => area.slug === slug)?.nombre || slug;
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

  // ========== EDICIÓN ==========

  startEdit(id: string): void {
    const item = this.filteredItinerarios.find(i => i.id === id);

    // Antes era una lista de 2 emails hardcodeados; en los datos reales
    // ambos comparten areaAsignada 'sin_asignar', así que el criterio pasa
    // a ser "sin área asignada" — igual que con Trámites, reasignar área
    // desde Admin ya no requiere tocar código.
    const areaAsignada = this.registersService.getCurrentRegister()?.areaAsignada;

    if (!item || !areaAsignada || areaAsignada === 'sin_asignar') {
      this.message.error('No tienes permiso para editar este itinerario.');
      return;
    }

    this.editingItem = item;
    this.editModalVisible = true;
  }

  onItemSaved(id: string): void {
    this.refrescarUnItem(id);
  }

  getJuecesPorPiso(piso: string): string[] {
    return this.sharedDataService.getJuecesPorPiso(piso);
  }

  eliminar(id: string): void {
    if (!this.isAdmin()) {
      this.message.error('Solo un administrador puede eliminar itinerarios.');
      return;
    }
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
}
