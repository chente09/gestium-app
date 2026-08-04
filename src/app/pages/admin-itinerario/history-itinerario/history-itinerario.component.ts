import { Component, OnInit } from '@angular/core';
import { ItinerarioService, Itinerario } from '../../../services/itinerario/itinerario.service';
import { SharedDataService } from '../../../services/sharedData/shared-data.service';
import { CommonModule } from '@angular/common';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { UsersService } from '../../../services/users/users.service';
import { RegistersService } from '../../../services/registers/registers.service';

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
    NzUploadModule,
    NzAlertModule,
    NzFormModule,
    NzToolTipModule
  ],
  templateUrl: './history-itinerario.component.html',
  styleUrl: './history-itinerario.component.css'
})
export class HistoryItinerarioComponent implements OnInit {

  itinerarios: Itinerario[] = [];
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

  areas: string[] = [];
  unidad: string[] = [];
  materia: string[] = [];
  diligencia: string[] = [];
  piso: string[] = [];
  estados: string[] = [];
  juecesPorPiso: { [key: string]: string[] } = {};

  // ========== EDICIÓN (modal precargado, mismo layout que itinerario-form) ==========
  editModalVisible = false;
  editForm: FormGroup = new FormGroup({});
  editingItemId: string | null = null;
  editFechaSolicitud: string = '';
  editHoraSolicitud: string = '';
  editSelectedImage: File | null = null;
  editSelectedPDF: File | null = null;
  editImageFileList: any[] = [];
  editPdfFileList: any[] = [];
  editJueces: string[] = [];
  readonly maxPdfSizeMB = 5;
  isSavingEdit = false;

  editShowManualArea = false;
  editShowManualJuzgado = false;
  editShowManualPiso = false;
  editShowManualMateria = false;
  editShowManualDiligencia = false;

