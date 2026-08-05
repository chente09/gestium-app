import { Routes } from '@angular/router';
import { ItinerarioComponent } from './pages/admin-itinerario/itinerario/itinerario.component';
import { ItinerarioFormComponent } from './pages/admin-itinerario/itinerario-form/itinerario-form.component';
import { HistoryItinerarioComponent } from './pages/admin-itinerario/history-itinerario/history-itinerario.component';
import { LoginComponent } from './pages/login/login.component';
import { WelcomeComponent } from './pages/welcome/welcome.component';
import { canActivate, redirectUnauthorizedTo, hasCustomClaim, AuthPipe } from '@angular/fire/auth-guard';
import { DmdProcOrdinarioComponent } from './pages/demandas-bp/dmd-proc-ordinario/dmd-proc-ordinario.component';
import { AreaDetailComponentComponent } from './pages/area-detail-component/area-detail-component.component';
import { MatrizDocIsffaComponent } from './pages/matriz-doc-isffa/matriz-doc-isffa.component';
import { ProcesosComponent } from './pages/gestionProcesos/procesos/procesos.component';
import { ConsultasComponent } from './components/consultas/consultas.component';
import { UserAreaAdminComponent } from './pages/user-admin/user-area-admin/user-area-admin.component';
import { AdminGuard } from './guards/guards/admin.guard';
import { payrollGuard } from './guards/payroll/payroll.guard';
import { PayrollEmployeesComponent } from './pages/payroll/payroll-employees/payroll-employees.component';
import { PayrollRolesComponent } from './pages/payroll/payroll-roles/payroll-roles.component';
import { PayrollRolDetailComponent } from './pages/payroll/payroll-rol-detail/payroll-rol-detail.component';
import { PayrollReciboComponent } from './pages/payroll/payroll-recibo/payroll-recibo.component';
import { UnauthorizedComponent } from './pages/error/unauthorized/unauthorized.component';
import { NotFoundComponent } from './pages/error/not-found/not-found.component';

// Redirección para usuarios no autenticados
export const redirectUnauthorizedToLogin = () => redirectUnauthorizedTo(['/login']);

// Redirección para usuarios sin permisos (roles)
export const redirectUnauthorizedToHome = () => redirectUnauthorizedTo(['/welcome']);

// Agrupación de rutas para mejor organización
const publicRoutes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'login', component: LoginComponent },
  { path: 'consultas', component: ConsultasComponent },
];

const basicProtectedRoutes: Routes = [
  { path: 'welcome', component: WelcomeComponent },
  { path: 'area/:id', component: AreaDetailComponentComponent },
].map(route => ({
  ...route,
  ...canActivate(redirectUnauthorizedToLogin)
}));

const adminRoutes: Routes = [
  { path: 'itinerario', component: ItinerarioComponent },
  { path: 'itinerario-form', component: ItinerarioFormComponent },
  { path: 'history-itinerario', component: HistoryItinerarioComponent },
  { path: 'dmd-proc-ordinario', component: DmdProcOrdinarioComponent },
  { path: 'matriz-doc-isffa', component: MatrizDocIsffaComponent },
  { path: 'procesos', component: ProcesosComponent },
].map(route => ({
  ...route,
  ...canActivate(redirectUnauthorizedToLogin)
}));

// canActivate(redirectUnauthorizedToLogin) devuelve { canActivate: [AuthGuard], data: {...} }.
// Un simple {...route, ...canActivate(...)} PISA cualquier canActivate propio de la ruta
// (ej. AdminGuard) en vez de combinarlo — por eso acá se combinan los arrays a mano.
function withAuthAnd(extraGuards: any[]) {
  const authConfig = canActivate(redirectUnauthorizedToLogin);
  return (route: any) => ({
    ...route,
    ...authConfig,
    canActivate: [...authConfig.canActivate, ...extraGuards]
  });
}

const superAdminRoutes: Routes = [
  { path: 'admin/users', component: UserAreaAdminComponent },
].map(withAuthAnd([AdminGuard]));

const payrollRoutes: Routes = [
  { path: 'payroll/employees', component: PayrollEmployeesComponent },
  { path: 'payroll/roles', component: PayrollRolesComponent },
  { path: 'payroll/roles/:id', component: PayrollRolDetailComponent },
  { path: 'payroll/recibo/:rolId/:employeeId', component: PayrollReciboComponent },
].map(withAuthAnd([payrollGuard]));

const errorRoutes: Routes = [
  { path: 'unauthorized', component: UnauthorizedComponent }, 
  { path: 'not-found', component: NotFoundComponent }, 
  { path: '**', redirectTo: '/not-found' }
];

// Combina todas las rutas
export const routes: Routes = [
  ...publicRoutes,
  ...basicProtectedRoutes,
  ...adminRoutes,
  ...superAdminRoutes,
  ...payrollRoutes,
  ...errorRoutes
];