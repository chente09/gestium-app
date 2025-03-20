import { Routes } from '@angular/router';
import { ItinerarioComponent } from './pages/admin-itinerario/itinerario/itinerario.component';
import { ItinerarioFormComponent } from './pages/admin-itinerario/itinerario-form/itinerario-form.component';
import { HistoryItinerarioComponent } from './pages/admin-itinerario/history-itinerario/history-itinerario.component';
import { LoginComponent } from './pages/login/login.component';
import { WelcomeComponent } from './pages/welcome/welcome.component';
import { canActivate, redirectUnauthorizedTo } from '@angular/fire/auth-guard';
import { DmdProcOrdinarioComponent } from './pages/demandas-bp/dmd-proc-ordinario/dmd-proc-ordinario.component';
import { AreaDetailComponentComponent } from './pages/area-detail-component/area-detail-component.component';
import { MatrizDocIsffaComponent } from './pages/matriz-doc-isffa/matriz-doc-isffa.component';
import { ProcesosComponent } from './pages/gestionProcesos/procesos/procesos.component';
import { ConsultasComponent } from './components/consultas/consultas.component';

export const redirectUnauthorizedToLogin = () => redirectUnauthorizedTo(['/login']);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/login' },
  { path: 'login', component: LoginComponent, },
  { path: 'welcome', component: WelcomeComponent, ...canActivate(redirectUnauthorizedToLogin) },
  { path: 'itinerario', component: ItinerarioComponent, ...canActivate(redirectUnauthorizedToLogin) },
  { path: 'itinerario-form', component: ItinerarioFormComponent, ...canActivate(redirectUnauthorizedToLogin) },
  { path: 'history-itinerario', component: HistoryItinerarioComponent, ...canActivate(redirectUnauthorizedToLogin) },
  { path: 'dmd-proc-ordinario', component: DmdProcOrdinarioComponent, ...canActivate(redirectUnauthorizedToLogin) },
  { path: 'matriz-doc-isffa', component: MatrizDocIsffaComponent, ...canActivate(redirectUnauthorizedToLogin) },
  { path: 'area/:id', component: AreaDetailComponentComponent, ...canActivate(redirectUnauthorizedToLogin) },
  { path: 'procesos', component: ProcesosComponent, ...canActivate(redirectUnauthorizedToLogin) },
  { path: 'consultas', component: ConsultasComponent },
];
