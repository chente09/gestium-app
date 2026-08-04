import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ItinerarioService, Itinerario } from '../../../services/itinerario/itinerario.service';
import { SharedDataService } from '../../../services/sharedData/shared-data.service';
import { UsersService } from '../../../services/users/users.service';

// Modal de edición reutilizado por "Pendientes" e "Historial" — mismo
// layout que itinerario-form, precargado con el registro existente.
// Alcance: solo campos del caso, no los de finalización (esos viven en
// el flujo "Completar" de itinerario.component.ts).
@Component({
  selector: 'app-itinerario-edit-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzGridModule,
    NzButtonModule,
    NzIconModule,
    NzUploadModule,
    NzAlertModule
  ],
  templateUrl: './itinerario-edit-modal.component.html',
  styleUrl: './itinerario-edit-modal.component.css'
})
export class ItinerarioEditModalComponent implements OnChanges {
  @Input() itinerario: Itinerario | null = null;
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<string>();

  editForm: FormGroup = new FormGroup({});
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

  editFechaSolicitud = '';
  editHoraSolicitud = '';

  areas: string[] = [];
  unidad: string[] = [];
  materia: string[] = [];
  diligencia: string[] = [];
  piso: string[] = [];

  constructor(
    private fb: FormBuilder,
    private itinerarioService: ItinerarioService,
    private sharedDataService: SharedDataService,
    private usersService: UsersService,
    private message: NzMessageService
  ) {
    this.areas = this.sharedDataService.getAreas();
    this.unidad = this.sharedDataService.getUnidades();
    this.materia = this.sharedDataService.getMaterias();
    this.diligencia = this.sharedDataService.getDiligencias();
    this.piso = this.sharedDataService.getPisos();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['itinerario'] && this.itinerario) {
      this.buildForm(this.itinerario);
    }
  }

  private buildForm(item: Itinerario): void {
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

    this.editShowManualArea = item.area === 'Otro';
    this.editShowManualJuzgado = item.juzgado === 'Otro';
    this.editShowManualPiso = item.piso === 'Otro';
    this.editShowManualMateria = item.materia === 'Otro';
    this.editShowManualDiligencia = item.diligencia === 'Otro';
    this.editJueces = this.sharedDataService.getJuecesPorPiso(item.piso || '');

    // Fecha/hora de solicitud son el momento en que se pidió el trámite —
    // no se editan, solo se muestran de referencia.
    this.editFechaSolicitud = item.fechaSolicitud || '';
    this.editHoraSolicitud = item.horaSolicitud || '';

    this.editSelectedImage = null;
    this.editSelectedPDF = null;
    this.editImageFileList = [];
    this.editPdfFileList = [];
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

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async save(): Promise<void> {
    if (!this.itinerario) return;

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

    const id = this.itinerario.id;
    this.isSavingEdit = true;
    try {
      await this.itinerarioService.updateItinerario(
        id,
        data,
        this.editSelectedImage ?? undefined,
        this.editSelectedPDF ?? undefined
      );
      this.message.success('Itinerario actualizado correctamente.');
      this.saved.emit(id);
      this.close();
    } catch (error) {
      this.message.error('Error al actualizar el itinerario. Intente nuevamente.');
      console.error('Error al actualizar el itinerario', error);
    } finally {
      this.isSavingEdit = false;
    }
  }
}
