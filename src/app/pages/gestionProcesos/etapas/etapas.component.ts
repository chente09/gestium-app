import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { Subject, takeUntil } from 'rxjs';

import { Proceso, ProcesosService } from '../../../services/procesos/procesos.service';
import { DocumentosComponent } from '../documentos/documentos.component';

interface Etapa {
  nombre: string;
  descripcion: string;
}

@Component({
  selector: 'app-etapas',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzTableModule,
    NzFormModule,
    NzModalModule,
    NzButtonModule,
    NzSpinModule,
    DocumentosComponent
  ],
  templateUrl: './etapas.component.html',
  styleUrls: ['./etapas.component.css']
})
export class EtapasComponent implements OnInit, OnDestroy {
  @Input() proceso!: Proceso;
  
  formEtapa!: FormGroup;
  mostrarModal = false;
  etapaSeleccionada: number | null = null;
  isLoading = false;
  isSubmitting = false;
  
  // Error states
  formSubmitted = false;
  
  // Subject for unsubscribing from observables
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private procesosService: ProcesosService,
    private message: NzMessageService,
    private modal: NzModalService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    // Verify that proceso is properly initialized
    if (!this.proceso) {
      console.error('Proceso input is required');
      this.message.error('Error: No se ha seleccionado un proceso');
    }
  }

  ngOnDestroy(): void {
    // Unsubscribe from all observables
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.formEtapa = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      descripcion: ['', [Validators.required, Validators.maxLength(500)]]
    });
  }

  // Open modal with clean form
  abrirModal(): void {
    this.formEtapa.reset();
    this.formSubmitted = false;
    this.mostrarModal = true;
  }

  // Close modal with confirmation if form is dirty
  cerrarModal(): void {
    if (this.formEtapa.dirty) {
      this.modal.confirm({
        nzTitle: '¿Estás seguro de cerrar sin guardar?',
        nzContent: 'Los cambios no guardados se perderán.',
        nzOkText: 'Sí',
        nzCancelText: 'No',
        nzOnOk: () => {
          this.resetFormAndCloseModal();
        }
      });
    } else {
      this.resetFormAndCloseModal();
    }
  }

  private resetFormAndCloseModal(): void {
    this.formEtapa.reset();
    this.mostrarModal = false;
    this.formSubmitted = false;
  }

  // Guardar una nueva etapa
  async guardarEtapa(): Promise<void> {
    this.formSubmitted = true;
    
    if (this.formEtapa.valid && this.proceso?.id) {
      this.isSubmitting = true;
      
      try {
        const etapa: Etapa = {
          nombre: this.formEtapa.get('nombre')?.value.trim(),
          descripcion: this.formEtapa.get('descripcion')?.value.trim()
        };
        
        await this.procesosService.agregarEtapa(this.proceso.id, etapa);
        this.message.success('Etapa agregada correctamente');
        this.resetFormAndCloseModal();
        this.actualizarEtapas();
      } catch (error) {
        console.error('Error al agregar la etapa:', error);
        this.message.error('No se pudo agregar la etapa. Por favor, intente nuevamente.');
      } finally {
        this.isSubmitting = false;
      }
    } else {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.formEtapa.controls).forEach(key => {
        const control = this.formEtapa.get(key);
        control?.markAsTouched();
      });
      
      this.message.warning('Complete todos los campos requeridos correctamente');
    }
  }

  // Seleccionar una etapa para ver sus documentos
  seleccionarEtapa(index: number): void {
    this.etapaSeleccionada = index;
  }

  // Actualizar la lista de etapas
  private actualizarEtapas(): void {
    if (!this.proceso?.id) {
      this.message.error('Error: No se ha seleccionado un proceso');
      return;
    }
    
    this.isLoading = true;
    
    this.procesosService.getProcesos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (procesos) => {
          const procesoActualizado = procesos.find(p => p.id === this.proceso.id);
          if (procesoActualizado) {
            this.proceso.etapas = procesoActualizado.etapas;
          } else {
            this.message.warning('No se encontró el proceso seleccionado');
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error al actualizar las etapas:', error);
          this.message.error('No se pudieron actualizar las etapas');
          this.isLoading = false;
        }
      });
  }

  // Eliminar una etapa
  eliminarEtapa(index: number): void {
    if (!this.proceso?.id || !this.proceso.etapas || index >= this.proceso.etapas.length) {
      this.message.error('Error: No se puede eliminar la etapa');
      return;
    }
    
    const etapaNombre = this.proceso.etapas[index].nombre;
    
    this.modal.confirm({
      nzTitle: '¿Estás seguro de eliminar esta etapa?',
      nzContent: `Vas a eliminar la etapa "${etapaNombre}". Esta acción no se puede deshacer.`,
      nzOkText: 'Eliminar',
      nzOkDanger: true,
      nzCancelText: 'Cancelar',
      nzOnOk: async () => {
        this.isLoading = true;
        
        try {
          await this.procesosService.eliminarEtapa(this.proceso.id!, index);
          this.message.success('Etapa eliminada correctamente');
          
          // Reset etapaSeleccionada if the deleted etapa was selected
          if (this.etapaSeleccionada === index) {
            this.etapaSeleccionada = null;
          } else if (this.etapaSeleccionada && this.etapaSeleccionada > index) {
            // Adjust the selected index if needed
            this.etapaSeleccionada--;
          }
          
          this.actualizarEtapas();
        } catch (error) {
          console.error('Error al eliminar la etapa:', error);
          this.message.error('No se pudo eliminar la etapa');
          this.isLoading = false;
        }
      }
    });
  }
  
  // Helper for template
  get nombreControl() { return this.formEtapa.get('nombre'); }
  get descripcionControl() { return this.formEtapa.get('descripcion'); }
}