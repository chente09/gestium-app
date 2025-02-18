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
    NzIconModule
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
  areas: string[] = ['ISSFA', 'Bco. Pichincha', 'Bco. Produbanco', 'BNF', 'Inmobiliaria', 'David', 'Otro'];
  selectedFileType: string | null = null;

  constructor(
    private fb: FormBuilder, 
    private itinerarioService: ItinerarioService,
    private message: NzMessageService
  ) { }

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
      fileType: [null]
    });

    this.selectedArea = this.areas[0];
  }
  onAreaChange(area: string): void {
    this.selectedArea = area;
    this.itinerarioForm.patchValue({ area });
  }


  // 🌟 Manejar selección de imagen o PDF
  onFileSelected(event: any, type: 'image' | 'pdf'): void {
    const file: File = event.target.files[0];

    if (!file) return;

    if (type === 'image') {
      if (!file.type.startsWith('image/')) {
        console.warn('Solo se permiten archivos de imagen.');
        event.target.value = '';
        return;
      }
      this.selectedImage = file;
    } else if (type === 'pdf') {
      if (file.type !== 'application/pdf') {
        console.warn('Solo se permiten archivos PDF.');
        event.target.value = '';
        return;
      }
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
      if (!formData.tramite.trim() || !formData.fechaTermino.trim()) {
        this.message.error('Los campos obligatorios no pueden estar vacíos.');
        this.isLoading = false;
        return;
      }
  
      await this.itinerarioService.addItinerario(
        formData, 
        this.selectedImage ?? undefined, 
        this.selectedPDF ?? undefined
      );
  
      this.message.success('Itinerario guardado correctamente 🎉');
  
      // Reiniciar formulario
      this.itinerarioForm.reset({
        fechaSolicitud: new Date().toISOString().split('T')[0], // Mantiene la fecha actual por defecto
        area: this.areas[0]
      });
  
      this.selectedImage = null;
      this.selectedPDF = null;
      this.selectedArea = this.areas[0];
  
      this.clearFileInputs();
    } catch (error) {
      console.error('Error al guardar el itinerario:', error);
      this.message.error('Hubo un error al guardar el itinerario. Intente de nuevo.');
    }
  
    this.isLoading = false;
  }  

  // 🌟 Método para limpiar los inputs de archivo
  clearFileInputs(): void {
    const fileInputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fileInputs.forEach(input => (input.value = ''));
  }

  onFileSelectedAtach(event: Event, fileType: string) {
    const inputElement = event.target as HTMLInputElement; // Aseguramos que es un input
    
    if (!inputElement || !inputElement.files || inputElement.files.length === 0) {
      this.message.warning('No se seleccionó ningún archivo.');
      return;
    }
  
    const file = inputElement.files[0];
  
    // Validar tipo de archivo
    if (fileType === 'image' && !file.type.startsWith('image/')) {
      this.message.error('Debe seleccionar una imagen válida.');
      inputElement.value = ''; // Limpiar el input
      return;
    }
  
    if (fileType === 'pdf' && file.type !== 'application/pdf') {
      this.message.error('Debe seleccionar un archivo PDF válido.');
      inputElement.value = ''; // Limpiar el input
      return;
    }
  
    this.message.success(`Archivo seleccionado: ${file.name}`);
  }
  
}
