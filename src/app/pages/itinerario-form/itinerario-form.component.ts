import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { ItinerarioService } from '../../services/itinerario/itinerario.service';
import { UsersService } from '../../services/users/users.service';
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
    NzBreadCrumbModule
  ],
  templateUrl: './itinerario-form.component.html',
  styleUrl: './itinerario-form.component.css'
})
export class ItinerarioFormComponent implements OnInit {

  itinerarioForm: FormGroup = new FormGroup({});
  selectedImage: File | null = null; // 🌟 Ahora manejamos imagen y PDF por separado
  selectedImage2: File | null = null;
  selectedPDF: File | null = null;
  isLoading = false;
  selectedArea: string | null = null;
  slectedUnidad: string | null = null;
  slectedMateria: string | null = null;
  selectDiligencia: string | null = null;
  selectPiso: string | null = null;
  selectJuez: string | null = null;
  areas: string[] = ['ISSFA', 'Bco. Pichincha', 'Bco. Produbanco', 'BNF', 'Inmobiliaria', 'David', 'Otro'];
  unidad: string[] = ['', 'ISSFA', 'Notaria', 'SUPERCIAS', 'ANT', 'Registro Propiedad', 'Quitumbe', 'Iñaquito', 'Mejía', 'Cayambe', 'Rumiñahui', 'Calderon', 'Otro'];
  materia: string[] = ['', 'Archivo', 'Ingresos', 'Coordinación', 'Diligencias no Penales', 'Oficina de Citaciones', 'Familia', 'Laboral', 'Penal', 'Civil', 'Otro'];
  diligencia: string[] = ['','Copias para Citar', 'Desglose', 'Requerimiento', 'Retiro Oficios', 'Otro'];
  piso: string[] = ['', 'Pb', '5to', '8vo', 'Otro', ''];
  juecesPorPiso: { [key: string]: string[] } = {
    '5to': ['', 'Alban Solano Diana', 'Altamirano Ruiz Santiago', 'Calero Sánchez Oscar', 'Chacón Ortiz Francisco', 'Eguiguren Bermeo Leonardo', 'Espinoza Venegas Celma', 'Landazuri Salazar Luis', 'Lemos Trujillo Gabriel', 'López Tapia Edison', 'Martínez Salazar Karina', 'Mogro Pérez Carlos', 'Molina Andrade Cintia', 'Narváez Narváez Paul', 'Ordóñez Pizarro Rita', 'Palacios Morillo Vinicio', 'Baño Palomino Patricio', 'Romero Ramírez Carmen', 'Ron Cadena Elizabeth', 'Simbaña Quispe Martha', 'Tafur Salazar Jenny', 'Vaca Duque Lucía', 'Zambrano Ortiz Wilmer', 'Baño Palomino Patricio', 'Cevallos Ampudia Edwin'],
    '8vo': ['', 'Silva Cristian', 'Miranda Calvache Jorge', 'Chango Baños Edith', 'Fuentes López Carlos', 'Tello Aymacaña Ángel', 'Rodas Sánchez Silvia', 'López Vargas Melany', 'Pila Avendaño Viviana', 'Erazo Navarrete Grimanesa', 'Vela Ribadeneira María', 'Torres Recalde Ana', 'Saltos Pinto Luis', 'Chinde Chamorro Richard', 'Salto Dávila luz', 'Flor Mónica']
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
    private message: NzMessageService
  ) {
    this.itinerarioForm = this.fb.group({
      fileType: [''], // Control para el tipo de archivo (imagen o PDF)
      file: [null]    // Control para el archivo seleccionado
    });
  }

  ngOnInit(): void {
    this.initForm();

    this.itinerarioForm.get('area')?.valueChanges.subscribe(area => {
      this.selectedArea = area;
    });
  }

  getCurrentUserName(): string | null {
    const user = this.usersService.getCurrentUser();
    return user ? user.displayName : null;
  }

  private initForm(): void {
    this.itinerarioForm = this.fb.group({
      creadoPor: [this.getCurrentUserName() || '', Validators.required],
      juzgado: [this.unidad[0]],
      manualJuzgado: [''],
      piso: [this.piso[0]],
      manualPiso: [''],
      juez: [this.jueces[0]],
      manualJuez: [''],
      tramite: ['', Validators.required],
      materia: [this.materia[0]],
      manualMateria: [''],
      diligencia: [this.diligencia[0]],
      manualDiligencia: [''],
      solicita: [''],
      fechaSolicitud: [new Date().toISOString().split('T')[0], Validators.required],
      horaSolicitud: [new Date().toLocaleTimeString(), Validators.required],
      fechaTermino: ['', [Validators.required, this.fechaTerminoValidator]],
      estado: [Estado.PENDIENTE, Validators.required],
      observaciones: [''],
      area: [this.areas[0]],
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
    this.itinerarioForm.patchValue({ area });
    this.showManualAreaInput = this.selectedArea === 'Otro';
  }

  onPisoChange(piso: string): void {
    this.selectPiso = piso;
    this.itinerarioForm.patchValue({ piso });
    this.actualizarJueces(piso);
    this.showManualPisoInput = this.selectPiso === 'Otro';
  }

  private actualizarJueces(piso: string): void {
    // Verificar si el piso tiene jueces asociados
    if (this.juecesPorPiso[piso]) {
      this.jueces = this.juecesPorPiso[piso]; // Asignar los jueces del piso
      this.selectJuez = this.jueces[0]; // Seleccionar el primer juez del piso automáticamente
      this.itinerarioForm.patchValue({ juez: this.selectJuez }); // Corregido: Actualiza el campo juez, no juzgado
    } else {
      this.jueces = [];
      this.selectJuez = null;
      this.itinerarioForm.patchValue({ juez: '' }); // Asegurar que el campo juez quede vacío si no hay jueces
    }
  }

  onJuzgadoChange(juzgado: string): void {
    this.slectedUnidad = juzgado;
    this.itinerarioForm.patchValue({ juzgado });
    this.showManualUnidadInput = this.slectedUnidad === 'Otro';
  }

  onMateriaChange(materia: string): void {
    this.slectedMateria = materia;
    this.itinerarioForm.patchValue({ materia });
    this.showManualMateriaInput = this.slectedMateria === 'Otro';
  }

  onDiligenciaChange(diligencia: string): void {
    this.selectDiligencia = diligencia;
    this.itinerarioForm.patchValue({ diligencia });
    this.showManualDiligenciaInput = this.selectDiligencia === 'Otro';
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

      await this.itinerarioService.createItinerario(
        this.itinerarioForm.value,
        this.selectedImage ?? undefined,  // Imagen principal
        this.selectedPDF ?? undefined,    // PDF
      );
      this.message.success('Itinerario guardado correctamente 🎉');

      const currentArea = this.itinerarioForm.get('area')?.value;

      // 🔄 Reiniciar formulario
      this.itinerarioForm.reset({
        fechaSolicitud: new Date().toISOString().split('T')[0], // Mantiene la fecha actual por defecto
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
      });
      this.selectedImage = null;
      this.selectedPDF = null;
      this.imageFileList = [];
      this.pdfFileList = [];
    } catch (error) {
      console.error('Error al guardar el itinerario:', error);
      this.message.error('Hubo un error al guardar el itinerario. Intente de nuevo.');
    } finally {
      this.isLoading = false;
    }

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
