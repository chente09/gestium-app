import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// NG-Zorro imports
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { RouterModule } from '@angular/router';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzAlertModule } from 'ng-zorro-antd/alert';

// Services
import { RegistersService, Register, AreaOficina } from '../../../services/registers/registers.service';

@Component({
  selector: 'app-user-area-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NzCardModule,
    NzTableModule,
    NzButtonModule,
    NzIconModule,
    NzTagModule,
    NzSelectModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSwitchModule,
    NzDividerModule,
    NzSpinModule,
    NzEmptyModule,
    NzBreadCrumbModule,
    NzStatisticModule,
    NzGridModule,
    NzAvatarModule,
    NzAlertModule
  ],
  templateUrl: './user-area-admin.component.html',
  styleUrls: ['./user-area-admin.component.css']
})
export class UserAreaAdminComponent implements OnInit, OnDestroy {
  // 📊 Datos
  allUsers: Register[] = [];
  filteredUsers: Register[] = [];
  allAreas: AreaOficina[] = [];

  // 🎛️ Estados
  loading = false;
  assigningUser = false;
  processingBulk = false;

  // 🎯 Modales
  showAssignModal = false;
  showBulkModal = false;
  showAreaModal = false;
  selectedUser: Register | null = null;

  // 📝 Formularios
  assignForm: FormGroup;
  bulkForm: FormGroup;
  areaForm: FormGroup;

  // 🔍 Filtros
  selectedAreaFilter = '';
  selectedRoleFilter = '';

  // 📋 Configuración
  get availableAreas(): string[] {
    return this.allAreas
      .filter(area => area.activo)
      .map(area => area.nombre)
      .sort();
  }

  // 📊 Estadísticas
  get totalUsers(): number { return this.allUsers.length; }
  get usersWithArea(): number {
    return this.allUsers.filter(u => u.areaAsignada !== 'sin_asignar').length;
  }
  get usersWithoutArea(): number {
    return this.allUsers.filter(u => u.areaAsignada === 'sin_asignar').length;
  }
  get adminUsers(): number {
    return this.allUsers.filter(u => u.role === 'admin').length;
  }

  private destroy$ = new Subject<void>();

