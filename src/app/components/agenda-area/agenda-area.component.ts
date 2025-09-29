import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  CdkDragDrop, 
  moveItemInArray, 
  transferArrayItem,
  DragDropModule 
} from '@angular/cdk/drag-drop';

// NG-Zorro imports
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { AreaActivitiesService, AreaActivity } from '../../services/areaActivities/area-activities.service';
import { RegistersService } from '../../services/registers/registers.service'; // ✅ CAMBIO
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-agenda-area',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    NzCardModule,
    NzButtonModule,
    NzIconModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzDatePickerModule,
    NzSelectModule,
    NzTagModule,
    NzPopconfirmModule,
    NzToolTipModule,
    NzGridModule,
    NzSpinModule
  ],
  templateUrl: './agenda-area.component.html',
  styleUrls: ['./agenda-area.component.css']
})
export class AgendaAreaComponent implements OnInit, OnDestroy {
  @Input() area!: string;
  
  // 📅 Datos de la semana
  currentWeek: Date[] = [];
  weekActivities: { [key: string]: AreaActivity[] } = {};
  
  // 🎯 Estado del componente
  isLoading = false;
  showCreateModal = false;
  showEditModal = false;
  selectedActivity: AreaActivity | null = null;
  
  // 📝 Formularios
  createForm: FormGroup;
  editForm: FormGroup;
  
  // 🗓️ Navegación de semanas
  currentWeekStart: Date = new Date();
  
  private destroy$ = new Subject<void>();

  constructor(
    private areaActivitiesService: AreaActivitiesService,
    private registersService: RegistersService, // ✅ CAMBIO
    private messageService: NzMessageService,
    private fb: FormBuilder
  ) {
    this.createForm = this.fb.group({
      titulo: ['', [Validators.required, Validators.maxLength(100)]],
      descripcion: ['', Validators.maxLength(500)],
      fechaLimite: [new Date(), Validators.required],
      prioridad: ['media', Validators.required],
      responsable: ['', Validators.required],
      responsableNombre: ['', Validators.required],
      etiquetas: [[]]
    });

    this.editForm = this.fb.group({
      titulo: ['', [Validators.required, Validators.maxLength(100)]],
      descripcion: ['', Validators.maxLength(500)],
      fechaLimite: [new Date(), Validators.required],
      prioridad: ['media', Validators.required],
      estado: ['pendiente', Validators.required],
      notas: ['']
    });
  }

  ngOnInit(): void {
    this.initializeWeek();
    this.loadWeekActivities();
    this.setupActivitySubscription();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // 📅 Inicializar semana actual
  private initializeWeek(): void {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    
    this.currentWeekStart = startOfWeek;
    this.currentWeek = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      this.currentWeek.push(date);
    }
  }

  // 🔄 Suscripción a actividades
  private setupActivitySubscription(): void {
    this.areaActivitiesService.getCurrentWeekActivities()
      .pipe(takeUntil(this.destroy$))
      .subscribe(activities => {
        this.organizeActivitiesByDay(activities);
      });
  }

  // 📊 Organizar actividades por día
  private organizeActivitiesByDay(activities: AreaActivity[]): void {
    this.weekActivities = {};
    
    this.currentWeek.forEach(date => {
      const dateKey = this.getDateKey(date);
      this.weekActivities[dateKey] = activities?.filter(activity => {
        const activityDate = new Date(activity.fechaLimite);
        return this.isSameDay(activityDate, date);
      }) || [];
    });
  }

  // 🗓️ Navegación de semanas
  goToPreviousWeek(): void {
    this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
    this.initializeWeek();
    this.loadWeekActivities();
  }

  goToNextWeek(): void {
    this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
    this.initializeWeek();
    this.loadWeekActivities();
  }

  goToCurrentWeek(): void {
    this.currentWeekStart = new Date();
    this.initializeWeek();
    this.loadWeekActivities();
  }

