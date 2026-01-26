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
  if (currentRegister.role === 'admin' || currentRegister.role === 'coordinador') {
    return true;
  }

  // 4️⃣ Empleado solo puede acceder a su área asignada
  if (currentRegister.role === 'empleado') {
    const hasAccess = currentRegister.areaAsignada === areaSlug;

    if (hasAccess) {
      return true;
    } else {
      console.warn(`🔒 [AuthAreaGuard] Acceso denegado - Empleado de '${currentRegister.areaAsignada}' intentó acceder a '${areaSlug}'`);
      router.navigate(['/welcome']);
      return false;
    }
  }

  // 5️⃣ Rol desconocido - denegar acceso
  console.warn(`🔒 [AuthAreaGuard] Rol desconocido: ${currentRegister.role}`);
  router.navigate(['/welcome']);
  return false;
};