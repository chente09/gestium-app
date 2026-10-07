import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzMessageService } from 'ng-zorro-antd/message';

import { Coactivado } from '../../../services/coactivados/coactivados.service';
import { esCedulaValida, normalizarCedula } from '../../../services/coactivados/coactivados.util';
import { GestionCoactivado } from '../../../services/gestionesCoactivado/gestiones-coactivado.service';
import { SharedDataService } from '../../../services/sharedData/shared-data.service';
import { TitulosCreditoService } from '../../../services/titulosCredito/titulos-credito.service';
import {
  TituloCredito,
  esAnulado,
  esCancelado,
  esEnConvenio,
  estadoVisual
} from '../../../services/titulosCredito/titulos-credito.util';
import {
  ASUNTO_AVISO,
  GeneroFirma,
  armarAvisoPreCoactivo,
  formatoCapitalAviso
} from '../../../services/correosIess/aviso-precoactivo.template';
import {
  MAX_DESTINATARIOS,
  esCorreoValido,
  esEmpresa,
  separarCorreos,
  separarNumerosTitulo,
  sumarCapital,
  ultimoAvisoEnviado
} from '../../../services/correosIess/correos-iess.util';
import { CorreosIessService, ResultadoEnvio } from '../../../services/correosIess/correos-iess.service';

// Un título es "vigente" (o sea, se le puede cobrar al coactivado) mientras no
// esté cancelado, en convenio ni anulado. Es el filtro con el que arranca el
// aviso, pero quien lo envía revisa y decide caso por caso.
const esVigente = (t: TituloCredito): boolean => !esCancelado(t) && !esEnConvenio(t) && !esAnulado(t);

interface AvisoAgregar {
  tipo: 'success' | 'warning' | 'error';
  texto: string;
}

