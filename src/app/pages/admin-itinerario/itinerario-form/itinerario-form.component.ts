import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { ItinerarioService, Itinerario, RutaDiaria } from '../../../services/itinerario/itinerario.service';
import { UsersService } from '../../../services/users/users.service';
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
  selectedImage: File | null = null; // 🌟 Ahora manejamos imagen y PDF por separado
  selectedPDF: File | null = null;
  isLoading = false;
  selectedArea: string | null = null;
  slectedUnidad: string | null = null;
  slectedMateria: string | null = null;
  selectDiligencia: string | null = null;
  selectPiso: string | null = null;
  selectJuez: string | null = null;
  areas: string[] = ['ISSFA', 'Bco. Pichincha', 'Bco. Produbanco', 'BNF', 'Inmobiliaria', 'David', 'Otro'];
  unidad: string[] = [ 'Pague Ya', 'Municipio', 'Notaria', 'SUPERCIAS','AMT', 'ANT', 'SRI', 'ISSFA', 'Consejo Provincial', 'Registro Propiedad', 'Registro Mercantil', 'Quitumbe', 'Iñaquito', 'Mejía', 'Cayambe', 'Rumiñahui', 'Calderon', 'Otro'];
  materia: string[] = ['Archivo', 'Ingresos', 'Coordinación', 'Diligencias no Penales', 'Oficina de Citaciones', 'Familia', 'Laboral', 'Penal', 'Civil', 'Otro'];
  diligencia: string[] = ['Copias para Citar', 'Desglose', 'Requerimiento', 'Retiro Oficios', 'Otro'];
  piso: string[] = ['Pb', '5to', '8vo', 'Otro'];
  juecesPorPiso: { [key: string]: string[] } = {
    "5to": [
      "",
      "Alban Solano Diana",
      "Altamirano Ruiz Santiago",
      "Baño Palomino Patricio",
      "Calero Sánchez Oscar",
      "Cevallos Ampudia Edwin",
      "Chacón Ortiz Francisco",
      "Eguiguren Bermeo Leonardo",
      "Espinoza Venegas Celma",
      "Landazuri Salazar Luis",
      "Lemos Trujillo Gabriel",
      "López Tapia Edison",
      "Martínez Salazar Karina",
      "Mogro Pérez Carlos",
      "Molina Andrade Cintia",
      "Narváez Narváez Paul",
      "Ordóñez Pizarro Rita",
      "Palacios Morillo Vinicio",
      "Romero Ramírez Carmen",
      "Ron Cadena Elizabeth",
      "Simbaña Quispe Martha",
      "Tafur Salazar Jenny",
      "Vaca Duque Lucía",
      "Zambrano Ortiz Wilmer"
    ],
    "8vo": [
      "",
      "Chango Baños Edith",
      "Chinde Chamorro Richard",
      "Erazo Navarrete Grimanesa",
      "Flor Mónica",
      "Fuentes López Carlos",
      "López Vargas Melany",
      "Miranda Calvache Jorge",
      "Pila Avendaño Viviana",
      "Rodas Sánchez Silvia",
      "Salto Dávila luz",
      "Saltos Pinto Luis",
      "Silva Cristian",
      "Tello Aymacaña Ángel",
      "Torres Recalde Ana",
      "Vela Ribadeneira María"
    ]
  };
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
    private modal: NzModalService
  ) {
    this.itinerarioForm = this.fb.group({
      fileType: [''], // Control para el tipo de archivo (imagen o PDF)
      file: [null]    // Control para el archivo seleccionado
    });
  }

  ngOnInit(): void {
    this.initForm();

    // Suscripción a cambios del control 'area'
    this.itinerarioForm.get('area')?.valueChanges.subscribe((area) => {
      this.onAreaChange(area);
    });

    // Suscripción a cambios del control 'unidad'
    this.itinerarioForm.get('juzgado')?.valueChanges.subscribe((unidad) => {
      this.onJuzgadoChange(unidad);
    });

    // Suscripción a cambios del control 'piso'
    this.itinerarioForm.get('piso')?.valueChanges.subscribe((piso) => {
      this.onPisoChange(piso);
    });

    // Suscripción a cambios del control 'materia'
    this.itinerarioForm.get('materia')?.valueChanges.subscribe((materia) => {
      this.onMateriaChange(materia);
    });

    // Suscripción a cambios del control 'diligencia'
    this.itinerarioForm.get('diligencia')?.valueChanges.subscribe((diligencia) => {
      this.onDiligenciaChange(diligencia);
    });
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
      tramite: ['', Validators.required],
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
    if (this.juecesPorPiso[piso]) {
      this.jueces = this.juecesPorPiso[piso];
      this.selectJuez = this.jueces[0];
      this.itinerarioForm.patchValue({ juez: this.selectJuez }, { emitEvent: false });
    } else {
      this.jueces = [];
      this.selectJuez = null;
      this.itinerarioForm.patchValue({ juez: '' }, { emitEvent: false });
    }
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

  // 📂 Manejar selección de PDF
  onPDFSelected(event: any) {
    const file = event.file?.originFileObj;
    if (file) {
      this.selectedPDF = file;
    }
  }

  // 🌟 Enviar formulario
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
          const existingDocs = existingItinerario.docs.map(doc => doc.data() as Itinerario);

          // 🛑 Construimos el mensaje con todos los duplicados
          const duplicadosMsg = existingDocs.map((doc, index) =>
            `📌 #${index + 1} - Trámite: ${doc.tramite} 📅 Fecha de Solicitud: ${doc.fechaSolicitud} 📝 Observaciones: ${doc.observaciones || 'Sin observaciones'}`).join('\n\n');

          // 🛑 Esperar la confirmación del usuario
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
            console.log('Usuario canceló la operación'); // Depuración
            this.isLoading = false;
            return;
          }
        }
      }

      // ✅ Guardado del itinerario
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

  // Método para reiniciar el formulario
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

  // 🌟 Método para limpiar los inputs de archivo
  clearFileInputs(): void {
    // Vacía las listas de archivos en nz-upload
    this.imageFileList = [];
    this.pdfFileList = [];

  }

  private fechaTerminoValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null; // Si el campo está vacío, no validar

    const fechaTermino = new Date(control.value);
    const fechaHoy = new Date();
    fechaHoy.setHours(0, 0, 0, 0); // Eliminamos la hora para comparar solo la fecha

    return fechaTermino <= fechaHoy ? { fechaInvalida: true } : null;
  }


}
