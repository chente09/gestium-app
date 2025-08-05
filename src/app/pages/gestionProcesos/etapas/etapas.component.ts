import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { Subject, takeUntil } from 'rxjs';

import { Proceso, ProcesosService, Etapa } from '../../../services/procesos/procesos.service';
import { DocumentosComponent } from '../documentos/documentos.component';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';


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
    DocumentosComponent,
    NzIconModule,
    NzToolTipModule,
    NzDividerModule,
    NzDatePickerModule, // Agregar aquí
    NzInputModule
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
  isEditingEtapa = false; // Indica si estamos editando una etapa
  etapaEditandoIndex: number | null = null; // Almacena el índice de la etapa que se está editando

  // Error states
  formSubmitted = false;

  // Subject for unsubscribing from observables
  private destroy$ = new Subject<void>();

  @ViewChild('documentosContainer') documentosContainer!: ElementRef;
  private scrollPending = false;

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
      descripcion: ['', [Validators.required, Validators.maxLength(500)]],
      fechaRegistro: [new Date(), Validators.required], // Cambiar a Date object en lugar de string
    });
  }

  // Open modal with clean form
  // Método para abrir el modal (tanto para agregar como para editar)
  abrirModal(index?: number): void {
    if (index !== undefined) {
      // Modo edición: Cargar los datos de la etapa en el formulario
      this.isEditingEtapa = true;
      this.etapaEditandoIndex = index;
      const etapa = this.proceso.etapas[index];

      // Convertir la fecha si es necesario
      let fechaRegistro = etapa.fechaRegistro;
      if (etapa.fechaRegistro && typeof etapa.fechaRegistro === 'string') {
        fechaRegistro = new Date(etapa.fechaRegistro);
      } else if (etapa.fechaRegistro && typeof etapa.fechaRegistro === 'object' && 'toDate' in etapa.fechaRegistro) {
        fechaRegistro = (etapa.fechaRegistro as any).toDate();
      }

      this.formEtapa.patchValue({
        nombre: etapa.nombre,
        descripcion: etapa.descripcion,
        fechaRegistro: fechaRegistro
      });
    } else {
      // Modo creación: Resetear el formulario
      this.isEditingEtapa = false;
      this.etapaEditandoIndex = null;
      this.formEtapa.reset({
        fechaRegistro: new Date() // Usar Date object
      });
    }

    // Mostrar el modal
    this.mostrarModal = true;
    this.formSubmitted = false;
  }

  // Cerrar el modal y resetear el formulario
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
    this.isEditingEtapa = false;
    this.etapaEditandoIndex = null;
  }

  // Guardar una nueva etapa o actualizar una existente
  async guardarEtapa(): Promise<void> {
    this.formSubmitted = true;

    if (this.formEtapa.valid && this.proceso?.id) {
      this.isSubmitting = true;

      try {
        // Asegurarse de que la fecha sea un objeto Date
        let fechaRegistro = this.formEtapa.get('fechaRegistro')?.value;
        if (fechaRegistro && !(fechaRegistro instanceof Date)) {
          fechaRegistro = new Date(fechaRegistro);
        }

        const etapaData = {
          nombre: this.formEtapa.get('nombre')?.value.trim(),
          descripcion: this.formEtapa.get('descripcion')?.value.trim(),
          fechaRegistro: fechaRegistro
        };

        if (this.isEditingEtapa && this.etapaEditandoIndex !== null) {
          // Modo edición: Actualizar la etapa existente
          await this.procesosService.actualizarEtapa(this.proceso.id, this.etapaEditandoIndex, etapaData);
          this.message.success('Etapa actualizada correctamente');
        } else {
          // Modo creación: Agregar una nueva etapa (el servicio agregará documentos: [])
          await this.procesosService.agregarEtapa(this.proceso.id, etapaData);
          this.message.success('Etapa agregada correctamente');
        }

        this.resetFormAndCloseModal();
        this.actualizarEtapas();
      } catch (error) {
        console.error('Error al guardar la etapa:', error);
        this.message.error('No se pudo guardar la etapa. Por favor, intente nuevamente.');
      } finally {
        this.isSubmitting = false;
      }
    } else {
      Object.keys(this.formEtapa.controls).forEach(key => {
        const control = this.formEtapa.get(key);
        control?.markAsTouched();
      });

      this.message.warning('Complete todos los campos requeridos correctamente');
    }
  }

  // Seleccionar una etapa para ver sus documentos
  seleccionarEtapa(index: number): void {
    this.etapaSeleccionada = this.etapaSeleccionada === index ? null : index;
    this.scrollPending = true; // Indica que se debe hacer scroll después de la actualización
  }

  ngAfterViewChecked(): void {
    if (this.scrollPending && this.etapaSeleccionada !== null && this.documentosContainer) {
      this.documentosContainer.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.scrollPending = false; // Evita scrolls innecesarios
    }
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
  get fechaRegistroControl() { return this.formEtapa.get('fechaRegistro'); }
  formatearFecha(fecha: any): string {
    if (!fecha) return 'Sin fecha';

    let dateObj: Date;

    // Manejar diferentes tipos de fecha
    if (fecha instanceof Date) {
      dateObj = fecha;
    } else if (typeof fecha === 'string') {
      dateObj = new Date(fecha);
    } else if (fecha && typeof fecha === 'object' && 'toDate' in fecha) {
      dateObj = fecha.toDate();
    } else {
      return 'Fecha inválida';
    }

    // Formatear la fecha como dd/MM/yyyy
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();

    return `${day}/${month}/${year}`;
  }
}