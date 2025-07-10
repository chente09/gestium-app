import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutComponent } from 'ng-zorro-antd/layout';
import { AgendaAreaComponent } from "../../components/agenda-area/agenda-area.component";
import { UserAreaService } from '../../services/userArea/user-area.service';

@Component({
  selector: 'app-area-detail-component',
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
  
  // ✅ NUEVO: Propiedad para evitar el bucle infinito
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
        route: '/dmd-proc-ordinario', icon: 'edit',
        externalLinks: [
          { name: 'Emerix', url: 'https://solucionespagueya.com:1023/Emerix/login/login.aspx', img: 'https://i.postimg.cc/9fnrydbv/descarga-1.jpg' },
          { name: 'Solverix', url: 'https://solucionespagueya.com:1050/SolverixSeguridad/', img: 'https://i.postimg.cc/t4RcxWYd/Imagen-de-Whats-App-2025-03-13-a-las-11-29-46-8933b036.jpg' },
        ]
      },
    ],
    bnf: [
      { title: 'Registro de casos', route: '/procesos', icon: 'form' }
    ],
    david: [
      { title: 'Registro de casos', route: '/procesos', icon: 'form' }
    ]
  };

  constructor(
    private route: ActivatedRoute,
    private userAreaService: UserAreaService
  ) { }

  async ngOnInit(): Promise<void> {
    // Suscribirse a los cambios del parámetro 'id'
    this.route.paramMap.subscribe(async params => {
      const id = params.get('id');
      if (id) {
        this.areaId = id;
        this.options = this.areasOptions[this.areaId] || [];
        console.log('🎯 AreaId actual:', this.areaId);
        
        // ✅ Recalcular el acceso cuando cambia el área
        await this.checkUserAccess();
      }
    });

    // ✅ Obtener el área del usuario actual
    await this.loadUserArea();
  }

  // ✅ NUEVO: Método para cargar área del usuario
  private async loadUserArea(): Promise<void> {
    try {
      this.currentUserArea = await this.userAreaService.getCurrentUserArea();
      console.log('👤 Área del usuario:', this.currentUserArea);
      
      // ✅ Calcular acceso después de obtener el área
      await this.checkUserAccess();
      
    } catch (error) {
      console.error('Error al obtener área del usuario:', error);
      // ✅ Para testing: asignar área manualmente
      this.currentUserArea = 'sin_asignar';
      console.log('🎯 Área asignada para testing:', this.currentUserArea);
      await this.checkUserAccess();
    }
  }

  // ✅ NUEVO: Método para verificar acceso y actualizar la propiedad
  private async checkUserAccess(): Promise<void> {
    
    console.log('🔍 Verificando acceso...');
    console.log('  - currentUserArea:', this.currentUserArea);
    console.log('  - areaId:', this.areaId);

    if (!this.currentUserArea || !this.areaId) {
      console.log('  ❌ Faltan datos básicos');
      this.showAgenda = false;
      return;
    }

    
    // ✅ Lógica para determinar si mostrar agenda
    const currentAreaNormalized = this.normalizeAreaName(this.currentUserArea);
    const viewingAreaNormalized = this.normalizeAreaName(this.areaId);
    
    console.log('  - currentAreaNormalized:', currentAreaNormalized);
    console.log('  - viewingAreaNormalized:', viewingAreaNormalized);

    this.showAgenda = currentAreaNormalized === viewingAreaNormalized ||
      this.currentUserArea === 'admin' ||
      this.currentUserArea === 'sin_asignar';
    
    console.log('  ✅ ShowAgenda resultado:', this.showAgenda);
  }

  // ✅ MEJORADO: Ahora es solo un getter simple (sin lógica compleja)
  shouldShowAgenda(): boolean {
    return this.showAgenda;
  }

  // ✅ Normalizar nombres de áreas
  private normalizeAreaName(area: string): string {
    const areaMapping: { [key: string]: string } = {
      'issfa': 'ISSFA',
      'produbanco': 'Bco. Produbanco', 
      'pichincha': 'Bco. Pichincha',
      'inmobiliaria': 'Inmobiliaria',
      'bnf': 'BNF',
      'david': 'David'
    };

    return areaMapping[area.toLowerCase()] || area;
  }

  // ✅ Método para verificar acceso del usuario
  hasAccessToArea(): boolean {
    return this.showAgenda;
  }

  // ✅ NUEVO: Método para debug (opcional)
  getDebugInfo(): string {
    return `Area: ${this.areaId}, UserArea: ${this.currentUserArea}, Show: ${this.showAgenda}`;
  }
}