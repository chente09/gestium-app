import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RegistersService } from '../../services/registers/registers.service';
import { UsersService } from '../../services/users/users.service';
import { NzMessageService } from 'ng-zorro-antd/message';

// Acceso al módulo de Roles de Pago: solo admin o gerente.
//
// usersService.getCurrentUser() lee auth.currentUser — una propiedad
// SÍNCRONA de Firebase que en un refresh duro puede seguir en null un
// instante mientras la sesión se restaura, aunque la restauración vaya a
// resolver bien enseguida. Eso mandaba a un admin/gerente real a /login
// como si se hubiera deslogueado. usersService.user$ (authState) es la
// fuente correcta: awaitear su primer valor emitido espera a que la
// restauración termine de verdad, en vez de leer el valor a mitad de camino.
export const payrollGuard: CanActivateFn = async () => {
  const registersService = inject(RegistersService);
  const usersService = inject(UsersService);
  const router = inject(Router);
  const message = inject(NzMessageService);

  const user = await firstValueFrom(usersService.user$);
  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  const register = registersService.currentRegister
    ?? await registersService.getRegisterByUid(user.uid);

  if (register && (register.role === 'admin' || register.role === 'gerente')) {
    if (!registersService.currentRegister) {
      registersService.currentRegister = register;
    }
    return true;
  }

  message.error('No tiene permisos para acceder a Roles de Pago');
  router.navigate(['/welcome']);
  return false;
};