  constructor(
    private itinerarioService: ItinerarioService,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef,
    private usersService: UsersService,
    private sharedDataService: SharedDataService,
    private registersService: RegistersService,
    private fb: FormBuilder
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
    } catch (error) {
      this.message.error('Error al revertir el itinerario.');
      console.error(error);
    }
  }

  private destroy$ = new Subject<void>();

  onPageIndexChange(pageIndex: number): void {
    this.pageIndex = pageIndex;
  }

  ngOnInit(): void {
    this.initializeData();

    this.itinerarioService.getItinerarios().subscribe((data) => {
      this.itinerarios = data;
      this.filterItinerarios();
    });

    this.selectedArea.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
    this.selectedDate.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
    this.selectedEstado.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
  }

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
    this.searchTerm = '';
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

    this.editingItemId = id;

    this.editForm = this.fb.group({
      area: [item.area || '', Validators.required],
      manualArea: [item.manualArea || ''],
      tramite: [item.tramite || '', Validators.required],
      nroProceso: [item.nroProceso || ''],
      juzgado: [item.juzgado || ''],
      manualJuzgado: [item.manualJuzgado || ''],
      piso: [item.piso || ''],
      manualPiso: [item.manualPiso || ''],
      juez: [item.juez || ''],
      materia: [item.materia || ''],
      manualMateria: [item.manualMateria || ''],
      diligencia: [item.diligencia || ''],
      manualDiligencia: [item.manualDiligencia || ''],
      solicita: [item.solicita || ''],
      fechaTermino: [item.fechaTermino || '', Validators.required],
      observaciones: [item.observaciones || ''],
    });

    // Fecha/hora de solicitud son el momento en que se pidió el trámite —
    // no se editan, solo se muestran de referencia.
    this.editFechaSolicitud = item.fechaSolicitud || '';
    this.editHoraSolicitud = item.horaSolicitud || '';

    this.editShowManualArea = item.area === 'Otro';
    this.editShowManualJuzgado = item.juzgado === 'Otro';
    this.editShowManualPiso = item.piso === 'Otro';
    this.editShowManualMateria = item.materia === 'Otro';
    this.editShowManualDiligencia = item.diligencia === 'Otro';
    this.editJueces = this.sharedDataService.getJuecesPorPiso(item.piso || '');

    this.editSelectedImage = null;
    this.editSelectedPDF = null;
    this.editImageFileList = [];
    this.editPdfFileList = [];

    this.editModalVisible = true;
  }

  onEditAreaChange(area: string): void {
    this.editShowManualArea = area === 'Otro';
  }

  onEditJuzgadoChange(juzgado: string): void {
    this.editShowManualJuzgado = juzgado === 'Otro';
  }

  onEditPisoChange(piso: string): void {
    this.editShowManualPiso = piso === 'Otro';
    this.editJueces = this.sharedDataService.getJuecesPorPiso(piso);
    this.editForm.patchValue({ juez: '' }, { emitEvent: false });
  }

  onEditMateriaChange(materia: string): void {
    this.editShowManualMateria = materia === 'Otro';
  }

  onEditDiligenciaChange(diligencia: string): void {
    this.editShowManualDiligencia = diligencia === 'Otro';
  }

  onEditImageSelected(event: any): void {
    const file = event.file?.originFileObj;
    if (file) {
      this.editSelectedImage = file;
    }
  }

  onEditPdfSelected(event: any): void {
    const file = event.file?.originFileObj;
    if (!file) return;

    const maxBytes = this.maxPdfSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      this.message.error(
        `El PDF pesa ${(file.size / 1024 / 1024).toFixed(1)}MB, el máximo permitido es ${this.maxPdfSizeMB}MB. Comprímelo antes de subirlo (ej. ilovepdf.com o smallpdf.com) y vuelve a intentarlo.`
      );
      this.editPdfFileList = [];
      this.editSelectedPDF = null;
      return;
    }

    this.editSelectedPDF = file;
  }

  closeEditModal(): void {
    this.editModalVisible = false;
    this.editingItemId = null;
  }

  async saveEdit(): Promise<void> {
    if (!this.editingItemId) return;

    if (this.editForm.invalid) {
      this.message.error('Completa los campos obligatorios (trámite y fecha de término).');
      return;
    }

    const data = this.editForm.value;

    const validacionesOtro = [
      { campo: 'area', manual: 'manualArea', nombre: 'área' },
      { campo: 'juzgado', manual: 'manualJuzgado', nombre: 'unidad' },
      { campo: 'piso', manual: 'manualPiso', nombre: 'piso' },
      { campo: 'materia', manual: 'manualMateria', nombre: 'materia' },
      { campo: 'diligencia', manual: 'manualDiligencia', nombre: 'diligencia' }
    ];

    for (const validacion of validacionesOtro) {
      if (data[validacion.campo] === 'Otro' && !data[validacion.manual]?.trim()) {
        this.message.error(`Debe especificar ${validacion.nombre} cuando selecciona "Otro"`);
        return;
      }
    }

    // Sello automático de edición — no lo pone el usuario, lo pone el sistema.
    const editor = this.usersService.getCurrentUser();
    const ahora = new Date();
    data.fechaEdicion = ahora.toISOString().split('T')[0];
    data.horaEdicion = ahora.toTimeString().slice(0, 5);
    data.editadoPor = editor?.displayName || editor?.email || 'Usuario';

    this.isSavingEdit = true;
    try {
      await this.itinerarioService.updateItinerario(
        this.editingItemId,
        data,
        this.editSelectedImage ?? undefined,
        this.editSelectedPDF ?? undefined
      );
      this.message.success('Itinerario actualizado correctamente.');
      this.closeEditModal();
      this.filterItinerarios();
    } catch (error) {
      this.message.error('Error al actualizar el itinerario. Intente nuevamente.');
      console.error('Error al actualizar el itinerario', error);
    } finally {
      this.isSavingEdit = false;
    }
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
