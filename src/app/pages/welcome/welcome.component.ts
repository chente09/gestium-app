import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import {NzCardModule} from 'ng-zorro-antd/card';
import {NzGridModule} from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { RouterModule } from '@angular/router';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';


@Component({
  selector: 'app-welcome',
  imports: [
    NzLayoutModule, 
    CommonModule,
    NzCardModule,
    NzGridModule,
    NzIconModule,
    RouterModule,
    NzBreadCrumbModule
  ],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.css'
})
export class WelcomeComponent {
  constructor() {}

  sections = [
    { title: 'ISSFA', description: 'Registro de documentación para procesos', icon: 'file-text', route: '/issfa' },
    { title: 'Inmobiliaria', description: 'Registro de documentación inmobiliaria', icon: 'home', route: '/inmobiliaria' },
    { title: 'Banco Produbanco', description: 'Registro y elaboración de demandas', icon: 'bank', route: '/produbanco' },
    { title: 'Banco Pichincha', description: 'Gestion de demandas', icon: 'bank', route: '/dmd-proc-ordinario' },
  ];

  sections2 = [
    { title: 'Itinerario', description: 'Control de actividades del tramitador', icon: 'schedule', route: '/itinerario' },
    { title: 'Control de Gastos', description: 'Control de gastos por área', icon: 'credit-card', route: '/gastos' },
  ];

  
}
