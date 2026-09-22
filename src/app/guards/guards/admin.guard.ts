import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RegistersService } from '../../services/registers/registers.service';
import { UsersService } from '../../services/users/users.service';
import { NzMessageService } from 'ng-zorro-antd/message';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {

  constructor(
    private registersService: RegistersService,
    private usersService: UsersService,
    private router: Router,
    private message: NzMessageService
  ) {}

  async canActivate(): Promise<boolean> {
    // Esperar el estado real de auth (no leer getCurrentUser() al toque):
    // en una navegación directa a una ruta con este guard, Firebase Auth
    // puede no haber terminado de restaurar la sesión todavía, y
    // getCurrentUser() devolvería null aunque el usuario sí esté logueado
    // (mismo fix que ya tienen payrollGuard/solicitudesAprobarGuard/iessGuard).
    const user = await firstValueFrom(this.usersService.user$);

    if (!user) {
      this.message.error('Debe iniciar sesión para acceder a esta página');
      this.router.navigate(['/login']);
      return false;
    }

    try {
      const userRegister = await this.registersService.getRegisterByUid(user.uid);
      
      if (userRegister?.role === 'admin') {
        return true;
      } else {
        this.message.error('No tiene permisos de administrador para acceder a esta página');
        this.router.navigate(['/welcome']);
        return false;
      }
    } catch (error) {
      console.error('Error verificando permisos de admin:', error);
      this.message.error('Error verificando permisos');
      this.router.navigate(['/welcome']);
      return false;
    }
  }
}