import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';

import { ConcursoService } from '../../services/concurso/concurso.service';
import { MAX_MENSAJE, Participante, esCorreoValido, validarVoto } from '../../services/concurso/concurso.util';

type Paso = 'correo' | 'votar' | 'listo';

// Página pública del jurado (sin sesión): se entra con el correo con el que el
// admin lo registró, se elige un disfraz y se deja un mensaje. Un voto por correo.
@Component({
  selector: 'app-concurso-votar',
  standalone: true,
  imports: [CommonModule, FormsModule, NzButtonModule, NzIconModule, NzInputModule, NzPopconfirmModule],
  templateUrl: './concurso-votar.component.html',
  styleUrl: './concurso-votar.component.css'
})
export class ConcursoVotarComponent implements OnInit {
  readonly maxMensaje = MAX_MENSAJE;

  cargando = true;
  falloCarga = false;
  abierta = false;
  participantes: Participante[] = [];

  paso: Paso = 'correo';
  correo = '';
  seleccionado: string | null = null;
  mensaje = '';
  enviando = false;
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

  continuar(): void {
    this.error = null;
    if (!esCorreoValido(this.correo)) {
      this.error = 'Escribe tu correo completo, por ejemplo nombre@empresa.com.';
      return;
    }
    this.paso = 'votar';
  }

  cambiarCorreo(): void {
    this.paso = 'correo';
    this.error = null;
  }

  elegir(p: Participante): void {
    this.seleccionado = p.id ?? null;
    this.error = null;
  }

  get participanteElegido(): Participante | undefined {
    return this.participantes.find(p => p.id === this.seleccionado);
  }

  get problema(): string | null {
    return validarVoto(this.seleccionado, this.mensaje);
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
      await this.concursoService.votar(this.correo, this.seleccionado!, this.mensaje);
      this.paso = 'listo';
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
