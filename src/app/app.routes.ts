import { Routes } from '@angular/router';
import { IssfaComponent } from './pages/issfa/issfa.component';
import { ItinerarioComponent } from './pages/itinerario/itinerario.component';
import { ItinerarioFormComponent } from './pages/itinerario-form/itinerario-form.component';
import { HistoryItinerarioComponent } from './pages/history-itinerario/history-itinerario.component';
import { LoginComponent } from './pages/login/login.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/welcome' },
  { path: 'welcome', loadChildren: () => import('./pages/welcome/welcome.routes').then(m => m.WELCOME_ROUTES) },
  { path: 'issfa', component: IssfaComponent },
  { path: 'itinerario', component: ItinerarioComponent },
  { path: 'itinerario-form', component: ItinerarioFormComponent },
  { path: 'history-itinerario', component: HistoryItinerarioComponent },
  { path: 'login', component: LoginComponent },
];
