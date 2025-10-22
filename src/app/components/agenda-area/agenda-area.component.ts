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
import { NzBadgeModule } from 'ng-zorro-antd/badge';

import { AreaActivitiesService, AreaActivity } from '../../services/areaActivities/area-activities.service';
import { RegistersService, Register } from '../../services/registers/registers.service';
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
    NzSpinModule,
    NzBadgeModule
  ],
  templateUrl: './agenda-area.component.html',
  styleUrls: ['./agenda-area.component.css']
})
export class AgendaAreaComponent implements OnInit, OnDestroy {
  @Input() area!: string;

  // 📅 Tipo de vista
  viewMode: 'daily' | 'weekly' | 'monthly' = 'weekly';
  selectedDate: Date = new Date(); // Para vista diaria

  // 📅 Datos de la semana
  currentWeek: Date[] = [];
  weekActivities: { [key: string]: AreaActivity[] } = {};

  // 🗓️ Datos del mes (para vista mensual)
  currentMonth: Date[][] = []; // Matriz de semanas del mes
  monthActivities: { [key: string]: AreaActivity[] } = {};
  currentMonthDate: Date = new Date(); // Fecha del mes que se está mostrando

  // 🎯 Estado del componente
  isLoading = false;
  showCreateModal = false;
  showEditModal = false;
  selectedActivity: AreaActivity | null = null;
  areaUsers: Register[] = [];

  // 📝 Formularios
  createForm: FormGroup;
  editForm: FormGroup;

  // 🗓️ Navegación de semanas
  currentWeekStart: Date = new Date();

  private destroy$ = new Subject<void>();

