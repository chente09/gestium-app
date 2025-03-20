import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProcesosService, Proceso } from '../../services/procesos/procesos.service';
import { of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { NzMessageService } from 'ng-zorro-antd/message';
import { CommonModule } from '@angular/common';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { ChangeDetectorRef } from '@angular/core';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { RouterModule } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';


@Component({
  selector: 'app-consultas',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzCardModule,
    NzFormModule,
    NzTableModule,
    NzSelectModule,
    NzCollapseModule,
    NzDividerModule,
    NzEmptyModule,
    NzListModule,
    NzDescriptionsModule,
    NzBreadCrumbModule,
    RouterModule,
    NzIconModule
  ],
  templateUrl: './consultas.component.html',
  styleUrl: './consultas.component.css'
})
export class ConsultasComponent implements OnInit {
  formBusqueda: FormGroup;
  procesos: Proceso[] = [];
  procesoSeleccionado: Proceso | null = null;

  tiposBusqueda = [
    { label: 'Cédula', value: 'cedula' },
    { label: 'Nombre', value: 'nombre' },
    { label: 'Materia', value: 'materia' }
  ];
  materiasDisponibles = [
    'ISSFA', 'Inmobiliario', 'Produbanco', 'Civil', 'Laboral', 'Tributario', 'Otros'
  ];
  constructor(
    private fb: FormBuilder,
    private procesosService: ProcesosService,
    private messageService: NzMessageService,
    private cdr: ChangeDetectorRef
  ) {
    this.formBusqueda = this.fb.group({
      tipoBusqueda: ['cedula', Validators.required],
      valorBusqueda: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // Observar cambios en el tipo de búsqueda para ajustar validaciones
    this.formBusqueda.get('tipoBusqueda')?.valueChanges.subscribe(valor => {
      const valorBusqueda = this.formBusqueda.get('valorBusqueda');
      valorBusqueda?.clearValidators();

      if (valor === 'cedula') {
        valorBusqueda?.setValidators([
          Validators.required,
          Validators.pattern('^[0-9]{10}$') // Formato cédula Ecuador
        ]);
      } else {
        valorBusqueda?.setValidators(Validators.required);
      }

      valorBusqueda?.updateValueAndValidity();
    });
  }


  buscarProcesos(): void {
    if (this.formBusqueda.invalid) {
      Object.values(this.formBusqueda.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });
      return;
    }

    const tipoBusqueda = this.formBusqueda.get('tipoBusqueda')?.value;
    const valorBusqueda = this.formBusqueda.get('valorBusqueda')?.value;

    const loadingId = this.messageService.loading('Buscando procesos...').messageId;

    this.procesosService.getProcesos().pipe(
      switchMap(procesos => {
        let resultados: Proceso[] = [];

        switch (tipoBusqueda) {
          case 'cedula':
            resultados = procesos.filter(p => p.cedula.toLowerCase() === valorBusqueda.toLowerCase());
            break;
          case 'nombre':
            resultados = procesos.filter(p => p.nombre.toLowerCase().includes(valorBusqueda.toLowerCase()));
            break;
          case 'materia':
            resultados = procesos.filter(p => p.materia.toLowerCase() === valorBusqueda.toLowerCase());
            break;
        }

        // Retornar un observable siempre para asegurar que finalize() se ejecute
        return of(resultados);
      }),
      catchError(error => {
        console.error('Error al buscar procesos:', error);
        this.messageService.error('Error al buscar procesos');
        return of([]); // Retorna un observable vacío para evitar que finalize se detenga
      }),
      finalize(() => {
        console.log("Finalizando búsqueda, desactivando isLoading");

        this.messageService.remove(loadingId);
        this.cdr.detectChanges();
      })
    ).subscribe(resultados => {
      this.procesos = resultados;
      if (resultados.length === 0) {
        this.messageService.info('No se encontraron procesos con los criterios de búsqueda');
      } else {
        this.messageService.success(`Se encontraron ${resultados.length} procesos`);
      }
    });
  }


  verDetalleProceso(proceso: Proceso): void {
    this.procesoSeleccionado = proceso;
  }

  cerrarDetalle(): void {
    this.procesoSeleccionado = null;
  }

  obtenerFechaFormateada(fecha: any): string {
    if (!fecha) return 'N/A';
    const fechaObj = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return fechaObj.toLocaleDateString('es-ES');
  }

  limpiarBusqueda(): void {
    this.formBusqueda.reset({
      tipoBusqueda: 'cedula',
      valorBusqueda: ''
    });
    this.procesos = [];
    this.procesoSeleccionado = null;
  }
}