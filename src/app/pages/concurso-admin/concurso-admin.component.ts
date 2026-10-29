import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';

import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';

import { ConcursoService } from '../../services/concurso/concurso.service';
import { Jurado, MAX_MENSAJE, Participante, ResultadoConcurso, resultadosDe } from '../../services/concurso/concurso.util';

// Panel del admin del concurso de disfraces: participantes, jurados, apertura
// de la votación y resultados. Quien vota lo hace en la página pública /votar.
@Component({
  selector: 'app-concurso-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzAlertModule,
    NzBreadCrumbModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzPopconfirmModule,
    NzProgressModule,
    NzSwitchModule,
    NzTagModule
  ],
  templateUrl: './concurso-admin.component.html',
  styleUrl: './concurso-admin.component.css'
})
export class ConcursoAdminComponent implements OnInit, OnDestroy {
  readonly maxMensaje = MAX_MENSAJE;
  readonly enlace = `${window.location.origin}/votar`;

  participantes: Participante[] = [];
  jurados: Jurado[] = [];
  abierta = false;
  resultado: ResultadoConcurso = resultadosDe([], []);
  cargando = true;
  trabajando: string | null = null;

  // Formularios
  nombre = '';
  mensaje = '';
  foto: File | null = null;
  fotoPrevia: string | null = null;
  correoJurado = '';

  private suscripciones: Subscription[] = [];

  constructor(private concursoService: ConcursoService, private message: NzMessageService) { }

  ngOnInit(): void {
    const error = (texto: string) => (e: unknown) => {
      console.error(texto, e);
      this.cargando = false;
      this.message.error(texto);
    };

    this.suscripciones.push(
      combineLatest([this.concursoService.participantes$(), this.concursoService.jurados$()]).subscribe({
        next: ([participantes, jurados]) => {
          this.participantes = participantes;
          this.jurados = jurados;
          this.resultado = resultadosDe(participantes, jurados);
          this.cargando = false;
        },
        error: error('No se pudo cargar el concurso.')
      }),
      this.concursoService.votacionAbierta$().subscribe({
        next: abierta => (this.abierta = abierta),
        error: error('No se pudo leer el estado de la votación.')
      })
    );
  }

  ngOnDestroy(): void {
    this.suscripciones.forEach(s => s.unsubscribe());
    this.soltarPrevia();
  }

  // ----- Votación
  async cambiarVotacion(abierta: boolean): Promise<void> {
    const ok = await this.hacer('votacion', () => this.concursoService.cambiarVotacion(abierta),
      abierta ? 'Votación abierta.' : 'Votación cerrada.', 'No se pudo cambiar el estado de la votación.');
    // Si falló, el interruptor ya se movió: se vuelve a lo guardado.
    if (!ok) this.abierta = !abierta;
  }

  async copiarEnlace(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.enlace);
      this.message.success('Enlace copiado.');
    } catch {
      this.message.warning('No se pudo copiar: selecciónalo y cópialo a mano.');
    }
  }

  // ----- Participantes
  elegirFoto(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    input.value = '';
    this.soltarPrevia();
    this.foto = archivo;
    this.fotoPrevia = archivo ? URL.createObjectURL(archivo) : null;
  }

  private soltarPrevia(): void {
    if (this.fotoPrevia) URL.revokeObjectURL(this.fotoPrevia);
    this.fotoPrevia = null;
  }

  async agregarParticipante(): Promise<void> {
    const ok = await this.hacer('participante',
      () => this.concursoService.agregarParticipante({ nombre: this.nombre, mensaje: this.mensaje, foto: this.foto }),
      'Participante agregado.', 'No se pudo agregar al participante.');
    if (ok) {
      this.nombre = '';
      this.mensaje = '';
      this.foto = null;
      this.soltarPrevia();
    }
  }

  eliminarParticipante(p: Participante): Promise<boolean> {
    return this.hacer('quitar-participante', () => this.concursoService.eliminarParticipante(p.id!),
      'Participante eliminado.', 'No se pudo eliminar al participante.');
  }

  // ----- Jurados
  async agregarJurado(): Promise<void> {
    const ok = await this.hacer('jurado', () => this.concursoService.agregarJurado(this.correoJurado),
      'Jurado agregado.', 'No se pudo agregar al jurado.');
    if (ok) this.correoJurado = '';
  }

  quitarJurado(j: Jurado): Promise<boolean> {
    return this.hacer('quitar-jurado', () => this.concursoService.quitarJurado(j.correo),
      'Jurado quitado.', 'No se pudo quitar al jurado.');
  }

  // ----- Resultados
  porcentaje(votos: number): number {
    return this.resultado.votaron > 0 ? Math.round((votos / this.resultado.votaron) * 100) : 0;
  }

  get nombresGanadores(): string {
    return this.resultado.ganadores.map(g => g.nombre).join(' y ');
  }

  get votosGanador(): number {
    return this.resultado.porParticipante[0]?.votos ?? 0;
  }

  // ----- Limpieza
  borrarTodo(): Promise<boolean> {
    return this.hacer('borrar', () => this.concursoService.borrarTodo(),
      'Concurso borrado.', 'No se pudo borrar el concurso.');
  }

  trackById(_: number, p: Participante): string | undefined {
    return p.id;
  }

  trackByCorreo(_: number, j: Jurado): string {
    return j.correo;
  }

  trackByResultado(_: number, r: { participante: Participante }): string | undefined {
    return r.participante.id;
  }

  // Una sola acción a la vez. Los errores de validación (ya redactados) se
  // muestran tal cual; los de Firestore, con un texto genérico.
  private async hacer(clave: string, accion: () => Promise<unknown>, exito: string, falla: string): Promise<boolean> {
    if (this.trabajando) return false;
    this.trabajando = clave;
    try {
      await accion();
      this.message.success(exito);
      return true;
    } catch (error: any) {
      console.error(falla, error);
      this.message.error(error?.code || !error?.message ? falla : error.message);
      return false;
    } finally {
      this.trabajando = null;
    }
  }
}