  constructor(
    private areaActivitiesService: AreaActivitiesService,
    private registersService: RegistersService,
    private messageService: NzMessageService,
    private fb: FormBuilder
  ) {
    this.createForm = this.fb.group({
      titulo: ['', [Validators.required, Validators.maxLength(100)]],
      descripcion: ['', Validators.maxLength(500)],
      fechaLimite: [new Date(), Validators.required],
      prioridad: ['media', Validators.required],
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
    this.loadAreaUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // 👥 Cargar usuarios del área
  private async loadAreaUsers(): Promise<void> {
    try {
      const normalizedArea = this.normalizeAreaName(this.area);
      this.areaUsers = await this.registersService.getUsersByArea(normalizedArea);
    } catch (error) {
      this.areaUsers = [];
    }
  }

  // ✅ Normalizar nombre de área
  private normalizeAreaName(areaId: string): string {
    const areaMapping: { [key: string]: string } = {
      'issfa': 'ISSFA',
      'produbanco': 'Bco. Produbanco',
      'pichincha': 'Bco. Pichincha',
      'inmobiliaria': 'Inmobiliaria',
      'bnf': 'BNF',
      'david': 'David',
      'iess': 'IESS'
    };
    return areaMapping[areaId.toLowerCase()] || areaId;
  }

  // ✅ Getter para dropdown de usuarios
  get availableUsers(): { uid: string; nombre: string }[] {
    return this.areaUsers.map(user => ({
      uid: user.uid,
      nombre: user.displayName || user.nickname || user.email
    }));
  }

  // 📅 Inicializar semana actual (SOLO DÍAS LABORABLES)
  private initializeWeek(): void {
    // Calcular el lunes de la semana basado en currentWeekStart
    const monday = new Date(this.currentWeekStart);
    const dayOfWeek = monday.getDay();
    
    // Ajustar a lunes si no lo es
    const daysFromMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(monday.getDate() + daysFromMonday);

    // Actualizar currentWeekStart al lunes calculado
    this.currentWeekStart = new Date(monday);
    this.currentWeek = [];

    // Solo agregar días laborables (Lunes a Viernes)
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
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
        let activityDate: Date;

        try {
          if (activity.fechaLimite instanceof Date) {
            activityDate = activity.fechaLimite;
          } else if (activity.fechaLimite?.toDate) {
            activityDate = activity.fechaLimite.toDate();
          } else if (activity.fechaLimite?.seconds) {
            activityDate = new Date(activity.fechaLimite.seconds * 1000);
          } else {
            activityDate = new Date(activity.fechaLimite);
          }

          return this.isSameDay(activityDate, date);

        } catch (error) {
          console.error('Error procesando fecha de actividad:', activity.titulo, error);
          return false;
        }
      }) || [];
    });
  }

  // 📊 Organizar actividades para vista mensual (LA FUNCIÓN QUE FALTA)
  private organizeMonthActivities(activities: AreaActivity[]): void {
    this.monthActivities = {};

    // Generar todas las fechas del mes (de this.currentMonth)
    const allDates: Date[] = [];
    this.currentMonth.forEach(week => {
      week.forEach(day => allDates.push(day));
    });

    allDates.forEach(date => {
      const dateKey = this.getDateKey(date); // Usa la función corregida
      this.monthActivities[dateKey] = activities?.filter(activity => {
        let activityDate: Date;

        try {
          if (activity.fechaLimite instanceof Date) {
            activityDate = activity.fechaLimite;
          } else if (activity.fechaLimite?.toDate) {
            activityDate = activity.fechaLimite.toDate();
          } else if (activity.fechaLimite?.seconds) {
            activityDate = new Date(activity.fechaLimite.seconds * 1000);
          } else {
            activityDate = new Date(activity.fechaLimite);
          }

          // Usar la misma lógica de isSameDay que ya tienes
          return this.isSameDay(activityDate, date);

        } catch (error) {
          console.error('Error procesando fecha de actividad:', activity.titulo, error);
          return false;
        }
      }) || [];
    });
  }

  // 🗓️ Navegación de semanas
  goToPreviousWeek(): void {
    const newStart = new Date(this.currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    this.currentWeekStart = newStart;
    this.initializeWeek();
    this.loadWeekActivities();
  }

  goToNextWeek(): void {
    const newStart = new Date(this.currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    this.currentWeekStart = newStart;
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
    const areaSlug = this.area;

    // Fin de semana = Viernes (índice 4)
    const endOfWeek = new Date(this.currentWeekStart);
    endOfWeek.setDate(this.currentWeekStart.getDate() + 4);
    endOfWeek.setHours(23, 59, 59, 999);

    this.areaActivitiesService.getActivitiesByAreaAndDateRange(
      areaSlug,
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

      // ✅ Obtener el usuario actual logueado
      const currentRegister = this.registersService.getCurrentRegister();
      if (!currentRegister) {
        this.messageService.error('No se pudo obtener el usuario actual');
        return;
      }

      const responsableNombre = currentRegister.displayName || currentRegister.nickname || currentRegister.email;

      await this.areaActivitiesService.createActivity({
        titulo: formValue.titulo,
        descripcion: formValue.descripcion,
        fechaLimite: formValue.fechaLimite,
        prioridad: formValue.prioridad,
        responsable: currentRegister.uid, // ✅ UID del usuario logueado
        responsableNombre: responsableNombre, // ✅ Nombre del usuario logueado
        estado: 'pendiente',
        etiquetas: formValue.etiquetas || []
      });

      this.messageService.success('Actividad creada correctamente');
      this.showCreateModal = false;
      this.createForm.reset({ prioridad: 'media', fechaLimite: new Date() });
      this.loadWeekActivities();
    } catch (error) {
      console.error('Error creating activity:', error);
      this.messageService.error('Error al crear la actividad');
    }
  }

  // ✏️ Editar actividad
  editActivity(activity: AreaActivity): void {
    this.selectedActivity = activity;

    // Convertir Timestamp a Date si es necesario
    let fechaLimite: Date;
    if (activity.fechaLimite?.toDate) {
      fechaLimite = activity.fechaLimite.toDate();
    } else if (activity.fechaLimite?.seconds) {
      fechaLimite = new Date(activity.fechaLimite.seconds * 1000);
    } else {
      fechaLimite = new Date(activity.fechaLimite);
    }

    this.editForm.patchValue({
      titulo: activity.titulo,
      descripcion: activity.descripcion,
      fechaLimite: fechaLimite,
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
      // Reorganizar dentro del mismo día
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Mover a otro día
      const activity = event.previousContainer.data[event.previousIndex];

      // Ajustar la fecha al final del día
      const newDate = new Date(targetDate);
      newDate.setHours(23, 59, 59, 999);

      this.areaActivitiesService.postponeActivity(activity.id!, newDate)
        .then(() => {
          this.messageService.success('Actividad movida correctamente');

          // Actualizar la UI inmediatamente
          transferArrayItem(
            event.previousContainer.data,
            event.container.data,
            event.previousIndex,
            event.currentIndex
          );

          // Recargar para sincronizar con Firestore
          setTimeout(() => this.loadWeekActivities(), 500);
        })
        .catch(error => {
          console.error('Error moviendo actividad:', error);
          this.messageService.error('Error al mover la actividad');
        });
    }
  }

  // 🔗 Obtener lista de IDs conectados para Drag & Drop
  getConnectedLists(): string[] {
    return this.currentWeek.map(date => 'drop-' + this.getDateKey(date));
  }

  // 🛠️ Métodos de utilidad
  getDateKey(date: Date): string {
    // Usar fecha local en lugar de ISO para evitar problemas de zona horaria
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  trackByActivityId(index: number, activity: AreaActivity): string {
    return activity.id || index.toString();
  }

  public trackByDate = (index: number, date: Date): string => {
    return this.getDateKey(date);
  }

  public trackByWeek = (index: number, week: Date[]): string => {
    // Usar la primera fecha de la semana como identificador
    return week.length > 0 ? this.getDateKey(week[0]) : index.toString();
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
    this.createForm.reset({ prioridad: 'media', fechaLimite: new Date() });
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

  // 🔄 MÉTODOS DE CAMBIO DE VISTA
  setViewMode(mode: 'daily' | 'weekly' | 'monthly'): void {
    this.viewMode = mode;

    if (mode === 'daily') {
      this.selectedDate = new Date();
      this.loadDayActivities(this.selectedDate);
    } else if (mode === 'weekly') {
      this.initializeWeek();
      this.loadWeekActivities();
    } else if (mode === 'monthly') {
      this.initializeMonth();
      this.loadMonthActivities();
    }
  }

  // 📅 Inicializar mes
  private initializeMonth(): void {
    const year = this.currentMonthDate.getFullYear();
    const month = this.currentMonthDate.getMonth();

    // Primer día del mes
    const firstDay = new Date(year, month, 1);
    // Último día del mes
    const lastDay = new Date(year, month + 1, 0);

    // Calcular el lunes de la primera semana
    const startDayOfWeek = firstDay.getDay();
    const daysFromMonday = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek;
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() + daysFromMonday);

    this.currentMonth = [];
    let currentDate = new Date(startDate);

    // Generar semanas hasta cubrir todo el mes
    while (currentDate <= lastDay || currentDate.getMonth() === month) {
      const week: Date[] = [];

      // Solo días laborables (Lunes a Viernes)
      for (let i = 0; i < 5; i++) {
        week.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      this.currentMonth.push(week);

      // Saltar el fin de semana
      currentDate.setDate(currentDate.getDate() + 2);

      // Salir si ya pasamos el mes
      if (currentDate.getMonth() !== month && week[week.length - 1].getMonth() !== month) {
        break;
      }
    }
  }

  // 📋 Cargar actividades del mes
  private loadMonthActivities(): void {
    this.isLoading = true;
    const areaSlug = this.area;

    if (this.currentMonth.length === 0) return;

    const startDate = this.currentMonth[0][0]; // Primera fecha del mes
    const lastWeek = this.currentMonth[this.currentMonth.length - 1];
    const endDate = lastWeek[lastWeek.length - 1]; // Última fecha del mes

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    this.areaActivitiesService.getActivitiesByAreaAndDateRange(
      areaSlug,
      startDate,
      end
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (activities) => {
          this.organizeMonthActivities(activities); // ✅ CAMBIADO
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading month activities:', error);
          this.messageService.error('Error al cargar las actividades del mes');
          this.isLoading = false;
        }
      });
  }

  // 📅 Cargar actividades de un día específico
  private loadDayActivities(date: Date): void {
    this.isLoading = true;
    const areaSlug = this.area;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    this.areaActivitiesService.getActivitiesByAreaAndDateRange(
      areaSlug,
      startOfDay,
      endOfDay
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (activities) => {
          this.weekActivities = {};
          const dateKey = this.getDateKey(date);
          this.weekActivities[dateKey] = activities;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading day activities:', error);
          this.messageService.error('Error al cargar las actividades del día');
          this.isLoading = false;
        }
      });
  }

  // 🗓️ Navegación de días (para vista diaria)
  goToPreviousDay(): void {
    const newDate = new Date(this.selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    this.selectedDate = newDate;
    this.loadDayActivities(this.selectedDate);
  }

  goToNextDay(): void {
    const newDate = new Date(this.selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    this.selectedDate = newDate;
    this.loadDayActivities(this.selectedDate);
  }

  goToToday(): void {
    this.selectedDate = new Date();
    this.loadDayActivities(this.selectedDate);
  }

  // 🗓️ Navegación de meses (para vista mensual)
  goToPreviousMonth(): void {
    const newDate = new Date(this.currentMonthDate);
    newDate.setMonth(newDate.getMonth() - 1);
    this.currentMonthDate = newDate;
    this.initializeMonth();
    this.loadMonthActivities();
  }

  goToNextMonth(): void {
    const newDate = new Date(this.currentMonthDate);
    newDate.setMonth(newDate.getMonth() + 1);
    this.currentMonthDate = newDate;
    this.initializeMonth();
    this.loadMonthActivities();
  }

  goToCurrentMonth(): void {
    this.currentMonthDate = new Date();
    this.initializeMonth();
    this.loadMonthActivities();
  }

  // 🛠️ Obtener número de actividades para una fecha (para vista mensual)
  getActivityCount(date: Date): number {
    const dateKey = this.getDateKey(date);
    return this.monthActivities[dateKey]?.length || 0;
  }

  // 🛠️ Verificar si una fecha es del mes actual (para vista mensual)
  isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.currentMonthDate.getMonth() &&
      date.getFullYear() === this.currentMonthDate.getFullYear();
  }

  // 🛠️ Seleccionar un día en vista mensual para ver sus actividades
  selectDayInMonth(date: Date): void {
    this.selectedDate = new Date(date);
    this.viewMode = 'daily';
    this.loadDayActivities(date);
  }
}