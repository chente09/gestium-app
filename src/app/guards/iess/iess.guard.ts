import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RegistersService } from '../../services/registers/registers.service';
import { UsersService } from '../../services/users/users.service';
import { NzMessageService } from 'ng-zorro-antd/message';

// Acceso a las herramientas del área IESS (Bitácora de Gestiones): admin y
// coordinador (acceso a todas las áreas) o quien tenga IESS asignada. Mismo
// patrón que payrollGuard/solicitudesAprobarGuard: awaitear usersService.user$
// en vez de leer auth.currentUser, para no desloguear en un refresh duro.
export const iessGuard: CanActivateFn = async () => {
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

  const tieneAcceso = !!register && register.activo &&
    (register.role === 'admin' || register.role === 'coordinador' || register.areaAsignada === 'iess');

  if (tieneAcceso) {
    if (!registersService.currentRegister) {
      registersService.currentRegister = register!;
    }
    return true;
  }

  message.error('No tiene permisos para acceder a la Bitácora de Gestiones');
  router.navigate(['/welcome']);
  return false;
};
