import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutComponent } from 'ng-zorro-antd/layout';
import { AgendaAreaComponent } from "../../components/agenda-area/agenda-area.component";
import { RegistersService } from '../../services/registers/registers.service';

@Component({
  selector: 'app-area-detail-component',
  standalone: true,
  imports: [
    CommonModule,
    NzLayoutComponent,
    NzCardModule,
    NzGridModule,
    RouterModule,
    NzIconModule,
    NzBreadCrumbModule,
    AgendaAreaComponent
  ],
  templateUrl: './area-detail-component.component.html',
  styleUrl: './area-detail-component.component.css'
})
export class AreaDetailComponentComponent implements OnInit {

  areaId: string | null = '';
  options: any[] = [];
  currentUserArea: string | null = null;
  showAgenda: boolean = false;

  areasOptions: any = {
    issfa: [
      { title: 'Registro de casos', route: '/procesos', icon: 'form' },
      { title: 'Redacción de matrices', route: '/matriz-doc-isffa', icon: 'file-text' },
    ],
    inmobiliaria: [
      { title: 'Registro de casos', route: '/procesos', icon: 'form' },
      { title: 'Escrituras', route: '/servicio/escrituras', icon: 'book' }
    ],
    produbanco: [
      { title: 'Registro de casos', route: '/procesos', icon: 'form' },
      { title: 'Elaboración de demandas', route: '/servicio/demandas', icon: 'edit' }
    ],
    pichincha: [
      {
        title: 'Elaboración de demandas',
        route: '/dmd-proc-ordinario',
        icon: 'edit',
      },
    ],
    // ✅ AGREGAR ESTA SECCIÓN PARA IESS
    iess: [
      { title: 'Redacción de Providencias', route: '/selector-providencia', icon: 'form' },
    ],
  };

  constructor(
    private route: ActivatedRoute,
    private registersService: RegistersService
  ) { }

  async ngOnInit(): Promise<void> {
    // Suscribirse a los cambios del parámetro 'id'
    this.route.paramMap.subscribe(async params => {
      const id = params.get('id');
      if (id) {
        this.areaId = id;
        this.options = this.areasOptions[this.areaId] || [];

        // Recalcular el acceso cuando cambia el área
        await this.checkUserAccess();
      }
    });

    // Obtener el área del usuario actual
    await this.loadUserArea();
  }

  // ✅ Cargar área del usuario actual
  private async loadUserArea(): Promise<void> {
    try {
      const currentRegister = this.registersService.getCurrentRegister();

      if (currentRegister) {
        this.currentUserArea = currentRegister.areaAsignada;

        // Calcular acceso después de obtener el área
        await this.checkUserAccess();
      } else {
        // Usuario no autenticado o sin registro
        this.currentUserArea = null;
        this.showAgenda = false;
      }

    } catch (error) {
      console.error('Error al obtener área del usuario:', error);
      this.currentUserArea = null;
      this.showAgenda = false;
    }
  }

  // ✅ Verificar acceso y actualizar la propiedad
  private async checkUserAccess(): Promise<void> {

    if (!this.currentUserArea || !this.areaId) {
      this.showAgenda = false;
      return;
    }

    // Lógica para determinar si mostrar agenda
    const currentAreaNormalized = this.normalizeAreaName(this.currentUserArea);
    const viewingAreaNormalized = this.normalizeAreaName(this.areaId);


    // Verificar si es admin usando el servicio
    const isAdmin = this.registersService.isCurrentUserAdmin();

    this.showAgenda = currentAreaNormalized === viewingAreaNormalized ||
      isAdmin ||
      this.currentUserArea === 'sin_asignar';
  }

  // ✅ Normalizar nombres de áreas
  private normalizeAreaName(area: string): string {
    const areaMapping: { [key: string]: string } = {
      'issfa': 'ISSFA',
      'produbanco': 'Produbanco',
      'pichincha': 'Pichincha',
      'inmobiliaria': 'INMOBILIARIA',
      'iess': 'IESS',
      'tramites': 'TRAMITES',
      'cooprogreso': 'COOPROGRESO'
    };

    return areaMapping[area.toLowerCase()] || area;
  }

  // ✅ Verificar acceso del usuario
  hasAccessToArea(): boolean {
    return this.showAgenda;
  }

  // ✅ Método para debug (opcional)
  getDebugInfo(): string {
    return `Area: ${this.areaId}, UserArea: ${this.currentUserArea}, Show: ${this.showAgenda}`;
  }
}