  constructor(
    private registersService: RegistersService,
    private fb: FormBuilder,
    private message: NzMessageService,
    private modal: NzModalService
  ) {
    this.assignForm = this.fb.group({
      area: ['', [Validators.required]],
      role: ['empleado', [Validators.required]]
    });

    this.bulkForm = this.fb.group({
      bulkArea: ['', [Validators.required]],
      bulkRole: ['empleado', [Validators.required]]
    });

    this.areaForm = this.fb.group({
      newArea: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // 📊 Cargar todos los datos
  private loadData(): void {
    this.loading = true;

    // ✅ Cargar usuarios
    this.registersService.getRegisters()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (registers) => {
          this.allUsers = registers;
          this.filterUsers();
          console.log('📊 Usuarios cargados:', this.allUsers.length);
        },
        error: (error) => {
          console.error('Error cargando usuarios:', error);
          this.message.error('Error al cargar los datos de usuarios');
        }
      });

    // ✅ Cargar áreas desde Firestore
    this.registersService.getAreasOficina()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (areas) => {
          this.allAreas = areas;
          this.loading = false;
          console.log('🏢 Áreas cargadas:', this.allAreas.length);
        },
        error: (error) => {
          console.error('Error cargando áreas:', error);
          this.message.error('Error al cargar las áreas');
          this.loading = false;
        }
      });
  }

  // 🔍 Filtrar usuarios
  filterUsers(): void {
    this.filteredUsers = this.allUsers.filter(user => {
      const areaMatch = !this.selectedAreaFilter ||
        user.areaAsignada === this.selectedAreaFilter;

      const roleMatch = !this.selectedRoleFilter ||
        user.role === this.selectedRoleFilter;

      return areaMatch && roleMatch;
    });
  }

  // 🔄 Actualizar datos
  refreshData(): void {
    this.loadData();
    this.message.success('Datos actualizados');
  }

  // 🎯 Asignar área a usuario
  assignArea(user: Register): void {
    this.selectedUser = user;
    this.assignForm.patchValue({
      area: user.areaAsignada === 'sin_asignar' ? '' : user.areaAsignada,
      role: user.role
    });
    this.showAssignModal = true;
  }

  // 💾 Guardar asignación
  async saveAssignment(): Promise<void> {
    if (this.assignForm.invalid || !this.selectedUser) {
      this.message.warning('Debe seleccionar un área y rol');
      return;
    }

    this.assigningUser = true;

    try {
      const { area, role } = this.assignForm.value;

      await this.registersService.assignAreaAndRole(
        this.selectedUser.uid,
        area,
        role
      );

      this.message.success(`Área asignada a ${this.selectedUser.displayName}`);
      this.closeAssignModal();
      this.refreshData();

    } catch (error) {
      console.error('Error asignando área:', error);
      this.message.error('Error al asignar el área');
    } finally {
      this.assigningUser = false;
    }
  }

  // 🗑️ Remover asignación de área
  async removeAreaAssignment(user: Register): Promise<void> {
    try {
      await this.registersService.assignAreaAndRole(
        user.uid,
        'sin_asignar',
        'empleado'
      );

      this.message.success(`Asignación removida para ${user.displayName}`);
      this.refreshData();

    } catch (error) {
      console.error('Error removiendo asignación:', error);
      this.message.error('Error al remover la asignación');
    }
  }

  // 🔄 Toggle estado activo
  async toggleUserStatus(user: Register, active: boolean): Promise<void> {
    try {
      await this.registersService.toggleUserStatus(user.uid, active);
      this.message.success(`Usuario ${active ? 'activado' : 'desactivado'}`);

    } catch (error) {
      console.error('Error cambiando estado:', error);
      this.message.error('Error al cambiar el estado del usuario');
    }
  }

  // 📦 Asignación masiva
  showBulkAssignModal(): void {
    const usersToAssign = this.allUsers.filter(u => u.areaAsignada === 'sin_asignar');

    if (usersToAssign.length === 0) {
      this.message.info('No hay usuarios sin asignar');
      return;
    }

    this.showBulkModal = true;
  }

  async processBulkAssignment(): Promise<void> {
    if (this.bulkForm.invalid) {
      this.message.warning('Debe seleccionar área y rol');
      return;
    }

    const usersToAssign = this.allUsers.filter(u => u.areaAsignada === 'sin_asignar');

    if (usersToAssign.length === 0) {
      this.message.info('No hay usuarios sin asignar');
      return;
    }

    this.processingBulk = true;

    try {
      const { bulkArea, bulkRole } = this.bulkForm.value;

      for (const user of usersToAssign) {
        await this.registersService.assignAreaAndRole(user.uid, bulkArea, bulkRole);
      }

      this.message.success(`${usersToAssign.length} usuarios asignados a ${bulkArea}`);
      this.closeBulkModal();
      this.refreshData();

    } catch (error) {
      console.error('Error en asignación masiva:', error);
      this.message.error('Error en la asignación masiva');
    } finally {
      this.processingBulk = false;
    }
  }

  // 🆕 Agregar nueva área
  openAddAreaModal(): void {
    this.showAreaModal = true;
  }

  async addNewArea(): Promise<void> {
    if (this.areaForm.invalid) {
      this.message.warning('Debe ingresar un nombre de área válido');
      return;
    }

    const newAreaName = this.areaForm.value.newArea.trim();

    // Validar si ya existe localmente (por si acaso)
    if (this.allAreas.some(a => a.nombre.toLowerCase() === newAreaName.toLowerCase())) {
      this.message.warning('Esta área ya existe');
      return;
    }

    try {
      // ✅ Crear en Firestore
      await this.registersService.createArea(newAreaName);

      this.message.success(`Área "${newAreaName}" agregada exitosamente`);
      this.closeAreaModal();
      // No es necesario refreshData(), el Observable lo actualiza automáticamente

    } catch (error: any) {
      console.error('Error creando área:', error);

      if (error.message?.includes('Ya existe')) {
        this.message.error('Ya existe un área con este nombre');
      } else {
        this.message.error('Error al crear el área');
      }
    }
  }

  removeArea(areaName: string): void {
    // Buscar el área por nombre
    const area = this.allAreas.find(a => a.nombre === areaName);

    if (!area || !area.id) {
      this.message.error('Área no encontrada');
      return;
    }

    this.modal.confirm({
      nzTitle: 'Eliminar Área',
      nzContent: `¿Está seguro de eliminar el área "${areaName}"? Los usuarios asignados a esta área quedarán sin asignar.`,
      nzOkText: 'Eliminar',
      nzOkDanger: true,
      nzOnOk: async () => {
        try {
          // ✅ Eliminar permanentemente desde Firestore (incluye reasignación de usuarios)
          await this.registersService.deleteAreaPermanently(area.id!, areaName);

          this.message.success(`Área "${areaName}" eliminada exitosamente`);
          this.refreshData(); // Actualizar usuarios reasignados

        } catch (error) {
          console.error('Error eliminando área:', error);
          this.message.error('Error al eliminar el área');
        }
      }
    });
  }

  // 🛠️ Métodos de utilidad
  trackByUserId(index: number, user: Register): string {
    return user.uid;
  }

  getAreaColor(area: string): string {
    const colors: { [key: string]: string } = {
      'ISSFA': 'blue',
      ' Pichincha': 'green',
      'Bco. Produbanco': 'orange',
      'BNF': 'purple',
      'Inmobiliaria': 'cyan',
      'David': 'magenta',
      'sin_asignar': 'default'
    };
    return colors[area] || 'geekblue';
  }

  getRoleColor(role: string): string {
    const colors: { [key: string]: string } = {
      'admin': 'red',
      'coordinador': 'orange',
      'empleado': 'blue'
    };
    return colors[role] || 'default';
  }

  getStatusText(user: Register): string {
    if (user.areaAsignada === 'sin_asignar') {
      return 'Sin Área';
    }
    return 'Configurado';
  }

  getStatusColor(user: Register): string {
    if (user.areaAsignada === 'sin_asignar') {
      return 'orange';
    }
    return 'green';
  }

  // 🎭 Manejadores de modales
  closeAssignModal(): void {
    this.showAssignModal = false;
    this.selectedUser = null;
    this.assignForm.reset({ role: 'empleado' });
  }

  closeBulkModal(): void {
    this.showBulkModal = false;
    this.bulkForm.reset({ bulkRole: 'empleado' });
  }

  closeAreaModal(): void {
    this.showAreaModal = false;
    this.areaForm.reset();
  }
}