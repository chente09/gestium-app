import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { ItinerarioService, Itinerario, RutaDiaria } from '../../../services/itinerario/itinerario.service';
import { UsersService } from '../../../services/users/users.service';
import { SharedDataService } from '../../../services/sharedData/shared-data.service';// ✅ NUEVO IMPORT
import { CommonModule } from '@angular/common';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormsModule } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { RouterModule } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { doc } from '@angular/fire/firestore';

enum Estado {
  COMPLETADO = 'completado',
  INCOMPLETO = 'incompleto',
  PENDIENTE = 'pendiente'
}

@Component({
  selector: 'app-itinerario-form',
  standalone: true,
  imports: [
    CommonModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzSwitchModule,
    ReactiveFormsModule,
    NzSelectModule,
    FormsModule,
    RouterModule,
    NzIconModule,
    NzRadioModule,
    NzUploadModule,
    NzBreadCrumbModule,
    NzModalModule
  ],
  templateUrl: './itinerario-form.component.html',
  styleUrl: './itinerario-form.component.css'
})
export class ItinerarioFormComponent implements OnInit {

  itinerarioForm: FormGroup = new FormGroup({});
  selectedImage: File | null = null;
  selectedPDF: File | null = null;
  isLoading = false;
  selectedArea: string | null = null;
  slectedUnidad: string | null = null;
  slectedMateria: string | null = null;
  selectDiligencia: string | null = null;
  selectPiso: string | null = null;
  selectJuez: string | null = null;

  // ✅ USAR SERVICIO CENTRALIZADO EN LUGAR DE ARRAYS LOCALES
  areas: string[] = [];
  unidad: string[] = [];
  materia: string[] = [];
  diligencia: string[] = [];
  piso: string[] = [];
  juecesPorPiso: { [key: string]: string[] } = {};
  jueces: string[] = [];
  
  selectedFileType: string = 'image';
  selectedFileName: string | null = null;
  imageFileList: any[] = [];
  pdfFileList: any[] = [];

  showManualAreaInput: boolean = false;
  showManualUnidadInput: boolean = false;
  showManualMateriaInput: boolean = false;
  showManualDiligenciaInput: boolean = false;
  showManualPisoInput: boolean = false;

  constructor(
    private fb: FormBuilder,
    private itinerarioService: ItinerarioService,
    private usersService: UsersService,
    private message: NzMessageService,
    private modal: NzModalService,
    private sharedDataService: SharedDataService // ✅ INYECTAR SERVICIO
  ) {
    this.itinerarioForm = this.fb.group({
      fileType: [''],
      file: [null]
    });
  }

  ngOnInit(): void {
    this.initializeData(); // ✅ INICIALIZAR DATOS DESDE EL SERVICIO
    this.initForm();

    // Suscripciones existentes...
    this.itinerarioForm.get('area')?.valueChanges.subscribe((area) => {
      this.onAreaChange(area);
    });

    this.itinerarioForm.get('juzgado')?.valueChanges.subscribe((unidad) => {
      this.onJuzgadoChange(unidad);
    });

    this.itinerarioForm.get('piso')?.valueChanges.subscribe((piso) => {
      this.onPisoChange(piso);
    });

    this.itinerarioForm.get('materia')?.valueChanges.subscribe((materia) => {
      this.onMateriaChange(materia);
    });

    this.itinerarioForm.get('diligencia')?.valueChanges.subscribe((diligencia) => {
      this.onDiligenciaChange(diligencia);
    });
  }

  // ✅ NUEVO MÉTODO PARA INICIALIZAR DATOS
  private initializeData(): void {
    this.areas = this.sharedDataService.getAreas();
    this.unidad = this.sharedDataService.getUnidades();
    this.materia = this.sharedDataService.getMaterias();
    this.diligencia = this.sharedDataService.getDiligencias();
    this.piso = this.sharedDataService.getPisos();
    this.juecesPorPiso = this.sharedDataService.juecesPorPiso;
  }

  getCurrentUserName(): string | null {
    const user = this.usersService.getCurrentUser();
    return user ? user.displayName : null;
  }

  private initForm(): void {
    this.itinerarioForm = this.fb.group({
      creadoPor: [this.getCurrentUserName() || '', Validators.required],
      juzgado: [''],
      manualJuzgado: [''],
      piso: [''],
      manualPiso: [''],
      juez: [''],
      manualJuez: [''],
      tramite: [''],
      nroProceso: [''],
      materia: [''],
      manualMateria: [''],
      diligencia: [''],
      manualDiligencia: [''],
      solicita: [''],
      fechaSolicitud: [new Date().toISOString().split('T')[0], Validators.required],
      horaSolicitud: [new Date().toTimeString().slice(0, 5), Validators.required],
      fechaTermino: ['', [Validators.required, this.fechaTerminoValidator]],
      estado: [Estado.PENDIENTE, Validators.required],
      observaciones: [''],
      area: [''],
      manualArea: [''],
    });

    this.selectedArea = this.areas[0];
    this.selectPiso = this.piso[0];
    this.actualizarJueces(this.selectPiso);
    this.slectedUnidad = this.unidad[0];
    this.slectedMateria = this.materia[0];
    this.selectDiligencia = this.diligencia[0];
    this.selectJuez = null;

    this.actualizarJueces(this.selectPiso);
  }

  onAreaChange(area: string): void {
    this.selectedArea = area;
    this.showManualAreaInput = this.selectedArea === 'Otro';
    this.itinerarioForm.patchValue({ area }, { emitEvent: false });
  }

