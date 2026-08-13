import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { ItinerarioService, Itinerario, RutaDiaria } from '../../../services/itinerario/itinerario.service';
import { UsersService } from '../../../services/users/users.service';
import { SharedDataService } from '../../../services/sharedData/shared-data.service';// ✅ NUEVO IMPORT
import { RegistersService } from '../../../services/registers/registers.service';
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
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { doc } from '@angular/fire/firestore';
import { DateUtilsService } from '../../../services/date-utils/date-utils.service';
import { Router } from '@angular/router';

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
    NzModalModule,
    NzAlertModule
  ],
  templateUrl: './itinerario-form.component.html',
  styleUrl: './itinerario-form.component.css'
})
export class ItinerarioFormComponent implements OnInit {

  itinerarioForm: FormGroup = new FormGroup({});
  selectedImage: File | null = null;
  selectedPDF: File | null = null;
  readonly maxPdfSizeMB = 5;
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
    private sharedDataService: SharedDataService, // ✅ INYECTAR SERVICIO
    private registersService: RegistersService,
    private dateUtils: DateUtilsService,
    private router: Router
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
    this.registersService.getActiveAreaNames().then(names => {
      this.areas = [...names, 'Otro'];
    });
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
      fechaSolicitud: [this.dateUtils.getFechaActualEcuador(), Validators.required],
      horaSolicitud: [this.dateUtils.getHoraActualEcuador(), Validators.required],
      fechaTermino: ['', [Validators.required, this.fechaTerminoValidator.bind(this)]],
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
    if (!file) return;

