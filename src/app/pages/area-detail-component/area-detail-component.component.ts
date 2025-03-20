import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutComponent } from 'ng-zorro-antd/layout';

@Component({
  selector: 'app-area-detail-component',
  imports: [
    CommonModule,
    NzLayoutComponent,
    NzCardModule,
    NzGridModule,
    RouterModule,
    NzIconModule,
    NzBreadCrumbModule
  ],
  templateUrl: './area-detail-component.component.html',
  styleUrl: './area-detail-component.component.css'
})
export class AreaDetailComponentComponent {

  areaId: string | null = '';
  options: any[] = [];

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
      { title: 'Elaboración de demandas', 
        route: '/dmd-proc-ordinario', icon: 'edit',
        externalLinks: [
          { name: 'Emerix', url: 'https://solucionespagueya.com:1023/Emerix/login/login.aspx', img: 'https://i.postimg.cc/9fnrydbv/descarga-1.jpg' },
          { name: 'Solverix', url: 'https://solucionespagueya.com:1050/SolverixSeguridad/', img: 'https://i.postimg.cc/t4RcxWYd/Imagen-de-Whats-App-2025-03-13-a-las-11-29-46-8933b036.jpg' },
        ]
      },
    ]
  };
  

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Suscribirse a los cambios del parámetro 'id'
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.areaId = id;
        this.options = this.areasOptions[this.areaId] || [];
      }
    });
  }
}
