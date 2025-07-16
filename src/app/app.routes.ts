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
import { UserAreaAdminComponent } from './pages/user-admin/user-area-admin/user-area-admin.component'; // ✅ NUEVA IMPORTACIÓN
import { AdminGuard } from './guards/guards/admin.guard'; // ✅ IMPORTAR GUARD
import { pipe } from 'rxjs';
import { map } from 'rxjs/operators';
import { UnauthorizedComponent } from './pages/error/unauthorized/unauthorized.component';
import { NotFoundComponent } from './pages/error/not-found/not-found.component';

// Redirección para usuarios no autenticados
export const redirectUnauthorizedToLogin = () => redirectUnauthorizedTo(['/login']);

// Redirección para usuarios sin permisos (roles)
export const redirectUnauthorizedToHome = () => redirectUnauthorizedTo(['/welcome']);

// Agrupación de rutas para mejor organización
const publicRoutes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'login', component: LoginComponent }, // Mantenemos /login por si hay enlaces directos
  { path: 'consultas', component: ConsultasComponent },
  // Otras rutas públicas que puedas tener
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

// ✅ NUEVAS RUTAS PROTEGIDAS PARA ADMINISTRADORES
const superAdminRoutes: Routes = [
  { 
    path: 'admin/users', 
    component: UserAreaAdminComponent,
    canActivate: [AdminGuard] // ✅ Protegida con guard personalizado
  },
].map(route => ({
  ...route,
  ...canActivate(redirectUnauthorizedToLogin) // También requiere autenticación
}));

// Rutas para errores y páginas no encontradas
const errorRoutes: Routes = [
  { path: 'unauthorized', component: UnauthorizedComponent }, 
  { path: 'not-found', component: NotFoundComponent }, 
  { path: '**', redirectTo: '/not-found' } // Captura cualquier ruta no definida
];

// Combina todas las rutas
export const routes: Routes = [
  ...publicRoutes,
  ...basicProtectedRoutes,
  ...adminRoutes,
  ...superAdminRoutes, // ✅ AGREGAR RUTAS DE SUPER ADMIN
  ...errorRoutes
];