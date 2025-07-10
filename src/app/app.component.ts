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
import { UserAreaService } from './services/userArea/user-area.service'; // ✅ NUEVA IMPORTACIÓN
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
  currentUserRole: string | null = null; // ✅ NUEVA PROPIEDAD

  // ✅ ACTUALIZADO: Menu items básicos
  menuItems = [
    { title: 'ISSFA', route: '/area/issfa' },
    { title: 'Bco. Pichincha', route: '/area/pichincha' },
    { title: 'Bco. Produbanco', route: '/area/produbanco' },
    { title: 'BNF', route: '/area/bnf' },
    { title: 'Inmobiliaria', route: '/area/inmobiliaria' },
    { title: 'David', route: '/area/david' }
  ];

  constructor(
    private router: Router,
    public registersService: RegistersService,
    private usersService: UsersService,
    private userAreaService: UserAreaService // ✅ NUEVA INYECCIÓN
  ) {}

  async ngOnInit(): Promise<void> {
    // Tu código existente para detectar cambios de ruta...
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.activeRoute = event.url;
    });

    // ✅ Disparar la inicialización completa
    await this.initializeUserIfNeeded();
    
    // Cargar el rol después de la inicialización
    await this.loadUserRole();
  }

  // ✅ NUEVO: Cargar rol del usuario actual
  private async loadUserRole(): Promise<void> {
    try {
      const user = this.usersService.getCurrentUser();
      if (user) {
        const userInfo = await this.userAreaService.getUserAreaInfo(user.uid);
        this.currentUserRole = userInfo?.role || null;
        console.log('🔑 Rol del usuario:', this.currentUserRole);
      }
    } catch (error) {
      console.error('Error cargando rol del usuario:', error);
    }
  }

  // ✅ NUEVO: Inicializar usuario si es necesario
  private async initializeUserIfNeeded(): Promise<void> {
    const firebaseUser = this.usersService.getCurrentUser();
    if (!firebaseUser) {
      console.log("No hay usuario autenticado, omitiendo inicialización.");
      return;
    }

    try {
      console.log(`🚀 Inicializando para el usuario: ${firebaseUser.uid}`);
      
      // 1. Asegurar que el usuario existe en la colección 'registers'
      await this.registersService.ensureUserIsRegistered(firebaseUser);
      console.log("✅ Paso 1/2: Usuario asegurado en 'registers'.");

      // 2. Asegurar que el usuario tiene un área asignada (o 'sin_asignar')
      await this.userAreaService.initializeUserIfNotExists();
      console.log("✅ Paso 2/2: Usuario asegurado en 'users_areas'.");

    } catch (error) {
      console.error('❌ Error fatal durante la inicialización del usuario:', error);
    }
  }

  // ✅ NUEVO: Verificar si el usuario es administrador
  isAdmin(): boolean {
    return this.currentUserRole === 'admin';
  }

  // ✅ NUEVO: Verificar si el usuario es coordinador o admin
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
    const user = this.usersService.getCurrentUser();
    return user ? user.displayName : null;
  }

  async logout(): Promise<void> {
    await this.registersService.logout();
    this.currentUserRole = null; // ✅ Limpiar rol al cerrar sesión
    this.router.navigate(['/login']);
  }

  isStandaloneRoute(): boolean {
    const standaloneRoutes = ['/login', '/consultas'];
    return standaloneRoutes.includes(this.activeRoute);
  }

  // ✅ NUEVO: Navegar a administración de usuarios
  goToUserAdmin(): void {
    this.router.navigate(['/admin/users']);
    this.closeDrawer(); // Cerrar drawer si está abierto
  }
}