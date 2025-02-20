import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ItinerarioService } from '../../services/itinerario/itinerario.service';
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
    NzUploadModule
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
  areas: string[] = ['ISSFA', 'Bco. Pichincha', 'Bco. Produbanco', 'BNF', 'Inmobiliaria', 'David', 'Otro'];
  selectedFileType: string = 'image';
  selectedFileName: string | null = null;
  imageFileList: any[] = [];
  pdfFileList: any[] = [];

  constructor(
    private fb: FormBuilder,
    private itinerarioService: ItinerarioService,
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

  private initForm(): void {
    this.itinerarioForm = this.fb.group({
      juzgado: [''],
      piso: [''],
      tramite: ['', Validators.required],
      solicita: [''],
      fechaSolicitud: [new Date().toISOString().split('T')[0], Validators.required],
      fechaTermino: ['', Validators.required],
      estado: [false],
      observaciones: [''],
      area: [this.areas[0]],
    });

    this.selectedArea = this.areas[0];
  }

  onAreaChange(area: string): void {
    this.selectedArea = area;
    this.itinerarioForm.patchValue({ area });
  }
  onImageSelected(event: any) {
    const file = event.file.originFileObj;  // Extrae el archivo correctamente
    if (file) {
      this.selectedImage = file;
    }
  }

  onImage2Selected(event: any) {
    const file = event.file.originFileObj;  // Extrae el archivo correctamente
    if (file) {
      this.selectedImage2 = file;
    }
  }

  // 📂 Manejar selección de PDF
  onPDFSelected(event: any) {
    const file = event.file.originFileObj;  // Extrae el archivo correctamente
    if (file) {
      this.selectedPDF = file;
    }
  }
  // 🌟 Enviar formulario
  async submitForm(): Promise<void> {
    if (this.itinerarioForm.invalid || !this.selectedArea) {
      this.message.warning('Debe seleccionar un área y completar todos los campos obligatorios.');
      return;
    }

    this.isLoading = true;
    this.message.loading('Guardando itinerario...', { nzDuration: 1000 });

    try {
      const formData = this.itinerarioForm.value;

      await this.itinerarioService.createItinerario(
        this.itinerarioForm.value,
        this.selectedImage ?? undefined,  // Imagen principal
        this.selectedPDF ?? undefined,    // PDF
        this.selectedImage2 ?? undefined  // Imagen de completado
      );
      this.message.success('Itinerario guardado correctamente 🎉');

      // 🔄 Reiniciar formulario
      this.itinerarioForm.reset({
        fechaSolicitud: new Date().toISOString().split('T')[0], // Mantiene la fecha actual por defecto
        area: this.areas[0]
      });
      this.selectedImage = null;
      this.selectedPDF = null;
      this.selectedImage2 = null;
      this.selectedArea = this.areas[0];

      this.clearFileInputs();
    } catch (error) {
      console.error('Error al guardar el itinerario:', error);
      this.message.error('Hubo un error al guardar el itinerario. Intente de nuevo.');
    } finally {
      this.isLoading = false;
    }

  }

  // 🌟 Método para limpiar los inputs de archivo
  clearFileInputs(): void {
    this.selectedImage = null;
    this.selectedPDF = null;

    // Vacía las listas de archivos en nz-upload
    this.imageFileList = [];
    this.pdfFileList = [];

  }


}
