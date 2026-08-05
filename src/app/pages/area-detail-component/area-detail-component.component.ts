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
      {
        title: 'Redacción de Providencias',
        externalUrl: 'https://prov-iess.netlify.app/login',
        icon: 'form',
        isExternal: true
      },
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

    // Admin/coordinador ven todo; un usuario sin área asignada no está bloqueado
    if (this.registersService.hasFullAccess() || this.currentUserArea === 'sin_asignar') {
      this.showAgenda = true;
      return;
    }

    // Resolver ambos identificadores (pueden venir como slug o como nombre)
    // contra el catálogo real de áreas, en vez de un mapeo hardcodeado.
    const [userArea, viewingArea] = await Promise.all([
      this.registersService.findAreaByIdentifier(this.currentUserArea),
      this.registersService.findAreaByIdentifier(this.areaId)
    ]);

    this.showAgenda = !!userArea && !!viewingArea && userArea.slug === viewingArea.slug;
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