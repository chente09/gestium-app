import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';

@Component({
  selector: 'app-selector-providencia',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NzCardModule,
    NzGridModule,
    NzIconModule,
    NzBreadCrumbModule
  ],
  templateUrl: './selector-providencia.component.html',
  styleUrl: './selector-providencia.component.css'
})
export class SelectorProvidenciaComponent {

  providenciasOptions = [
    {
      title: 'Individual - Persona Natural',
      description: 'Providencia para un solo título de crédito de persona natural',
      icon: 'user',
      route: '/providencia-iess/individual-natural',
      tipo: 'individual',
      personaTipo: 'natural'
    },
    {
      title: 'Individual - Persona Jurídica',
      description: 'Providencia para un solo título de crédito de empresa',
      icon: 'shop',
      route: '/providencia-iess/individual-juridica',
      tipo: 'individual',
      personaTipo: 'juridica'
    },
    {
      title: 'Agrupados - Persona Natural',
      description: 'Providencia para múltiples títulos de crédito de persona natural',
      icon: 'team',
      route: '/providencia-iess/agrupados-natural',
      tipo: 'agrupados',
      personaTipo: 'natural'
    },
    {
      title: 'Agrupados - Persona Jurídica',
      description: 'Providencia para múltiples títulos de crédito de empresa',
      icon: 'cluster',
      route: '/providencia-iess/agrupados-juridica',
      tipo: 'agrupados',
      personaTipo: 'juridica'
    }
  ];

  constructor(private router: Router) {}

}