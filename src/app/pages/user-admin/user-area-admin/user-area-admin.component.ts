import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, combineLatest } from 'rxjs';

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

// Services
import { UserAreaService, UserArea } from '../../../services/userArea/user-area.service';
import { RegistersService, Register } from '../../../services/registers/registers.service'; 
import { UsersService } from '../../../services/users/users.service';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';

interface UserDisplay {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  areaAsignada?: string;
  role?: 'admin' | 'coordinador' | 'empleado';
  fechaAsignacion?: Date;
  activo?: boolean;
  isRegistered: boolean; // Si está en el sistema de registros
  hasAreaAssigned: boolean; // Si tiene área asignada
}

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
    NzAvatarModule
  ],
  templateUrl: './user-area-admin.component.html',
  styleUrls: ['./user-area-admin.component.css']
})
export class UserAreaAdminComponent implements OnInit, OnDestroy {
  // 📊 Datos
  allUsers: UserDisplay[] = [];
  filteredUsers: UserDisplay[] = [];
  registers: Register[] = [];
  userAreas: UserArea[] = [];
  
  // 🎛️ Estados
  loading = false;
  assigningUser = false;
  processingBulk = false;
  
  // 🎯 Modales
  showAssignModal = false;
  showBulkModal = false;
  selectedUser: UserDisplay | null = null;
  
  // 📝 Formularios
  assignForm: FormGroup;
  bulkForm: FormGroup;
  
  // 🔍 Filtros
  selectedAreaFilter = '';
  selectedRoleFilter = '';
  
  // 📋 Configuración
  availableAreas = ['ISSFA', 'Bco. Pichincha', 'Bco. Produbanco', 'BNF', 'Inmobiliaria', 'David'];
  
  // 📊 Estadísticas
  get totalUsers(): number { return this.allUsers.length; }
  get usersWithArea(): number { return this.allUsers.filter(u => u.hasAreaAssigned).length; }
  get usersWithoutArea(): number { return this.allUsers.filter(u => !u.hasAreaAssigned).length; }
  get adminUsers(): number { return this.allUsers.filter(u => u.role === 'admin').length; }
  
  private destroy$ = new Subject<void>();

