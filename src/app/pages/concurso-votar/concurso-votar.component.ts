import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';

import { ConcursoService } from '../../services/concurso/concurso.service';
import { MAX_NOMBRE, MAX_RAZON, Participante, validarVoto } from '../../services/concurso/concurso.util';

// Página pública del jurado (sin sesión ni correo): se elige un disfraz, se
// escribe el nombre y la razón del voto. Un voto por nombre.
@Component({
  selector: 'app-concurso-votar',
  standalone: true,
  imports: [CommonModule, FormsModule, NzButtonModule, NzIconModule, NzInputModule, NzPopconfirmModule],
  templateUrl: './concurso-votar.component.html',
  styleUrl: './concurso-votar.component.css'
})
export class ConcursoVotarComponent implements OnInit {
  readonly maxNombre = MAX_NOMBRE;
  readonly maxRazon = MAX_RAZON;

  cargando = true;
  falloCarga = false;
  abierta = false;
  participantes: Participante[] = [];

  seleccionado: string | null = null;
  nombre = '';
  razon = '';
  enviando = false;
  votoRegistrado = false;
  error: string | null = null;

  constructor(private concursoService: ConcursoService) { }

  ngOnInit(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando = true;
    this.falloCarga = false;
    try {
      [this.participantes, this.abierta] = await Promise.all([
        this.concursoService.getParticipantes(),
        this.concursoService.votacionAbierta()
      ]);
    } catch (e) {
      console.error('Error cargando el concurso:', e);
      this.falloCarga = true;
    } finally {
      this.cargando = false;
    }
  }

  elegir(p: Participante): void {
    this.seleccionado = p.id ?? null;
    this.error = null;
  }

  get participanteElegido(): Participante | undefined {
    return this.participantes.find(p => p.id === this.seleccionado);
  }

  get problema(): string | null {
    return validarVoto({ nombre: this.nombre, participanteId: this.seleccionado, razon: this.razon });
  }

  async votar(): Promise<void> {
    const problema = this.problema;
    if (problema) {
      this.error = problema;
      return;
    }
    this.enviando = true;
    this.error = null;
    try {
      await this.concursoService.votar(this.nombre, this.seleccionado!, this.razon);
      this.votoRegistrado = true;
    } catch (e: any) {
      this.error = e?.message ?? 'No se pudo registrar tu voto. Inténtalo de nuevo.';
    } finally {
      this.enviando = false;
    }
  }

  trackById(_: number, p: Participante): string | undefined {
    return p.id;
  }
}
