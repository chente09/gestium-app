import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RegistersService } from '../../services/registers/registers.service';
import { UsersService } from '../../services/users/users.service';
import { NzMessageService } from 'ng-zorro-antd/message';

// Acceso a Trámites del IESS: el admin y las personas a las que el admin les
// dio acceso. Se lee el registro fresco (no el guardado al iniciar sesión)
// para que un acceso recién dado o quitado se note al entrar a la página.
export const tramitesIessGuard: CanActivateFn = async () => {
  const registersService = inject(RegistersService);
  const usersService = inject(UsersService);
  const router = inject(Router);
  const message = inject(NzMessageService);

  const user = await firstValueFrom(usersService.user$);
  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  const register = await registersService.getRegisterByUid(user.uid) ?? registersService.currentRegister ?? null;
  if (register) registersService.currentRegister = register;

  if (registersService.canAccessTramitesIess()) return true;

  message.error('No tiene permisos para acceder a los Trámites del IESS');
  router.navigate(['/welcome']);
  return false;
};
