import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd, RouterModule } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { RegistersService } from './services/registers/registers.service';
import { UsersService } from './services/users/users.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    NzIconModule,
    NzLayoutModule,
    NzMenuModule,
    NzDrawerModule,
    NzDropDownModule,
    NzAvatarModule,
    NzToolTipModule,
    NzButtonModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'gestium-sli';
  isCollapsed = false;
  activeRoute = '';
  isDrawerOpen = false;
  currentUserRole: 'admin' | 'coordinador' | 'empleado' | null = null;

  menuItems = [
    { title: 'ISSFA', route: '/area/issfa' },
    { title: 'Bco. Pichincha', route: '/area/pichincha' },
    { title: 'Bco. Produbanco', route: '/area/produbanco' },
    { title: 'Inmobiliaria', route: '/area/inmobiliaria' },
    { title: 'IESS', route: '/area/iess' }
  ];

  constructor(
    private router: Router,
    public registersService: RegistersService,
    private usersService: UsersService
  ) { }

  async ngOnInit(): Promise<void> {
    // Detectar cambios de ruta
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.activeRoute = event.url;
    });

    // ✅ NUEVO: Esperar a que Firebase Auth se inicialice
    console.log('🚀 [App Init] Esperando inicialización de Firebase Auth...');

    // Suscribirse al observable de autenticación
    this.usersService.user$.subscribe(async (user) => {
      console.log('👤 [Auth State Changed] Usuario:', user?.uid, user?.email);

      if (user) {
        await this.loadUserRole();
      } else {
        console.log('⚠️ [Auth State] No hay usuario autenticado');
        this.currentUserRole = null;
        this.registersService.currentRegister = undefined;
      }
    });
  }

  // ✅ Cargar rol del usuario actual desde RegistersService
  private async loadUserRole(): Promise<void> {
    try {
      console.log('🔍 [loadUserRole] Iniciando...');

      const user = this.usersService.getCurrentUser();
      console.log('👤 [loadUserRole] Usuario Firebase:', user?.uid, user?.email);

      if (user) {
        const userRegister = await this.registersService.getRegisterByUid(user.uid);
        console.log('📄 [loadUserRole] Registro obtenido:', userRegister);

        if (userRegister) {
          // ✅ CRÍTICO: Asignar currentRegister si no existe
          if (!this.registersService.currentRegister) {
            this.registersService.currentRegister = userRegister;
            console.log('✅ [loadUserRole] currentRegister reasignado');
          }

          this.currentUserRole = userRegister.role;
          console.log('✅ [loadUserRole] Rol asignado:', this.currentUserRole);
        }
      }
    } catch (error) {
      console.error('❌ [loadUserRole] Error:', error);
      this.currentUserRole = null;
    }
  }

  // ✅ Verificar si el usuario es administrador
  isAdmin(): boolean {
    return this.currentUserRole === 'admin';
  }

  // ✅ Verificar si el usuario es coordinador o admin
  isCoordinatorOrAdmin(): boolean {
    return this.currentUserRole === 'admin' || this.currentUserRole === 'coordinador';
  }

  toggleMenu(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  openDrawer(): void {
    this.isDrawerOpen = true;
  }

  closeDrawer(): void {
    this.isDrawerOpen = false;
  }

  setActive(route: string): void {
    this.activeRoute = route;
  }

  irWelcome(): void {
    this.router.navigate(['/welcome']);
  }

  isLogged(): boolean {
    return !!this.registersService.currentRegister;
  }

  getCurrentUserName(): string | null {
    const currentRegister = this.registersService.getCurrentRegister();
    return currentRegister ? currentRegister.displayName : null;
  }

  async logout(): Promise<void> {
    await this.registersService.logout();
    this.currentUserRole = null;
    this.router.navigate(['/login']);
  }

  isStandaloneRoute(): boolean {
    const currentPath = this.activeRoute.startsWith('/')
      ? this.activeRoute.substring(1)
      : this.activeRoute;

    const standaloneRoutes = ['login', 'consultas', ''];
    return standaloneRoutes.includes(currentPath);
  }

  // ✅ Navegar a administración de usuarios
  goToUserAdmin(): void {
    this.router.navigate(['/admin/users']);
    this.closeDrawer();
  }
}