  // 📋 Cargar actividades de la semana
  private loadWeekActivities(): void {
    this.isLoading = true;
    const endOfWeek = new Date(this.currentWeekStart);
    endOfWeek.setDate(this.currentWeekStart.getDate() + 6);
    
    this.areaActivitiesService.getActivitiesByAreaAndDateRange(
      this.area, 
      this.currentWeekStart, 
      endOfWeek
    ).pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (activities) => {
        this.organizeActivitiesByDay(activities);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading activities:', error);
        this.messageService.error('Error al cargar las actividades');
        this.isLoading = false;
      }
    });
  }

  // ➕ Crear nueva actividad
  async createActivity(): Promise<void> {
    if (this.createForm.invalid) {
      Object.values(this.createForm.controls).forEach(control => {
        control.markAsTouched();
      });
      return;
    }

    try {
      const formValue = this.createForm.value;
      await this.areaActivitiesService.createActivity({
        titulo: formValue.titulo,
        descripcion: formValue.descripcion,
        fechaLimite: formValue.fechaLimite,
        prioridad: formValue.prioridad,
        responsable: formValue.responsable,
        responsableNombre: formValue.responsableNombre,
        estado: 'pendiente',
        etiquetas: formValue.etiquetas || []
      });

      this.messageService.success('Actividad creada correctamente');
      this.showCreateModal = false;
      this.createForm.reset();
      this.loadWeekActivities();
    } catch (error) {
      console.error('Error creating activity:', error);
      this.messageService.error('Error al crear la actividad');
    }
  }

  // ✏️ Editar actividad
  editActivity(activity: AreaActivity): void {
    this.selectedActivity = activity;
    this.editForm.patchValue({
      titulo: activity.titulo,
      descripcion: activity.descripcion,
      fechaLimite: new Date(activity.fechaLimite),
      prioridad: activity.prioridad,
      estado: activity.estado,
      notas: activity.notas || ''
    });
    this.showEditModal = true;
  }

  // 💾 Guardar cambios de edición
  async saveEditActivity(): Promise<void> {
    if (this.editForm.invalid || !this.selectedActivity) return;

    try {
      const formValue = this.editForm.value;
      await this.areaActivitiesService.updateActivity(this.selectedActivity.id!, {
        titulo: formValue.titulo,
        descripcion: formValue.descripcion,
        fechaLimite: formValue.fechaLimite,
        prioridad: formValue.prioridad,
        estado: formValue.estado,
        notas: formValue.notas
      });

      this.messageService.success('Actividad actualizada correctamente');
      this.showEditModal = false;
      this.selectedActivity = null;
      this.loadWeekActivities();
    } catch (error) {
      console.error('Error updating activity:', error);
      this.messageService.error('Error al actualizar la actividad');
    }
  }

  // ✅ Marcar como completada
  async completeActivity(activity: AreaActivity): Promise<void> {
    try {
      await this.areaActivitiesService.completeActivity(activity.id!);
      this.messageService.success('Actividad marcada como completada');
      this.loadWeekActivities();
    } catch (error) {
      console.error('Error completing activity:', error);
      this.messageService.error('Error al completar la actividad');
    }
  }

  // 🗑️ Eliminar actividad
  async deleteActivity(activity: AreaActivity): Promise<void> {
    try {
      await this.areaActivitiesService.deleteActivity(activity.id!);
      this.messageService.success('Actividad eliminada correctamente');
      this.loadWeekActivities();
    } catch (error) {
      console.error('Error deleting activity:', error);
      this.messageService.error('Error al eliminar la actividad');
    }
  }

  // 🎯 Drag & Drop
  onDrop(event: CdkDragDrop<AreaActivity[]>, targetDate: Date): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const activity = event.previousContainer.data[event.previousIndex];
      
      this.areaActivitiesService.postponeActivity(activity.id!, targetDate)
        .then(() => {
          this.messageService.success('Actividad movida correctamente');
          transferArrayItem(
            event.previousContainer.data,
            event.container.data,
            event.previousIndex,
            event.currentIndex
          );
        })
        .catch(error => {
          console.error('Error moving activity:', error);
          this.messageService.error('Error al mover la actividad');
        });
    }
  }

  // 🛠️ Métodos de utilidad
  getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  trackByActivityId(index: number, activity: AreaActivity): string {
    return activity.id || index.toString();
  }

  trackByDate(index: number, date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  getDayName(date: Date): string {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[date.getDay()];
  }

  getActivityStatusColor(status: AreaActivity['estado']): string {
    const colors = {
      'pendiente': 'orange',
      'en_progreso': 'blue',
      'completada': 'green',
      'pospuesta': 'red'
    };
    return colors[status] || 'default';
  }

  getPriorityColor(priority: AreaActivity['prioridad']): string {
    const colors = {
      'baja': 'green',
      'media': 'orange',
      'alta': 'red'
    };
    return colors[priority] || 'default';
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return this.isSameDay(date, today);
  }

  // 🎭 Manejadores de modales
  openCreateModal(): void {
    this.showCreateModal = true;
    this.createForm.reset();
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.createForm.reset();
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedActivity = null;
    this.editForm.reset();
  }
}