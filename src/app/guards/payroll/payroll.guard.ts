import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RegistersService } from '../../services/registers/registers.service';
import { NzMessageService } from 'ng-zorro-antd/message';

// Acceso al módulo de Roles de Pago: solo admin o gerente.
export const payrollGuard: CanActivateFn = () => {
  const registersService = inject(RegistersService);
  const router = inject(Router);
  const message = inject(NzMessageService);

  if (registersService.canAccessPayroll()) {
    return true;
  }

  message.error('No tiene permisos para acceder a Roles de Pago');
  router.navigate(['/welcome']);
  return false;
};
