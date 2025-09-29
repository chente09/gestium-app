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
    { title: 'BNF', route: '/area/bnf' },
    { title: 'Inmobiliaria', route: '/area/inmobiliaria' },
    { title: 'David', route: '/area/david' }
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

    // Cargar rol del usuario si está autenticado
    await this.loadUserRole();
  }

  // ✅ Cargar rol del usuario actual desde RegistersService
  private async loadUserRole(): Promise<void> {
    try {
      const user = this.usersService.getCurrentUser();
      
      if (user) {
        // Intentar obtener el registro del usuario
        const userRegister = await this.registersService.getRegisterByUid(user.uid);
        
        if (userRegister) {
          this.currentUserRole = userRegister.role;
          console.log('🔑 Rol del usuario:', this.currentUserRole);
        } else {
          // Si no existe registro, podría ser un nuevo usuario de Google
          // El auto-registro se encargará en el login
          this.currentUserRole = null;
          console.log('⚠️ Usuario sin registro encontrado');
        }
      }
    } catch (error) {
      console.error('Error cargando rol del usuario:', error);
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