    const maxBytes = this.maxPdfSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      this.message.error(
        `El PDF pesa ${(file.size / 1024 / 1024).toFixed(1)}MB, el máximo permitido es ${this.maxPdfSizeMB}MB. Comprímelo antes de subirlo (ej. ilovepdf.com o smallpdf.com) y vuelve a intentarlo.`
      );
      this.pdfFileList = [];
      this.selectedPDF = null;
      return;
    }

    this.selectedPDF = file;
  }

  async submitForm(): Promise<void> {
    // ✅ PROTECCIÓN #1: Verificar si ya está guardando
    if (this.isLoading) {
      console.warn('⚠️ Ya hay un guardado en proceso. Ignorando clic duplicado.');
      return;
    }

    // ✅ PROTECCIÓN #2: Activar loading INMEDIATAMENTE
    this.isLoading = true;

    // Validación después de activar loading
    if (this.itinerarioForm.invalid || !this.selectedArea) {
      this.message.warning('Debe completar todos los campos obligatorios.');
      this.isLoading = false; // ✅ Desactivar loading si falla validación
      return;
    }

    this.message.loading('Guardando itinerario...', { nzDuration: 1000 });

    try {
      const nroProceso = this.itinerarioForm.get('nroProceso')?.value;

      if (nroProceso) {
        const existingItinerario = await this.itinerarioService.getItinerarioByNroProceso(nroProceso);
        const allDocs = existingItinerario.docs.map(d => ({ id: d.id, data: d.data() as Itinerario }));
        const activos = allDocs.filter(d => d.data.estado !== Estado.COMPLETADO);
        const completados = allDocs.filter(d => d.data.estado === Estado.COMPLETADO);

        // Ya hay un trámite activo (pendiente/incompleto) con ese número:
        // no se crea uno nuevo, hay que editar el que ya existe.
        if (activos.length > 0) {
          this.isLoading = false;

          // Con un solo match activo podemos llevar directo a editarlo; con
          // más de uno (caso raro) solo informamos, sin adivinar cuál.
          const irAEditar = activos.length === 1;
          const listaHtml = `
              <div style="max-height: 300px; overflow-y: auto;">
                <p>⚠️ El número de proceso "<b>${nroProceso}</b>" ya está pendiente/incompleto en los siguientes trámites:</p>
                <ul style="padding-left: 20px;">
                  ${activos.map((d, index) => `
                    <li>
                      <b>#${index + 1}</b> - <b>Trámite:</b> ${d.data.tramite} <br>
                      📅 <b>Fecha de Solicitud:</b> ${d.data.fechaSolicitud} <br>
                      📝 <b>Observaciones:</b> ${d.data.observaciones || 'Sin observaciones'}
                    </li>
                  `).join('')}
                </ul>
              </div>`;

          if (irAEditar) {
            const quiereEditar = await new Promise<boolean>((resolve) => {
              this.modal.confirm({
                nzTitle: 'Número de proceso ya activo',
                nzContent: listaHtml + '<p>Edítalo en vez de crear uno nuevo.</p>',
                nzOkText: 'Ir a editar',
                nzCancelText: 'Cerrar',
                nzOnOk: () => resolve(true),
                nzOnCancel: () => resolve(false),
              });
            });

            if (quiereEditar) {
              this.router.navigate(['/itinerario'], { queryParams: { editId: activos[0].id } });
            }
          } else {
            await new Promise<void>((resolve) => {
              this.modal.warning({
                nzTitle: 'Número de proceso ya activo',
                nzContent: listaHtml + '<p>Edítalo desde la lista de Itinerarios en vez de crear uno nuevo.</p>',
                nzOkText: 'Entendido',
                nzOnOk: () => resolve(),
              });
            });
          }

          return;
        }

        // Solo hay coincidencias ya completadas: no es un duplicado real,
        // pero se ofrece reabrir el más reciente con la nueva solicitud
        // en vez de dejar crear un registro suelto aparte.
        if (completados.length > 0) {
          this.isLoading = false;

          const masReciente = [...completados].sort((a, b) =>
            (b.data.fechaCompletado || '').localeCompare(a.data.fechaCompletado || '')
          )[0];

          const quiereReabrir = await new Promise<boolean>((resolve) => {
            this.modal.confirm({
              nzTitle: 'Trámite ya completado con este número',
              nzContent: `
              <div style="max-height: 300px; overflow-y: auto;">
                <p>El número de proceso "<b>${nroProceso}</b>" ya se completó antes:</p>
                <ul style="padding-left: 20px;">
                  <li>
                    <b>Trámite:</b> ${masReciente.data.tramite} <br>
                    📅 <b>Completado el:</b> ${masReciente.data.fechaCompletado || '—'} <br>
                    📝 <b>Observación de cierre:</b> ${masReciente.data.obsCompletado || 'Sin observaciones'}
                  </li>
                </ul>
                <p>¿Querés <b>reabrirlo</b> con esta nueva solicitud (se actualizan las fechas y queda registrado en el historial), en vez de crear un registro aparte?</p>
              </div>
            `,
              nzOkText: 'Sí, reabrir',
              nzCancelText: 'Crear uno nuevo',
              nzOkLoading: false,
              nzOnOk: () => resolve(true),
              nzOnCancel: () => resolve(false),
            });
          });

          if (quiereReabrir) {
            const user = this.usersService.getCurrentUser();
            const formData = this.itinerarioForm.value;

            // El dropdown muestra/guarda el nombre del área; Firestore guarda
            // el slug — misma resolución que al crear un registro nuevo.
            const resolvedArea = formData.area && formData.area !== 'Otro'
              ? (await this.registersService.findAreaByIdentifier(formData.area))?.slug || formData.area
              : formData.area;

            // Reabrir con nueva solicitud reemplaza los datos activos del
            // registro por los de esta nueva solicitud — pero la mayoría de
            // estos campos son opcionales en el formulario, así que si se
            // dejan en blanco no deben borrar los valores completos que ya
            // tenía el trámite anterior. Solo se manda lo que sí se llenó;
            // fechaSolicitud/horaSolicitud/fechaTermino/creadoPor/área van
            // siempre porque el formulario ya los exige como obligatorios.
            const camposReapertura: Record<string, any> = {
              creadoPor: formData.creadoPor,
              juzgado: formData.juzgado,
              manualJuzgado: formData.manualJuzgado,
              materia: formData.materia,
              manualMateria: formData.manualMateria,
              diligencia: formData.diligencia,
              manualDiligencia: formData.manualDiligencia,
              piso: formData.piso,
              manualPiso: formData.manualPiso,
              juez: formData.juez,
              tramite: formData.tramite,
              solicita: formData.solicita,
              fechaSolicitud: formData.fechaSolicitud,
              horaSolicitud: formData.horaSolicitud,
              fechaTermino: formData.fechaTermino,
              observaciones: formData.observaciones,
              area: resolvedArea,
              manualArea: formData.manualArea,
            };
            const nuevaSolicitudSinBlancos = Object.fromEntries(
              Object.entries(camposReapertura).filter(([, valor]) => valor !== '' && valor !== null && valor !== undefined)
            );

            try {
              await this.itinerarioService.revertirAPendiente(
                masReciente.id,
                {
                  uid: user?.uid || '',
                  email: user?.email ?? undefined,
                  nombre: user?.displayName ?? undefined,
                },
                nuevaSolicitudSinBlancos
              );
              this.message.success('Trámite reabierto con la nueva solicitud 🔄');
              this.resetForm();
            } catch (error) {
              console.error('Error al reabrir el itinerario:', error);
              this.message.error('Hubo un error al reabrir el trámite.');
            } finally {
              this.isLoading = false;
            }
            return;
          }

          // El usuario prefiere crear uno nuevo aparte: sigue el flujo normal.
          this.isLoading = true;
        }
      }

      // ✅ PROTECCIÓN #6: Verificar NUEVAMENTE antes de guardar
      if (!this.isLoading) {
        this.isLoading = true;
      }

      const formData = this.itinerarioForm.value;

      // El dropdown muestra/guarda el nombre del área ("Pichincha"); Firestore
      // guarda el slug ("pichincha"). 'Otro' no es un área real, queda literal.
      const resolvedArea = formData.area && formData.area !== 'Otro'
        ? (await this.registersService.findAreaByIdentifier(formData.area))?.slug || formData.area
        : formData.area;

      const itinerarioData = {
        ...formData,
        area: resolvedArea,
        createdAtServer: this.dateUtils.getServerTimestamp()
      };

      await this.itinerarioService.createItinerario(
        itinerarioData,
        this.selectedImage ?? undefined,
        this.selectedPDF ?? undefined
      );

      this.message.success('Itinerario guardado correctamente 🎉');
      this.resetForm();

    } catch (error) {
      console.error('Error al guardar el itinerario:', error);
      this.message.error('Hubo un error al guardar el itinerario. Intente de nuevo.');
    } finally {
      // ✅ PROTECCIÓN #7: Siempre desactivar loading al final
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

    const fechaTermino = control.value;
    const fechaActual = this.dateUtils.getFechaActualEcuador();

    // Solo permite fechas FUTURAS (mayor que hoy, sin incluir hoy)
    return fechaTermino > fechaActual ? null : { fechaInvalida: true };
  }
}