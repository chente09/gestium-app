import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzLayoutModule } from 'ng-zorro-antd/layout';

@Component({
  selector: 'app-selector-providencia',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NzCardModule,
    NzGridModule,
    NzIconModule,
    NzBreadCrumbModule,
    NzBadgeModule,
    NzLayoutModule
  ],
  templateUrl: './selector-providencia.component.html',
  styleUrl: './selector-providencia.component.css'
})
export class SelectorProvidenciaComponent implements OnInit {

  vistaActual: 'principal' | 'inicio-cancelacion' | 'rpv' = 'principal';
  
  // Vista Principal
  documentosDisponibles = [
    {
      titulo: 'Inicio y Cancelación',
      descripcion: 'Providencias de inicio y cancelación de procedimientos',
      icono: 'file-text',
      color: '#595959',
      cantidad: 4,
      vista: 'inicio-cancelacion'
    },
    {
      titulo: 'Requerimiento de Pago Voluntario',
      descripcion: 'RPV para personas naturales y jurídicas',
      icono: 'dollar',
      color: '#595959',
      cantidad: 2,
      vista: 'rpv'
    }
  ];

  // Opciones de Inicio y Cancelación
  opcionesInicioCancelacion = [
    {
      title: 'Individual - Persona Natural',
      description: 'Providencia para un solo título de crédito de persona natural',
      icon: 'user',
      route: '/providencia-iess/individual-natural'
    },
    {
      title: 'Individual - Persona Jurídica',
      description: 'Providencia para un solo título de crédito de empresa',
      icon: 'shop',
      route: '/providencia-iess/individual-juridica'
    },
    {
      title: 'Agrupados - Persona Natural',
      description: 'Providencia para múltiples títulos de crédito de persona natural',
      icon: 'team',
      route: '/providencia-iess/agrupados-natural'
    },
    {
      title: 'Agrupados - Persona Jurídica',
      description: 'Providencia para múltiples títulos de crédito de empresa',
      icon: 'cluster',
      route: '/providencia-iess/agrupados-juridica'
    }
  ];

  // Opciones de RPV
  opcionesRpv = [
    {
      title: 'Persona Natural',
      description: 'Requerimiento de Pago Voluntario para persona natural',
      icon: 'user',
      route: '/rpv-iess/natural'
    },
    {
      title: 'Persona Jurídica',
      description: 'Requerimiento de Pago Voluntario para empresa',
      icon: 'shop',
      route: '/rpv-iess/juridica'
    }
  ];

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Detectar vista desde query params
    this.route.queryParams.subscribe(params => {
      this.vistaActual = params['vista'] || 'principal';
    });
  }

  seleccionarDocumento(vista: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { vista: vista },
      queryParamsHandling: 'merge'
    });
  }

  volverPrincipal(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { vista: 'principal' }
    });
  }

  getTitulo(): string {
    switch(this.vistaActual) {
      case 'inicio-cancelacion':
        return 'Providencias de Inicio y Cancelación';
      case 'rpv':
        return 'Requerimiento de Pago Voluntario';
      default:
        return 'Documentos Disponibles IESS';
    }
  }

}