  constructor(
    private userAreaService: UserAreaService,
    private registersService: RegistersService,
    private usersService: UsersService,
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
    
    combineLatest([
      this.registersService.getRegisters(),
      this.userAreaService.getAllUsersAreas()
    ]).pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ([registers, userAreas]) => {
        this.registers = registers;
        this.userAreas = userAreas;
        this.combineUserData();
        this.filterUsers();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando datos:', error);
        this.message.error('Error al cargar los datos de usuarios');
        this.loading = false;
      }
    });
  }

  // 🔄 Combinar datos de registros y áreas
  private combineUserData(): void {
    this.allUsers = this.registers.map(register => {
      const userArea = this.userAreas.find(ua => ua.uid === register.uid);
      
      return {
        uid: register.uid,
        email: register.email,
        displayName: register.nickname || register.email,
        photoURL: register.photoURL,
        areaAsignada: userArea?.areaAsignada,
        role: userArea?.role,
        fechaAsignacion: userArea?.fechaAsignacion,
        activo: userArea?.activo,
        isRegistered: true,
        hasAreaAssigned: !!userArea
      } as UserDisplay;
    });
    
    // ✅ NUEVO: Log para debugging
    console.log('📊 Datos combinados:', {
      registers: this.registers.length,
      userAreas: this.userAreas.length,
      allUsers: this.allUsers.length
    });
    
    // ✅ NUEVO: Mostrar información detallada en consola
    if (this.allUsers.length === 0) {
      console.log('⚠️ No se encontraron usuarios. Verifica:');
      console.log('1. Que los usuarios estén autenticados');
      console.log('2. Que el auto-registro esté funcionando');
      console.log('3. Que la colección "registers" tenga datos');
    }
  }

  // 🔍 Filtrar usuarios
  filterUsers(): void {
    this.filteredUsers = this.allUsers.filter(user => {
      const areaMatch = !this.selectedAreaFilter || 
        (this.selectedAreaFilter === 'sin_asignar' ? !user.hasAreaAssigned : user.areaAsignada === this.selectedAreaFilter);
      
      const roleMatch = !this.selectedRoleFilter || user.role === this.selectedRoleFilter;
      
      return areaMatch && roleMatch;
    });
  }

  // 🔄 Actualizar datos
  refreshData(): void {
    this.loadData();
    this.message.success('Datos actualizados');
  }

  // 👤 Inicializar un usuario específico
  async initializeUser(user: UserDisplay): Promise<void> {
    try {
      await this.userAreaService.assignUserToArea(user.uid, 'sin_asignar', 'empleado');
      this.message.success(`Usuario ${user.displayName} inicializado`);
      this.refreshData();
    } catch (error) {
      console.error('Error inicializando usuario:', error);
      this.message.error('Error al inicializar el usuario');
    }
  }

  // 👥 Inicializar todos los usuarios sin área
  async initializeAllUsers(): Promise<void> {
    const usersToInitialize = this.allUsers.filter(u => !u.hasAreaAssigned);
    
    if (usersToInitialize.length === 0) {
      this.message.info('Todos los usuarios ya están inicializados');
      return;
    }

    this.modal.confirm({
      nzTitle: 'Inicializar Usuarios',
      nzContent: `¿Inicializar ${usersToInitialize.length} usuarios sin área asignada?`,
      nzOnOk: async () => {
        this.loading = true;
        try {
          for (const user of usersToInitialize) {
            await this.userAreaService.assignUserToArea(user.uid, 'sin_asignar', 'empleado');
          }
          this.message.success(`${usersToInitialize.length} usuarios inicializados`);
          this.refreshData();
        } catch (error) {
          console.error('Error en inicialización masiva:', error);
          this.message.error('Error en la inicialización masiva');
        } finally {
          this.loading = false;
        }
      }
    });
  }

  // 🎯 Asignar área a usuario
  assignArea(user: UserDisplay): void {
    this.selectedUser = user;
    this.assignForm.patchValue({
      area: user.areaAsignada || '',
      role: user.role || 'empleado'
    });
    this.showAssignModal = true;
  }

  // 💾 Guardar asignación
  async saveAssignment(): Promise<void> {
    if (this.assignForm.invalid || !this.selectedUser) return;

    this.assigningUser = true;
    try {
      const { area, role } = this.assignForm.value;
      await this.userAreaService.assignUserToArea(this.selectedUser.uid, area, role);
      
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
  async removeAreaAssignment(user: UserDisplay): Promise<void> {
    try {
      await this.userAreaService.assignUserToArea(user.uid, 'sin_asignar', 'empleado');
      this.message.success(`Asignación removida para ${user.displayName}`);
      this.refreshData();
    } catch (error) {
      console.error('Error removiendo asignación:', error);
      this.message.error('Error al remover la asignación');
    }
  }

  // 🔄 Toggle estado activo
  async toggleUserStatus(user: UserDisplay, active: boolean): Promise<void> {
    try {
      await this.userAreaService.toggleUserStatus(user.uid, active);
      this.message.success(`Usuario ${active ? 'activado' : 'desactivado'}`);
      this.refreshData();
    } catch (error) {
      console.error('Error cambiando estado:', error);
      this.message.error('Error al cambiar el estado del usuario');
    }
  }

  // 📦 Asignación masiva
  showBulkAssignModal(): void {
    this.showBulkModal = true;
  }

  async processBulkAssignment(): Promise<void> {
    if (this.bulkForm.invalid) return;

    const usersToAssign = this.allUsers.filter(u => !u.hasAreaAssigned);
    if (usersToAssign.length === 0) {
      this.message.info('No hay usuarios sin asignar');
      return;
    }

    this.processingBulk = true;
    try {
      const { bulkArea, bulkRole } = this.bulkForm.value;
      
      for (const user of usersToAssign) {
        await this.userAreaService.assignUserToArea(user.uid, bulkArea, bulkRole);
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

  // 🛠️ Métodos de utilidad
  trackByUserId(index: number, user: UserDisplay): string {
    return user.uid;
  }

  getAreaColor(area: string): string {
    const colors: {[key: string]: string} = {
      'ISSFA': 'blue',
      'Bco. Pichincha': 'green', 
      'Bco. Produbanco': 'orange',
      'BNF': 'purple',
      'Inmobiliaria': 'cyan',
      'David': 'magenta',
      'sin_asignar': 'default'
    };
    return colors[area] || 'default';
  }

  getRoleColor(role: string): string {
    const colors: {[key: string]: string} = {
      'admin': 'red',
      'coordinador': 'orange',
      'empleado': 'blue'
    };
    return colors[role] || 'default';
  }

  // 🎭 Manejadores de modales
  closeAssignModal(): void {
    this.showAssignModal = false;
    this.selectedUser = null;
    this.assignForm.reset();
  }

  closeBulkModal(): void {
    this.showBulkModal = false;
    this.bulkForm.reset();
  }
}