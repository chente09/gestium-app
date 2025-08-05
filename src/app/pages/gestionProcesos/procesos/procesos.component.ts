import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Timestamp } from '@angular/fire/firestore';
import { Subject, takeUntil } from 'rxjs';

// Componentes de NG-Zorro
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzMessageService } from 'ng-zorro-antd/message';
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
import { ProcesosService, Proceso, MateriaProceso } from '../../../services/procesos/procesos.service';
import { UsersService } from '../../../services/users/users.service';
import { animate, style, transition, trigger } from '@angular/animations';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { RouterModule } from '@angular/router';
import { SharedDataService } from '../../../services/sharedData/shared-data.service';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';

@Component({
  selector: 'app-procesos',
  standalone: true,
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, height: 0 }),
        animate('200ms ease-out', style({ opacity: 1, height: '*' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, height: 0 }))
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
    FormsModule,
    NzSelectModule,
    NzBreadCrumbModule,
    RouterModule,
    NzDatePickerModule
  ],
  templateUrl: './procesos.component.html',
  styleUrls: ['./procesos.component.css'],
})
export class ProcesosComponent implements OnInit, OnDestroy {
  // Variables principales
  procesos: Proceso[] = [];
  procesoSeleccionado: Proceso | null = null;
  formProceso: FormGroup;
  materias: MateriaProceso[] = [];
  materiaSeleccionada: string = '';

  // Estados
  isLoading = false;
  isCreating = false;
  isFormVisible = false;
  searchValue = '';
  procesosOriginales: Proceso[] = [];

  // Variable para manejar la destrucción del componente
  private destroy$ = new Subject<void>();

  // Referencia al elemento de la vista para hacer scroll
  @ViewChild('etapasContent') etapasContent!: ElementRef;

  isEditing = false; // Indica si estamos editando un proceso
  procesoEditando: Proceso | null = null; //

