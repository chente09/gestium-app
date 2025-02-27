import { Routes } from '@angular/router';
import { IssfaComponent } from './pages/issfa/issfa.component';
import { ItinerarioComponent } from './pages/itinerario/itinerario.component';
import { ItinerarioFormComponent } from './pages/itinerario-form/itinerario-form.component';
import { HistoryItinerarioComponent } from './pages/history-itinerario/history-itinerario.component';
import { LoginComponent } from './pages/login/login.component';
import { WelcomeComponent } from './pages/welcome/welcome.component';
import { canActivate, redirectUnauthorizedTo } from '@angular/fire/auth-guard';
import { DmdProcOrdinarioComponent } from './pages/demandas-bp/dmd-proc-ordinario/dmd-proc-ordinario.component';

export const redirectUnauthorizedToLogin = () => redirectUnauthorizedTo(['/login']);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/login' },
  { path: 'login', component: LoginComponent, },
  { path: 'welcome', component: WelcomeComponent, ...canActivate(redirectUnauthorizedToLogin) },
  { path: 'issfa', component: IssfaComponent, ...canActivate(redirectUnauthorizedToLogin) },
  { path: 'itinerario', component: ItinerarioComponent, ...canActivate(redirectUnauthorizedToLogin) },
  { path: 'itinerario-form', component: ItinerarioFormComponent, ...canActivate(redirectUnauthorizedToLogin) },
  { path: 'history-itinerario', component: HistoryItinerarioComponent, ...canActivate(redirectUnauthorizedToLogin) },
  { path: 'dmd-proc-ordinario', component: DmdProcOrdinarioComponent, ...canActivate(redirectUnauthorizedToLogin) },
  
];
