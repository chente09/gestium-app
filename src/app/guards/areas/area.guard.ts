import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { RegistersService } from '../../services/registers/registers.service';
import { UsersService } from '../../services/users/users.service';

/**
 * 🔒 Guard combinado: Autenticación + Permisos de Área
 * 
 * Verifica:
 * 1. Usuario autenticado
 * 2. Permisos según rol para acceder al área
 */
export const authAreaGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const registersService = inject(RegistersService);
  const usersService = inject(UsersService);
  const router = inject(Router);

  // 1️⃣ Verificar autenticación
  const firebaseUser = usersService.getCurrentUser();
  const currentRegister = registersService.getCurrentRegister();

  if (!firebaseUser || !currentRegister) {
    console.warn('🔒 [AuthAreaGuard] Usuario no autenticado - Redirigiendo a login');
    router.navigate(['/login']);
    return false;
  }

  // 2️⃣ Obtener el slug del área
  const areaSlug = route.paramMap.get('slug');

  if (!areaSlug) {
    console.error('🔒 [AuthAreaGuard] No se pudo obtener el slug del área');
    return false;
  }

  // 3️⃣ Admin y Coordinador tienen acceso a todas las áreas
  if (registersService.hasFullAccess()) {
    return true;
  }

  // 4️⃣ Cualquier otro rol solo puede acceder a su área asignada
  const hasAccess = currentRegister.areaAsignada === areaSlug;

  if (hasAccess) {
    return true;
  }

  console.warn(`🔒 [AuthAreaGuard] Acceso denegado - Usuario de '${currentRegister.areaAsignada}' intentó acceder a '${areaSlug}'`);
  router.navigate(['/welcome']);
  return false;
};