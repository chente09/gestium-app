import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RegistersService } from '../../services/registers/registers.service';
import { UsersService } from '../../services/users/users.service';
import { NzMessageService } from 'ng-zorro-antd/message';

// Acceso a "Solicitudes por Aprobar": admin, gerente o coordinador — un
// empleado normal puede pedir sus propios permisos (/permisos) pero no
// entrar acá. Mismo patrón que payrollGuard: awaitear usersService.user$
// (authState) en vez de leer auth.currentUser, para no desloguear en un
// refresh duro (ver el fix del guard de Roles de Pago).
export const solicitudesAprobarGuard: CanActivateFn = async () => {
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

  if (register && (register.role === 'admin' || register.role === 'gerente' || register.role === 'coordinador')) {
    if (!registersService.currentRegister) {
      registersService.currentRegister = register;
    }
    return true;
  }

  message.error('No tiene permisos para acceder a Solicitudes por Aprobar');
  router.navigate(['/welcome']);
  return false;
};
