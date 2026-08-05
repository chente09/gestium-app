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
import { NzTagModule } from 'ng-zorro-antd/tag';
import { RegistersService } from './services/registers/registers.service';
import { UsersService } from './services/users/users.service';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

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
    NzButtonModule,
    NzTagModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'gestium-sli';
  isCollapsed = false;
  activeRoute = '';
  isDrawerOpen = false;
  currentUserRole: 'admin' | 'coordinador' | 'gerente' | 'empleado' | null = null;

  // Se puebla desde las áreas activas de Firestore — ver ngOnInit().
  menuItems: { title: string; route: string }[] = [];
  private menuAreasSub?: Subscription;

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

    // Suscribirse al observable de autenticación
    this.usersService.user$.subscribe(async (user) => {

      if (user) {
        await this.loadUserRole();

        // Menú lateral desde las áreas activas — solo con sesión, ya que
        // areasOficina requiere estar autenticado (si no, Firestore lo rechaza).
        this.menuAreasSub?.unsubscribe();
        this.menuAreasSub = this.registersService.getActiveAreas().subscribe(areas => {
          this.menuItems = areas
            .map(area => ({ title: area.nombre, route: `/area/${area.slug}` }))
            .sort((a, b) => a.title.localeCompare(b.title));
        });
      } else {
        this.currentUserRole = null;
        this.registersService.currentRegister = undefined;
        this.menuAreasSub?.unsubscribe();
        this.menuItems = [];
      }
    });
  }

  // ✅ Cargar rol del usuario actual desde RegistersService
  private async loadUserRole(): Promise<void> {
    try {

      const user = this.usersService.getCurrentUser();

      if (user) {
        const userRegister = await this.registersService.getRegisterByUid(user.uid);

        if (userRegister) {
          // ✅ CRÍTICO: Asignar currentRegister si no existe
          if (!this.registersService.currentRegister) {
            this.registersService.currentRegister = userRegister;
          }
          this.currentUserRole = userRegister.role;
        }
      }
    } catch (error) {
      console.error('❌ [loadUserRole] Error:', error);
      this.currentUserRole = null;
    }
  }

  // ✅ Verificar si el usuario es administrador
  isAdmin(): boolean {
    return this.registersService.isCurrentUserAdmin();
  }

  // ✅ Verificar si el usuario es coordinador o admin
  isCoordinatorOrAdmin(): boolean {
    return this.registersService.hasFullAccess();
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
    if (!currentRegister) return null;
    return currentRegister.displayName || currentRegister.nickname || currentRegister.email || null;
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