  constructor(
    private fb: FormBuilder,
    private procesosService: ProcesosService,
    private messageService: NzMessageService,
    private usersService: UsersService,
    private sharedDataService: SharedDataService
  ) {
    this.formProceso = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      descripcion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(200)]],
      cedula: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10)]],
      abogadoId: ['', [Validators.required]],
      materia: ['', [Validators.required]],
      fechaCreacion: [new Date(), [Validators.required]] // Nuevo campo de fecha
    });
  }

  ngOnInit(): void {
    this.materias = this.sharedDataService.getAreas() as MateriaProceso[];
    this.cargarProcesos();
  }

  getCurrentUserName(): string | null {
    const user = this.usersService.getCurrentUser();
    return user ? user.displayName : null;
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

          // Aplicar filtro de materia si ya hay uno seleccionado
          if (this.materiaSeleccionada) {
            this.filtrarPorMateria();
          }
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

  toggleFormulario(proceso?: Proceso): void {
    this.isFormVisible = !this.isFormVisible;

    if (this.isFormVisible) {
      if (proceso) {
        // Modo edición
        this.isEditing = true;
        this.procesoEditando = proceso;

        // Convertir la fecha si viene como Timestamp de Firebase
        let fechaCreacion = proceso.fechaCreacion;
        if (proceso.fechaCreacion && typeof proceso.fechaCreacion === 'object' && 'toDate' in proceso.fechaCreacion) {
          fechaCreacion = (proceso.fechaCreacion as any).toDate();
        }

        this.formProceso.patchValue({
          nombre: proceso.nombre,
          cedula: proceso.cedula,
          descripcion: proceso.descripcion,
          materia: proceso.materia,
          abogadoId: proceso.abogadoId,
          fechaCreacion: fechaCreacion // Agregar la fecha
        });
      } else {
        // Modo creación
        this.isEditing = false;
        this.procesoEditando = null;
        const currentUserName = this.getCurrentUserName();
        if (currentUserName) {
          this.formProceso.patchValue({
            abogadoId: currentUserName,
            fechaCreacion: new Date() // Fecha actual por defecto
          });
          this.formProceso.get('abogadoId')?.updateValueAndValidity();
        }
      }
    } else {
      this.formProceso.reset();
      this.isEditing = false;
      this.procesoEditando = null;
    }
  }

  async crearProceso(): Promise<void> {
    if (this.formProceso.valid) {
      this.isCreating = true;
      const loadingId = this.messageService.loading('Creando proceso...').messageId;

      try {
        const currentUserName = this.getCurrentUserName();
        if (!currentUserName) {
          throw new Error('No hay un usuario autenticado');
        }

        this.formProceso.patchValue({ abogadoId: currentUserName });

        // Crear el proceso
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

  // Método para cargar los datos del proceso en el formulario
  editarProceso(proceso: Proceso): void {
    this.isEditing = true; // Activamos el modo edición
    this.procesoEditando = proceso; // Guardamos el proceso que se está editando
    this.isFormVisible = true; // Mostramos el formulario

    // Cargamos los datos del proceso en el formulario
    this.formProceso.patchValue({
      nombre: proceso.nombre,
      cedula: proceso.cedula,
      descripcion: proceso.descripcion,
      materia: proceso.materia
    });
  }

  // Método para guardar los cambios (tanto para crear como para editar)
  async guardarProceso(): Promise<void> {
    if (this.formProceso.invalid) {
      return;
    }

    const procesoData = this.formProceso.value;

    // Asegurarse de que la fecha sea un objeto Date
    if (procesoData.fechaCreacion) {
      procesoData.fechaCreacion = new Date(procesoData.fechaCreacion);
    }

    if (this.isEditing && this.procesoEditando) {
      // Modo edición
      await this.procesosService.actualizarProceso(this.procesoEditando.id!, procesoData);
      this.messageService.success('Proceso actualizado correctamente');
    } else {
      // Modo creación
      await this.procesosService.crearProceso(procesoData);
      this.messageService.success('Proceso creado correctamente');
    }

    this.formProceso.reset();
    this.isFormVisible = false;
    this.isEditing = false;
    this.procesoEditando = null;

    this.cargarProcesos();
  }


  seleccionarProceso(proceso: Proceso): void {
    this.procesoSeleccionado = this.procesoSeleccionado?.id === proceso.id ? null : proceso;

    // Espera a que Angular actualice la vista antes de hacer scroll
    setTimeout(() => {
      if (this.procesoSeleccionado && this.etapasContent) {
        this.etapasContent.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
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
    if (!value.trim()) {
      // Si la búsqueda está vacía, mostrar todos los procesos originales
      this.aplicarFiltros();
      return;
    }

    const searchTerm = value.toLowerCase().trim();

    this.procesos = this.procesosOriginales.filter(proceso => {
      return proceso.nombre.toLowerCase().includes(searchTerm) ||
        proceso.descripcion.toLowerCase().includes(searchTerm) ||
        proceso.materia.toLowerCase().includes(searchTerm) ||
        proceso.abogadoId.toLowerCase().includes(searchTerm) ||
        proceso.cedula.toLowerCase().includes(searchTerm);
    });
  }

  // Método para filtrar por materia
  filtrarPorMateria(): void {
    this.aplicarFiltros();
  }

  // Método para aplicar ambos filtros (búsqueda y materia)
  aplicarFiltros(): void {
    let resultados = [...this.procesosOriginales];

    // Aplicar filtro de búsqueda si hay texto
    if (this.searchValue) {
      const valorBusqueda = this.searchValue.toLowerCase();
      resultados = resultados.filter(proceso =>
        proceso.nombre?.toLowerCase().includes(valorBusqueda) ||
        proceso.cedula?.toLowerCase().includes(valorBusqueda) ||
        proceso.descripcion?.toLowerCase().includes(valorBusqueda) ||
        proceso.materia?.toLowerCase().includes(valorBusqueda) ||
        proceso.abogadoId?.toLowerCase().includes(valorBusqueda)
      );
    }

    // Aplicar filtro de materia si hay una seleccionada
    if (this.materiaSeleccionada) {
      resultados = resultados.filter(proceso =>
        proceso.materia === this.materiaSeleccionada
      );
    }

    this.procesos = resultados;
  }

  limpiarBusqueda(): void {
    this.searchValue = '';
  }

  // Getters para validación de formularios
  get nombreControl() { return this.formProceso.get('nombre'); }
  get descripcionControl() { return this.formProceso.get('descripcion'); }
}