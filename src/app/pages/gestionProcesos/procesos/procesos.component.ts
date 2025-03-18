import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Timestamp } from '@angular/fire/firestore';
import { Subject, takeUntil } from 'rxjs';

// Componentes de NG-Zorro
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzEmptyModule } from 'ng-zorro-antd/empty';

// Componentes y servicios propios
import { EtapasComponent } from '../etapas/etapas.component';
import { ProcesosService, Proceso } from '../../../services/procesos/procesos.service';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-procesos',
  standalone: true,
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzTableModule,
    NzFormModule,
    NzButtonModule,
    NzInputModule,
    NzCardModule,
    NzDividerModule,
    NzSpinModule,
    NzIconModule,
    NzPopconfirmModule,
    NzToolTipModule,
    NzEmptyModule,
    EtapasComponent,
    FormsModule
  ],
  templateUrl: './procesos.component.html',
  styleUrls: ['./procesos.component.css']
})
export class ProcesosComponent implements OnInit, OnDestroy {
  // Variables principales
  procesos: Proceso[] = [];
  procesoSeleccionado: Proceso | null = null;
  formProceso: FormGroup;
  
  // Estados
  isLoading = false;
  isCreating = false;
  isFormVisible = false;
  searchValue = '';
  procesosOriginales: Proceso[] = [];
  
  // Variable para manejar la destrucción del componente
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private procesosService: ProcesosService,
    private messageService: NzMessageService,
    private modalService: NzModalService
  ) {
    this.formProceso = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      descripcion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(200)]]
    });
  }

  ngOnInit(): void {
    this.cargarProcesos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarProcesos(): void {
    this.isLoading = true;
    this.procesosService.getProcesos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (procesos) => {
          this.procesos = procesos.map(proceso => {
            if (proceso.fechaCreacion instanceof Timestamp) {
              proceso.fechaCreacion = proceso.fechaCreacion.toDate();
            }
            return proceso;
          }).sort((a, b) => this.compararFechas(b.fechaCreacion, a.fechaCreacion));
          
          this.procesosOriginales = [...this.procesos];
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error al cargar los procesos:', error);
          this.messageService.error('No se pudieron cargar los procesos');
          this.isLoading = false;
        }
      });
  }

  compararFechas(fecha1: Date | null, fecha2: Date | null): number {
    if (!fecha1 && !fecha2) return 0;
    if (!fecha1) return -1;
    if (!fecha2) return 1;
    return fecha1.getTime() - fecha2.getTime();
  }

  toggleFormulario(): void {
    this.isFormVisible = !this.isFormVisible;
    if (!this.isFormVisible) {
      this.formProceso.reset();
    }
  }

  async crearProceso(): Promise<void> {
    if (this.formProceso.valid) {
      this.isCreating = true;
      const loadingId = this.messageService.loading('Creando proceso...').messageId;
      
      try {
        await this.procesosService.crearProceso(this.formProceso.value);
        this.messageService.remove(loadingId);
        this.messageService.success('Proceso creado correctamente');
        this.formProceso.reset();
        this.isFormVisible = false;
        this.cargarProcesos();
      } catch (error) {
        this.messageService.remove(loadingId);
        console.error('Error al crear el proceso:', error);
        this.messageService.error('No se pudo crear el proceso');
      } finally {
        this.isCreating = false;
      }
    } else {
      Object.values(this.formProceso.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });
    }
  }

  seleccionarProceso(proceso: Proceso): void {
    this.procesoSeleccionado = proceso.id === this.procesoSeleccionado?.id ? null : proceso;
  }

  eliminarProceso(proceso: Proceso): void {
    const loadingId = this.messageService.loading('Eliminando proceso...').messageId;
    
    this.procesosService.eliminarProceso(proceso.id!)
      .then(() => {
        this.messageService.remove(loadingId);
        this.messageService.success('Proceso eliminado correctamente');
        
        // Si el proceso eliminado era el seleccionado, resetear la selección
        if (this.procesoSeleccionado?.id === proceso.id) {
          this.procesoSeleccionado = null;
        }
        
        this.cargarProcesos();
      })
      .catch((error) => {
        this.messageService.remove(loadingId);
        console.error('Error al eliminar el proceso:', error);
        this.messageService.error('No se pudo eliminar el proceso');
      });
  }

  buscarProcesos(value: string): void {
    this.searchValue = value.toLowerCase();
    if (this.searchValue) {
      this.procesos = this.procesosOriginales.filter(
        proceso => 
          proceso.nombre.toLowerCase().includes(this.searchValue) || 
          proceso.descripcion.toLowerCase().includes(this.searchValue)
      );
    } else {
      this.procesos = [...this.procesosOriginales];
    }
  }

  limpiarBusqueda(): void {
    this.searchValue = '';
    this.procesos = [...this.procesosOriginales];
  }

  // Getters para validación de formularios
  get nombreControl() { return this.formProceso.get('nombre'); }
  get descripcionControl() { return this.formProceso.get('descripcion'); }
}