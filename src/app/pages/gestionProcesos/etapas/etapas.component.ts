import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select'; // Agregar este import
import { Subject, takeUntil } from 'rxjs';

import { Proceso, ProcesosService, Etapa } from '../../../services/procesos/procesos.service';
import { DocumentosComponent } from '../documentos/documentos.component';

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
    NzDatePickerModule,
    NzInputModule,
    NzSelectModule // Agregar aquí
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
  isEditingEtapa = false;
  etapaEditandoIndex: number | null = null;
  formSubmitted = false;
  
  // Agregar estas propiedades
  mostrarInputPersonalizado = false;
  etapasPredefinidas: string[] = [
    'PAGO DE HONORARIOS',
    'ELABORACIÓN MATRIZ',
    'FACTRURACIÓN NOTARÍA',
    'REVISIÓN DE MATRIZ',
    'INGRESO A ISSFA',
    'RETIRO DE ISSFA',
    'INGRESO A NOTARIA PARA CIERRE',
    'RETIRO DE ESCRITURA',
    'INSCRIPCIÓN REGISTRO DE LA PROPIEDAD',
    'RETIRO DE REGISTRO DE LA PROPIEDAD',
    'FINALIZADO',
    'Otra' // Opción para personalizar
  ];

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
    if (!this.proceso) {
      console.error('Proceso input is required');
      this.message.error('Error: No se ha seleccionado un proceso');
    }
    
    // Suscribirse a los cambios del selector de etapa
    this.formEtapa.get('nombreSelector')?.valueChanges.subscribe(value => {
      if (value === 'Otra') {
        this.mostrarInputPersonalizado = true;
        this.formEtapa.get('nombre')?.setValidators([Validators.required, Validators.maxLength(100)]);
        this.formEtapa.get('nombre')?.enable();
      } else {
        this.mostrarInputPersonalizado = false;
        this.formEtapa.get('nombre')?.setValue(value);
        this.formEtapa.get('nombre')?.clearValidators();
        this.formEtapa.get('nombre')?.disable();
      }
      this.formEtapa.get('nombre')?.updateValueAndValidity();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.formEtapa = this.fb.group({
      nombreSelector: ['', [Validators.required]], // Selector de etapa
      nombre: [{value: '', disabled: true}], // Campo de texto personalizado
      descripcion: ['', [Validators.maxLength(500)]],
      fechaRegistro: [new Date(), Validators.required],
    });
  }

  abrirModal(index?: number): void {
    if (index !== undefined) {
      // Modo edición
      this.isEditingEtapa = true;
      this.etapaEditandoIndex = index;
      const etapa = this.proceso.etapas[index];
      
      let fechaRegistro = etapa.fechaRegistro;
      if (etapa.fechaRegistro && typeof etapa.fechaRegistro === 'string') {
        fechaRegistro = new Date(etapa.fechaRegistro);
      } else if (etapa.fechaRegistro && typeof etapa.fechaRegistro === 'object' && 'toDate' in etapa.fechaRegistro) {
        fechaRegistro = (etapa.fechaRegistro as any).toDate();
      }
      
      // Verificar si el nombre está en las opciones predefinidas
      const nombreEnOpciones = this.etapasPredefinidas.includes(etapa.nombre);
      
      if (nombreEnOpciones) {
        this.formEtapa.patchValue({
          nombreSelector: etapa.nombre,
          nombre: etapa.nombre,
          descripcion: etapa.descripcion,
          fechaRegistro: fechaRegistro
        });
        this.mostrarInputPersonalizado = false;
        this.formEtapa.get('nombre')?.disable();
      } else {
        // Es un nombre personalizado
        this.formEtapa.patchValue({
          nombreSelector: 'Otra',
          nombre: etapa.nombre,
          descripcion: etapa.descripcion,
          fechaRegistro: fechaRegistro
        });
        this.mostrarInputPersonalizado = true;
        this.formEtapa.get('nombre')?.enable();
      }
    } else {
      // Modo creación
      this.isEditingEtapa = false;
      this.etapaEditandoIndex = null;
      this.mostrarInputPersonalizado = false;
      this.formEtapa.reset({
        nombreSelector: '',
        nombre: '',
        fechaRegistro: new Date()
      });
      this.formEtapa.get('nombre')?.disable();
    }

    this.mostrarModal = true;
    this.formSubmitted = false;
  }

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
    this.mostrarInputPersonalizado = false;
  }

  async guardarEtapa(): Promise<void> {
    this.formSubmitted = true;

    // Validar el formulario
    if (this.mostrarInputPersonalizado && !this.formEtapa.get('nombre')?.value?.trim()) {
      this.message.warning('Por favor, ingrese el nombre de la etapa personalizada');
      return;
    }

    if (this.formEtapa.get('nombreSelector')?.valid && this.proceso?.id) {
      this.isSubmitting = true;

      try {
        let fechaRegistro = this.formEtapa.get('fechaRegistro')?.value;
        if (fechaRegistro && !(fechaRegistro instanceof Date)) {
          fechaRegistro = new Date(fechaRegistro);
        }

        // Obtener el nombre correcto (del selector o del campo personalizado)
        let nombreEtapa = '';
        if (this.mostrarInputPersonalizado) {
          nombreEtapa = this.formEtapa.get('nombre')?.value?.trim();
        } else {
          nombreEtapa = this.formEtapa.get('nombreSelector')?.value;
        }

        const etapaData = {
          nombre: nombreEtapa,
          descripcion: this.formEtapa.get('descripcion')?.value?.trim() || '',
          fechaRegistro: fechaRegistro
        };

        if (this.isEditingEtapa && this.etapaEditandoIndex !== null) {
          await this.procesosService.actualizarEtapa(this.proceso.id, this.etapaEditandoIndex, etapaData);
          this.message.success('Etapa actualizada correctamente');
        } else {
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

  // Resto de los métodos permanecen igual...
  seleccionarEtapa(index: number): void {
    this.etapaSeleccionada = this.etapaSeleccionada === index ? null : index;
    this.scrollPending = true;
  }

  ngAfterViewChecked(): void {
    if (this.scrollPending && this.etapaSeleccionada !== null && this.documentosContainer) {
      this.documentosContainer.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.scrollPending = false;
    }
  }

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

          if (this.etapaSeleccionada === index) {
            this.etapaSeleccionada = null;
          } else if (this.etapaSeleccionada && this.etapaSeleccionada > index) {
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

  formatearFecha(fecha: any): string {
    if (!fecha) return 'Sin fecha';
    
    let dateObj: Date;
    
    if (fecha instanceof Date) {
      dateObj = fecha;
    } else if (typeof fecha === 'string') {
      dateObj = new Date(fecha);
    } else if (fecha && typeof fecha === 'object' && 'toDate' in fecha) {
      dateObj = fecha.toDate();
    } else {
      return 'Fecha inválida';
    }
    
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    
    return `${day}/${month}/${year}`;
  }

  get nombreControl() { return this.formEtapa.get('nombre'); }
  get descripcionControl() { return this.formEtapa.get('descripcion'); }
  get fechaRegistroControl() { return this.formEtapa.get('fechaRegistro'); }
}