  onPisoChange(piso: string): void {
    this.selectPiso = piso;
    this.showManualPisoInput = this.selectPiso === 'Otro';
    this.itinerarioForm.patchValue({ piso }, { emitEvent: false });
    this.actualizarJueces(piso);
  }

  private actualizarJueces(piso: string): void {
    // ✅ USAR EL SERVICIO CENTRALIZADO
    this.jueces = this.sharedDataService.getJuecesPorPiso(piso);
    this.selectJuez = null;
    this.itinerarioForm.patchValue({ juez: this.selectJuez }, { emitEvent: false });
  }

  onJuzgadoChange(juzgado: string): void {
    this.slectedUnidad = juzgado;
    this.showManualUnidadInput = this.slectedUnidad === 'Otro';
    this.itinerarioForm.patchValue({ unidad: juzgado }, { emitEvent: false });
  }

  onMateriaChange(materia: string): void {
    this.slectedMateria = materia;
    this.showManualMateriaInput = this.slectedMateria === 'Otro';
    this.itinerarioForm.patchValue({ materia }, { emitEvent: false });
  }

  onDiligenciaChange(diligencia: string): void {
    this.selectDiligencia = diligencia;
    this.showManualDiligenciaInput = this.selectDiligencia === 'Otro';
    this.itinerarioForm.patchValue({ diligencia }, { emitEvent: false });
  }

  onImageSelected(event: any) {
    const file = event.file?.originFileObj;
    if (file) {
      this.selectedImage = file;
    }
  }

  onPDFSelected(event: any) {
    const file = event.file?.originFileObj;
    if (file) {
      this.selectedPDF = file;
    }
  }

  async submitForm(): Promise<void> {
    if (this.itinerarioForm.invalid || !this.selectedArea) {
      this.message.warning('Debe completar todos los campos obligatorios.');
      return;
    }

    this.isLoading = true;
    this.message.loading('Guardando itinerario...', { nzDuration: 1000 });

    try {
      const nroProceso = this.itinerarioForm.get('nroProceso')?.value;

      if (nroProceso) {
        const existingItinerario = await this.itinerarioService.getItinerarioByNroProceso(nroProceso);

        if (!existingItinerario.empty) {
          const existingDocs = existingItinerario.docs.map(doc => doc.data() as Itinerario).filter(doc => doc.estado !== Estado.COMPLETADO);

          const duplicadosMsg = existingDocs.map((doc, index) =>
            `📌 #${index + 1} - Trámite: ${doc.tramite} 📅 Fecha de Solicitud: ${doc.fechaSolicitud} 📝 Observaciones: ${doc.observaciones || 'Sin observaciones'}`).join('\n\n');

          const userConfirmed = await new Promise<boolean>((resolve) => {
            this.modal.confirm({
              nzTitle: 'Número de proceso duplicado',
              nzContent: `
                    <div style="max-height: 300px; overflow-y: auto;">
                        <p>⚠️ El número de proceso "<b>${nroProceso}</b>" ya está registrado en los siguientes trámites:</p>
                        <ul style="padding-left: 20px;">
                            ${existingDocs.map((doc, index) => `
                                <li>
                                    <b>#${index + 1}</b> - <b>Trámite:</b> ${doc.tramite} <br>
                                    📅 <b>Fecha de Solicitud:</b> ${doc.fechaSolicitud} <br>
                                    📝 <b>Observaciones:</b> ${doc.observaciones || 'Sin observaciones'}
                                </li>
                            `).join('')}
                        </ul>
                        <p>¿Desea continuar con el guardado?</p>
                    </div>
                `,
              nzOkText: 'Sí, continuar',
              nzCancelText: 'No, cancelar',
              nzOnOk: () => resolve(true),
              nzOnCancel: () => resolve(false),
            });
          });
          if (!userConfirmed) {
            console.log('Usuario canceló la operación');
            this.isLoading = false;
            return;
          }
        }
      }

      await this.itinerarioService.createItinerario(
        this.itinerarioForm.value,
        this.selectedImage ?? undefined,
        this.selectedPDF ?? undefined
      );

      this.message.success('Itinerario guardado correctamente 🎉');
      this.resetForm();

    } catch (error) {
      console.error('Error al guardar el itinerario:', error);
      this.message.error('Hubo un error al guardar el itinerario. Intente de nuevo.');
    } finally {
      this.isLoading = false;
    }
  }

  private resetForm() {
    const currentArea = this.itinerarioForm.get('area')?.value;
    this.itinerarioForm.reset({
      fechaSolicitud: new Date().toISOString().split('T')[0],
      horaSolicitud: new Date().toLocaleTimeString(),
      area: currentArea,
      creadoPor: this.getCurrentUserName() || '',
      juzgado: this.unidad[0],
      piso: this.piso[0],
      juez: this.jueces[0],
      tramite: '',
      materia: this.materia[0],
      diligencia: this.diligencia[0],
      solicita: '',
      fechaTermino: '',
      estado: Estado.PENDIENTE,
      observaciones: '',
    },
      { emitEvent: false }
    );

    this.selectedImage = null;
    this.selectedPDF = null;
    this.imageFileList = [];
    this.pdfFileList = [];
  }

  clearFileInputs(): void {
    this.imageFileList = [];
    this.pdfFileList = [];
  }

  private fechaTerminoValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const fechaTermino = new Date(control.value);
    const fechaHoy = new Date();
    fechaHoy.setHours(0, 0, 0, 0);

    return fechaTermino <= fechaHoy ? { fechaInvalida: true } : null;
  }
}