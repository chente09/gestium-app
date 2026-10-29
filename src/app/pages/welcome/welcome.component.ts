import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import {NzCardModule} from 'ng-zorro-antd/card';
import {NzGridModule} from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { RouterModule } from '@angular/router';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzImageModule } from 'ng-zorro-antd/image';

import { DateUtilsService } from '../../services/date-utils/date-utils.service';
import { RegistersService } from '../../services/registers/registers.service';


// Noticia con imagen (un flyer): se ve hasta el día indicado, inclusive.
interface Noticia {
  titulo: string;
  imagen: string;
  hasta: string; // yyyy-MM-dd, hora de Ecuador
}

const NOTICIAS: Noticia[] = [
  { titulo: 'Halloween 2026 · Concurso de disfraces', imagen: 'assets/noticias/halloween-2026.webp', hasta: '2026-10-30' }
];

@Component({
  selector: 'app-welcome',
  imports: [
    NzLayoutModule, 
    CommonModule,
    NzCardModule,
    NzGridModule,
    NzIconModule,
    RouterModule,
    NzBreadCrumbModule,
    NzImageModule
  ],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.css'
})
export class WelcomeComponent {
  readonly noticias: Noticia[];
  private readonly hoy: string;

  constructor(dateUtils: DateUtilsService, private registersService: RegistersService) {
    this.hoy = dateUtils.getFechaActualEcuador();
    this.noticias = NOTICIAS.filter(n => n.hasta >= this.hoy);
  }

  // Atajos temporales: solo para el admin y hasta la fecha indicada.
  get utilidades() {
    const esAdmin = this.registersService.isCurrentUserAdmin();
    return this.sections2.filter(i => (!i.soloAdmin || esAdmin) && (!i.hasta || i.hasta >= this.hoy));
  }

  sections = [
    { title: 'IESS', description: 'Agenda conjunta y redacción de Providencias', icon: 'file-text', route: '/area/iess' },
    { title: 'ISSFA', description: 'Registro de documentación para procesos', icon: 'file-text', route: '/area/issfa' },
    { title: 'Inmobiliaria', description: 'Registro de documentación inmobiliaria', icon: 'home', route: '/area/inmobiliaria' },
    { title: 'Banco Produbanco', description: 'Registro y elaboración de demandas', icon: 'bank', route: '/area/produbanco' },
    { title: 'Banco Pichincha', description: 'Gestion de demandas', icon: 'bank', route: '/area/pichincha' },
    { title: 'TRAMITES', description: 'Registro de trámites', icon: 'file-text', route: '/itinerario-form' },
    { title: 'COOPROGRESO', description: 'Registro de documentación para procesos', icon: 'file-text', route: '/area/cooprogreso' },
  ];

  sections2 = [
    { title: 'Itinerario', description: 'Control de actividades del tramitador', icon: 'schedule', route: '/itinerario' },
    { title: 'Control de Gastos', description: 'Control de gastos por área', icon: 'credit-card', route: '/area/gastos' },
    { title: 'Permisos y Vacaciones', description: 'Solicitar permisos y vacaciones', icon: 'calendar', route: '/permisos' },
    { title: 'Concurso de disfraces', description: 'Participantes, jurados y resultados', icon: 'trophy', route: '/concurso', soloAdmin: true, hasta: '2026-11-13' },
  ];

  
}