@Component({
  selector: 'app-aviso-precoactivo-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzModalModule,
    NzAlertModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    NzCollapseModule
  ],
  templateUrl: './aviso-precoactivo-modal.component.html',
  styleUrl: './aviso-precoactivo-modal.component.css'
})
export class AvisoPrecoactivoModalComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  // Para completar el representante legal: la ficha es quien lo guarda.
  @Output() editarCoactivado = new EventEmitter<void>();
  @Input({ required: true }) coactivado!: Coactivado;
  @Input() titulos: TituloCredito[] = [];
  @Input() gestiones: GestionCoactivado[] = [];

  readonly maxDestinatarios = MAX_DESTINATARIOS;
  readonly separadores = [',', ';', ' '];
  readonly asunto = ASUNTO_AVISO;
  readonly formatoCapitalAviso = formatoCapitalAviso;
  readonly estadoVisual = estadoVisual;

  destinatarios: string[] = [];
  invalidos: string[] = [];
  titulosOrdenados: TituloCredito[] = []; // para revisar: lo agregado y los vigentes primero
  seleccion = new Set<string>();
  titulosSeleccionados: TituloCredito[] = []; // en el orden en que salen en el correo
  capital = 0;
  todosMarcados = false;
  algunosMarcados = false;
  hayNoVigentes = false;
  hayAbonos = false;

  // Empresa: el aviso va dirigido al representante legal que está en la ficha.
  esEmpresa = false;
  representante = '';
  datosSospechosos: string[] = [];

  genero: GeneroFirma | null = null;
  ultimoAviso: Date | null = null;
  vistaPrevia: SafeHtml = '';
  motivoBloqueo: string | null = null;

  // Agregar títulos que no son de este coactivado.
  numerosNuevos = '';
  rucNuevo = '';
  buscandoTc = false;
  avisoAgregar: AvisoAgregar | null = null;

  enviando = false;
  resultado: ResultadoEnvio | null = null;

  constructor(
    private correosService: CorreosIessService,
    private titulosService: TitulosCreditoService,
    private sharedData: SharedDataService,
    private sanitizer: DomSanitizer,
    private message: NzMessageService
  ) { }

  // Cada vez que se abre arranca de cero: los correos del coactivado y todos
  // sus títulos vigentes marcados. Los títulos se siguen actualizando en la
  // ficha mientras el modal está abierto, pero la selección ya hecha no se toca.
  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['visible'] && this.visible) this.inicializar();
  }

  private inicializar(): void {
    this.resultado = null;
    this.enviando = false;
    this.numerosNuevos = '';
    this.rucNuevo = '';
    this.avisoAgregar = null;
    this.genero = this.sharedData.getGeneroAbogadoIess(this.coactivado.cartera);
    this.ultimoAviso = ultimoAvisoEnviado(this.gestiones);
    this.destinatarios = separarCorreos(this.coactivado.correo);

    this.esEmpresa = esEmpresa(this.coactivado.cedula);
    this.representante = (this.coactivado.representanteLegal ?? '').trim();
    // Un "?" en el nombre suele ser una tilde o una Ñ dañada al importar el
    // Excel ("LIQUIDACI?N"): saldría tal cual en el correo.
    this.datosSospechosos = [this.coactivado.nombre, this.representante].filter(t => t.includes('?'));

    this.titulosOrdenados = [...this.titulos].sort((a, b) =>
      Number(!esVigente(a)) - Number(!esVigente(b)) ||
      (a.guia ?? '').localeCompare(b.guia ?? '') ||
      a.numero.localeCompare(b.numero, undefined, { numeric: true })
    );
    this.seleccion = new Set(this.titulosOrdenados.filter(esVigente).map(t => t.numero));
    this.recalcular();
  }

  cambiarDestinatarios(valores: string[]): void {
    this.destinatarios = separarCorreos((valores ?? []).join(' '));
    this.recalcular();
  }

  alternar(numero: string, marcado: boolean): void {
    if (marcado) this.seleccion.add(numero);
    else this.seleccion.delete(numero);
    this.recalcular();
  }

  marcarTodos(marcado: boolean): void {
    this.seleccion = new Set(marcado ? this.titulosOrdenados.map(t => t.numero) : []);
    this.recalcular();
  }

  marcarVigentes(): void {
    this.seleccion = new Set(this.titulosOrdenados.filter(esVigente).map(t => t.numero));
    this.recalcular();
  }

  trackByTitulo(_: number, t: TituloCredito): string {
    return t.numero;
  }

  // Un título de otro coactivado (agregado a mano): se marca con su RUC.
  esDeOtro(t: TituloCredito): boolean {
    return t.coactivadoId !== this.coactivado.cedula;
  }

  // ============================================
  // ➕ Agregar títulos que ya están en el sistema
  // ============================================

  // Por número: lo que se pide expresamente queda marcado, aunque esté
  // cancelado (la advertencia de "cancelados marcados" avisa).
  async agregarPorNumeros(): Promise<void> {
    if (this.buscandoTc) return;
    const { numeros, invalidos } = separarNumerosTitulo(this.numerosNuevos);
    if (numeros.length === 0 && invalidos.length === 0) return;

    if (numeros.length === 0) {
      this.avisoAgregar = { tipo: 'error', texto: `No son números de título: ${invalidos.join(', ')}.` };
      return;
    }

    const yaEstaban = numeros.filter(n => this.titulosOrdenados.some(t => t.numero === n));
    const buscar = numeros.filter(n => !yaEstaban.includes(n));

    this.buscandoTc = true;
    try {
      const encontrados = buscar.length > 0 ? await this.titulosService.getPorNumeros(buscar) : [];
      const noEncontrados = buscar.filter(n => !encontrados.some(t => t.numero === n));
      this.incorporar(encontrados, () => true);

      const partes: string[] = [];
      if (encontrados.length > 0) partes.push(`Se agregaron ${encontrados.length} título(s).`);
      if (yaEstaban.length > 0) partes.push(`Ya estaban en la lista: ${yaEstaban.join(', ')}.`);
      if (noEncontrados.length > 0) partes.push(`No existen en el sistema: ${noEncontrados.join(', ')}.`);
      if (invalidos.length > 0) partes.push(`No son números de título: ${invalidos.join(', ')}.`);
      this.avisoAgregar = {
        tipo: encontrados.length > 0 && partes.length === 1 ? 'success' : encontrados.length > 0 ? 'warning' : 'error',
        texto: partes.join(' ')
      };
      if (noEncontrados.length === 0 && invalidos.length === 0) this.numerosNuevos = '';
    } catch (error) {
      console.error('Error buscando títulos por número:', error);
      this.avisoAgregar = { tipo: 'error', texto: 'No se pudo buscar. Intenta de nuevo.' };
    } finally {
      this.buscandoTc = false;
    }
  }

  // Por cédula/RUC de otro coactivado: trae todos sus títulos pero solo marca
  // los vigentes; el resto queda a la vista para marcarlo si hace falta.
  async agregarPorRuc(): Promise<void> {
    if (this.buscandoTc) return;
    const ruc = normalizarCedula(this.rucNuevo);
    if (!ruc) return;

    if (!esCedulaValida(ruc)) {
      this.avisoAgregar = { tipo: 'error', texto: 'Escribe una cédula (10 dígitos) o un RUC (13 dígitos).' };
      return;
    }
    if (ruc === this.coactivado.cedula) {
      this.avisoAgregar = { tipo: 'warning', texto: 'Ese es este mismo coactivado: sus títulos ya están en la lista.' };
      return;
    }

    this.buscandoTc = true;
    try {
      const delRuc = await this.titulosService.getDeCoactivado(ruc);
      const nuevos = delRuc.filter(t => !this.titulosOrdenados.some(x => x.numero === t.numero));

      if (delRuc.length === 0) {
        this.avisoAgregar = { tipo: 'error', texto: `No hay títulos registrados para ${ruc}.` };
      } else if (nuevos.length === 0) {
        this.avisoAgregar = { tipo: 'warning', texto: 'Todos esos títulos ya estaban en la lista.' };
      } else {
        this.incorporar(nuevos, esVigente);
        const marcados = nuevos.filter(esVigente).length;
        this.avisoAgregar = {
          tipo: 'success',
          texto: `Se agregaron ${nuevos.length} título(s) del ${ruc}; ${marcados} vigente(s) quedaron marcados.`
        };
        this.rucNuevo = '';
      }
    } catch (error) {
      console.error('Error buscando títulos por RUC:', error);
      this.avisoAgregar = { tipo: 'error', texto: 'No se pudo buscar. Intenta de nuevo.' };
    } finally {
      this.buscandoTc = false;
    }
  }

  // Arriba de la lista, para que se vean sin tener que bajar la tabla.
  private incorporar(nuevos: TituloCredito[], marcar: (t: TituloCredito) => boolean): void {
    if (nuevos.length === 0) return;
    const ordenados = [...nuevos].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
    this.titulosOrdenados = [...ordenados, ...this.titulosOrdenados];
    ordenados.filter(marcar).forEach(t => this.seleccion.add(t.numero));
    this.recalcular();
  }

  // ============================================

  // Todo lo que depende de lo marcado o escrito se calcula acá, una vez por
  // cambio, y no en getters que Angular evaluaría en cada ciclo (la vista
  // previa es un iframe: reasignarla en cada ciclo lo haría parpadear).
  private recalcular(): void {
    this.invalidos = this.destinatarios.filter(c => !esCorreoValido(c));

    this.titulosSeleccionados = this.titulosOrdenados
      .filter(t => this.seleccion.has(t.numero))
      .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
    this.capital = sumarCapital(this.titulosSeleccionados);
    this.hayNoVigentes = this.titulosSeleccionados.some(t => !esVigente(t));
    this.hayAbonos = this.titulosSeleccionados.some(t => t.tipoCancelacion === 'abono');

    const total = this.titulosOrdenados.length;
    this.todosMarcados = total > 0 && this.seleccion.size === total;
    this.algunosMarcados = this.seleccion.size > 0 && this.seleccion.size < total;

    this.motivoBloqueo = this.calcularMotivoBloqueo();
    this.vistaPrevia = this.armarVistaPrevia();
  }

  private calcularMotivoBloqueo(): string | null {
    if (!this.genero) return `Falta configurar el género de la firma de la cartera "${this.coactivado.cartera}".`;
    if (this.esEmpresa && !this.representante) return 'Falta el representante legal de la empresa.';
    if (this.destinatarios.length === 0) return 'Agrega al menos un correo.';
    if (this.invalidos.length > 0) return 'Corrige o quita los correos que no son válidos.';
    if (this.destinatarios.length > this.maxDestinatarios) return `Máximo ${this.maxDestinatarios} destinatarios por aviso.`;
    if (this.titulosSeleccionados.length === 0) return 'Marca al menos un título.';
    return null;
  }

  // Solo las empresas van dirigidas al representante; una persona natural, a
  // su propio nombre.
  private get representanteParaAviso(): string | undefined {
    return this.esEmpresa ? this.representante : undefined;
  }

  // El mismo armado que usa el envío, así lo que se ve es lo que sale. El
  // HTML lo genera la plantilla (con los datos ya escapados), por eso es
  // seguro pasarlo al iframe; además el iframe va sin permisos (sandbox).
  private armarVistaPrevia(): SafeHtml {
    if (!this.genero || this.titulosSeleccionados.length === 0) return '';
    const { html } = armarAvisoPreCoactivo({
      nombre: this.coactivado.nombre,
      ruc: this.coactivado.cedula,
      capital: this.capital,
      titulos: this.titulosSeleccionados.map(t => t.numero),
      abogado: this.coactivado.cartera,
      generoAbogado: this.genero,
      representanteLegal: this.representanteParaAviso
    });
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  // Cierra este modal y abre la edición de la ficha, que es donde se guarda
  // el representante legal.
  irAEditarFicha(): void {
    if (this.enviando) return;
    this.cerrar();
    this.editarCoactivado.emit();
  }

  cerrar(): void {
    if (this.enviando) return;
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async enviar(): Promise<void> {
    if (this.enviando || this.motivoBloqueo || !this.genero) return;
    this.enviando = true;
    this.resultado = null;

    try {
      const r = await this.correosService.enviarAviso({
        coactivado: { cedula: this.coactivado.cedula, nombre: this.coactivado.nombre, cartera: this.coactivado.cartera },
        abogado: { nombre: this.coactivado.cartera, genero: this.genero },
        representanteLegal: this.representanteParaAviso,
        destinatarios: this.destinatarios,
        titulos: this.titulosSeleccionados.map(t => ({ numero: t.numero, capital: t.capital }))
      });
      this.resultado = r;

      if (r.estado === 'enviado') {
        this.message.success(`Aviso enviado a ${r.aceptados.join(', ')}.`);
        if (r.rechazados.length > 0) this.message.warning(`Gmail no aceptó: ${r.rechazados.join(', ')}.`, { nzDuration: 8000 });
        if (r.errorGestion) {
          this.message.warning(`El correo salió, pero no se pudo registrar la gestión (${r.errorGestion}). Regístrala a mano como Correo.`, { nzDuration: 10000 });
        }
        this.enviando = false;
        this.cerrar();
        return;
      }
    } catch (error: any) {
      console.error('Error enviando el aviso pre-coactivo:', error);
      this.resultado = {
        estado: 'error',
        mailId: '',
        detalle: error?.message || 'No se pudo enviar el aviso.',
        aceptados: [],
        rechazados: []
      };
    }
    this.enviando = false;
  }
}
