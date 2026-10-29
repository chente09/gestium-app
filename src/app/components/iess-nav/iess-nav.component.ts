import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { NzSelectModule } from 'ng-zorro-antd/select';

import { IessNavegacionService } from '../../services/iessNavegacion/iess-navegacion.service';
import { RegistersService } from '../../services/registers/registers.service';

export type SeccionIess = 'bitacora' | 'sin-gestion' | 'convenios' | 'tramites';

// Barra para pasar de una pantalla del área IESS a otra sin volver al inicio.
// Recuerda la cartera (abogado) con la que se trabaja: "Sin gestión" y
// "Convenios de pago" abren ya la de esa cartera.
@Component({
  selector: 'app-iess-nav',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NzSelectModule],
  templateUrl: './iess-nav.component.html',
  styleUrl: './iess-nav.component.css'
})
export class IessNavComponent implements OnChanges {
  @Input({ required: true }) seccion!: SeccionIess;
  // La cartera de la pantalla donde está la barra (si tiene una): se recuerda.
  @Input() cartera: string | null | undefined;

  readonly carteras: string[];
  readonly puedeVerTramites: boolean;

  constructor(
    private navegacion: IessNavegacionService,
    private router: Router,
    registersService: RegistersService
  ) {
    this.carteras = navegacion.carteras;
    this.puedeVerTramites = registersService.canAccessTramitesIess();
  }

  ngOnChanges(): void {
    this.navegacion.recordarCartera(this.cartera);
  }

  get carteraElegida(): string {
    return this.navegacion.cartera;
  }

  // En Convenios la cartera se elige en la propia pantalla (allí también está
  // "todos los abogados"), así que la barra solo la muestra donde no hay otro selector.
  get mostrarSelector(): boolean {
    return this.seccion === 'bitacora' || this.seccion === 'sin-gestion';
  }

  cambiarCartera(cartera: string): void {
    this.navegacion.recordarCartera(cartera);
    if (this.seccion === 'sin-gestion') {
      void this.router.navigate(['/iess/cartera', cartera], { queryParamsHandling: 'preserve' });
    }
  }
}
