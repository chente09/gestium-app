import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, Subscription, from } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { NzAutocompleteModule } from 'ng-zorro-antd/auto-complete';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzMessageService } from 'ng-zorro-antd/message';

import { Register, RegistersService } from '../../services/registers/registers.service';
import { DateUtilsService } from '../../services/date-utils/date-utils.service';
import { Coactivado, CoactivadosService } from '../../services/coactivados/coactivados.service';
import { esCedulaValida, normalizarCedula } from '../../services/coactivados/coactivados.util';
import { TramitesIessService } from '../../services/tramitesIess/tramites-iess.service';
import {
  CONCEPTOS_TERCERO,
  CostoTercero,
  DatosTramite,
  DefEtapa,
  ETIQUETAS_ESPERANDO,
  EsperandoA,
  EstadoEtapa,
  EstadoTramite,
  EtapaVista,
  FiltrosTramites,
  GestionTramite,
  GrupoCliente,
  PagoTramite,
  ResumenTramites,
  TIPOS_TRAMITE,
  TipoTramite,
  TotalesCosto,
  TotalesTramite,
  Tramite,
  aFecha,
  agruparPorCliente,
  claveCliente,
  conceptoSugerido,
  defTipo,
  diasSinMovimiento,
  esperandoA,
  etapaActual,
  etapasDe,
  etiquetaTipo,
  filtrarTramites,
  nombreConcepto,
  progresoEtapas,
  redondear,
  requiereSeguimiento,
  resumenDe,
  totalesCosto,
  totalesDe
} from '../../services/tramitesIess/tramites-iess.util';
import {
  AvisoImportacion,
  LecturaTramites,
  TramiteImportable,
  armarTramite,
  leerTramites,
  marcarDuplicados,
  origenesRadiografia
} from '../../services/tramitesIess/importador-tramites.util';
import { fechaCorta, formatoMoneda } from '../../services/titulosCredito/titulos-credito.util';
import { leerArchivoTablas } from '../iess-titulos/lector-archivo.util';
import { IessNavComponent } from '../../components/iess-nav/iess-nav.component';
import { descargarPlantillaTramites } from './plantilla-tramites.export';

// Una fila de la tabla, con todo lo calculado una sola vez (no en cada revisión).
interface FilaTramite {
  t: Tramite;
  tot: TotalesTramite;
  etapa: DefEtapa | null;
  progreso: { hechas: number; total: number };
  esperando: EsperandoA | null;
  dias: number | null;
  seguimiento: boolean;
}

// Un cliente con sus trámites (las etapas de su caso), listos para la tabla.
interface GrupoVista {
  g: GrupoCliente;
  filas: FilaTramite[];
}

interface PagoFila { pago: PagoTramite; indice: number }

// Lo que muestra la ficha abierta, calculado cuando cambia el trámite.
interface FichaVista {
  t: Tramite;
  tot: TotalesTramite;
  etapas: EtapaVista[];
  etapaActualId: string | null;
  progreso: { hechas: number; total: number };
  esperando: EsperandoA | null;
  pagos: PagoFila[];
  costos: { costo: CostoTercero; tot: TotalesCosto; pagos: PagoFila[] }[];
  gestiones: (Omit<GestionTramite, 'fecha'> & { fecha?: Date })[];
}

// Vista previa de la importación: lo que traería cada fila del Excel, agrupado por cliente.
interface FilaPrevia {
  item: TramiteImportable;
  tramite: Omit<Tramite, 'id'>;
  tot: TotalesTramite;
  etapaTexto: string;
  esperando: EsperandoA | null;
  duplicado: boolean;
  radiografiaFila: number | null; // fila de la radiografía con la que se enlaza
}

interface GrupoPrevia { clave: string; nombre: string; ruc?: string; filas: FilaPrevia[] }

interface PreviaImportacion {
  grupos: GrupoPrevia[];
  nuevos: TramiteImportable[];
  duplicados: number;
  errores: AvisoImportacion[];
  avisos: AvisoImportacion[];
}

@Component({
  selector: 'app-iess-tramites',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NzAutocompleteModule,
    NzCardModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    NzTabsModule,
    NzTimelineModule,
    NzModalModule,
    NzSwitchModule,
    NzPopconfirmModule,
    NzToolTipModule,
    NzAlertModule,
    NzEmptyModule,
    NzStatisticModule,
    NzBreadCrumbModule,
    IessNavComponent
  ],
  templateUrl: './iess-tramites.component.html',
  styleUrl: './iess-tramites.component.css'
})
export class IessTramitesComponent implements OnInit, OnDestroy {
  readonly tipos = TIPOS_TRAMITE;
  readonly conceptos = CONCEPTOS_TERCERO;
  readonly esperandoOpciones = (Object.keys(ETIQUETAS_ESPERANDO) as EsperandoA[]).map(id => ({ id, ...ETIQUETAS_ESPERANDO[id] }));
  readonly etiquetasEsperando = ETIQUETAS_ESPERANDO;
  readonly formatoMoneda = formatoMoneda;
  readonly fechaCorta = fechaCorta;
  readonly etiquetaTipo = etiquetaTipo;
  readonly nombreConcepto = nombreConcepto;
  readonly hoy: string;

  esAdmin = false;
  cargando = true;
  trabajando: string | null = null; // qué acción está guardando (para el botón)

  private suscripcion?: Subscription;
  tramites: Tramite[] = [];
  resumen: ResumenTramites = { enCurso: 0, porCobrar: 0, porPagarTerceros: 0, sinMovimiento: 0 };
  grupos: GrupoVista[] = [];
  expandidos = new Set<string>();
  filtros: FiltrosTramites = { texto: '', tipo: null, estado: 'en_curso', esperandoA: null, soloSinMovimiento: false };

  // Nuevo trámite
  mostrarNuevo = false;
  formNuevo: FormGroup;
  private origenNuevo: string | null = null;
  // Buscador de clientes en las carteras (coactivados)
  sugerencias: Coactivado[] = [];
  sinCoincidencias = false;
  private busquedaCliente$ = new Subject<string>();
  private busquedaSuscripcion?: Subscription;

  // Ficha
  mostrarFicha = false;
  fichaId: string | null = null;
  private fichaPreparada: string | null = null;
  vista: FichaVista | null = null;
  pestana = 0;
  formDatos: FormGroup;
  formSeguimiento: FormGroup;
  formHonorario: FormGroup;
  formPago: FormGroup;
  formCosto: FormGroup;
  formPagoTercero: FormGroup;
  mostrarFormCosto = false;
  costoEditandoId: string | null = null;
  costoPagandoId: string | null = null;
  textoGestion = '';
  motivoCierre = '';

  // Acceso (solo admin)
  mostrarAcceso = false;
  cargandoAcceso = false;
  usuariosIess: Register[] = [];
  cambiandoAcceso: string | null = null;

  // Importar desde Excel (solo admin)
  mostrarImportar = false;
  leyendoArchivo = false;
  descargandoPlantilla = false;
  nombreArchivo = '';
  previa: PreviaImportacion | null = null;

  constructor(
    private fb: FormBuilder,
    private tramitesService: TramitesIessService,
    private registersService: RegistersService,
    private coactivadosService: CoactivadosService,
    private dateUtils: DateUtilsService,
    private message: NzMessageService
  ) {
    this.hoy = this.dateUtils.getFechaActualEcuador();

    this.formNuevo = this.fb.group({
      clienteNombre: ['', Validators.required],
      clienteRuc: [''],
      telefono: [''],
      contacto: [''],
      tipo: [null as TipoTramite | null, Validators.required],
      tipoDetalle: [''],
      honorario: [null as number | null]
    });
    this.formDatos = this.fb.group({
      clienteNombre: ['', Validators.required],
      clienteRuc: [''],
      telefono: [''],
      contacto: [''],
      tipo: [null as TipoTramite | null, Validators.required],
      tipoDetalle: [''],
      nroIngreso: [''],
      fechaPresentacion: [''],
      nroResolucion: [''],
      fechaResolucion: ['']
    });
    this.formSeguimiento = this.fb.group({
      esperandoAManual: [null as EsperandoA | null],
      pendiente: ['']
    });
    this.formHonorario = this.fb.group({
      honorario: [0 as number | null],
      montoAnular: [null as number | null],
      porcentaje: [null as number | null]
    });
    this.formPago = this.fb.group({
      monto: [null as number | null, [Validators.required, Validators.min(0.01)]],
      fecha: [this.hoy, Validators.required],
      comprobante: [''],
      nota: ['']
    });
    this.formCosto = this.fb.group({
      concepto: ['otro', Validators.required],
      tercero: ['', Validators.required],
      detalle: [''],
      monto: [null as number | null, [Validators.required, Validators.min(0.01)]]
    });
    this.formPagoTercero = this.fb.group({
      monto: [null as number | null, [Validators.required, Validators.min(0.01)]],
      fecha: [this.hoy, Validators.required],
      comprobante: [''],
      nota: ['']
    });
  }

  ngOnInit(): void {
    this.esAdmin = this.registersService.isCurrentUserAdmin();
    this.busquedaSuscripcion = this.busquedaCliente$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(texto => from(this.buscarCoactivados(texto)))
    ).subscribe(lista => {
      this.sugerencias = lista ?? [];
      this.sinCoincidencias = lista !== null && lista.length === 0;
    });
    this.suscripcion =this.tramitesService.getTramites().subscribe({
      next: lista => {
        this.tramites = lista;
        this.cargando = false;
        this.recalcular();
      },
      error: error => {
        console.error('Error cargando los trámites:', error);
        this.cargando = false;
        this.message.error('No se pudieron cargar los trámites.');
      }
    });
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
    this.busquedaSuscripcion?.unsubscribe();
  }

  // ============================================
  // 📋 Lista
  // ============================================
  private recalcular(): void {
    this.resumen = resumenDe(this.tramites, new Date());
    this.refiltrar();
    this.actualizarFicha();
  }

  refiltrar(): void {
    const ahora = new Date();
    // El estado filtra casos (se aplica al agrupar), no etapas sueltas.
    const visibles = filtrarTramites(this.tramites, { ...this.filtros, estado: null }, ahora);
    this.grupos = agruparPorCliente(visibles, this.tramites, ahora, this.filtros.estado ?? null).map(g => ({
      g,
      filas: g.tramites.map(t => ({
        t,
        tot: totalesDe(t),
        etapa: etapaActual(t),
        progreso: progresoEtapas(t),
        esperando: esperandoA(t),
        dias: diasSinMovimiento(t, ahora),
        seguimiento: requiereSeguimiento(t, ahora)
      }))
    }));
  }

  alternar(clave: string, abierto: boolean): void {
    if (abierto) this.expandidos.add(clave);
    else this.expandidos.delete(clave);
  }

  // Las tarjetas de arriba también sirven de atajo para filtrar.
  verEnCurso(): void {
    this.filtros = { ...this.filtros, estado: 'en_curso', soloSinMovimiento: false };
    this.refiltrar();
  }

  alternarSinMovimiento(): void {
    this.filtros = { ...this.filtros, estado: 'en_curso', soloSinMovimiento: !this.filtros.soloSinMovimiento };
    this.refiltrar();
  }

  get hayFiltros(): boolean {
    const f = this.filtros;
    return !!(f.texto || f.tipo || f.esperandoA || f.soloSinMovimiento || f.estado !== 'en_curso');
  }

  limpiarFiltros(): void {
    this.filtros = { texto: '', tipo: null, estado: 'en_curso', esperandoA: null, soloSinMovimiento: false };
    this.refiltrar();
  }

  colorTipo(tipo: TipoTramite): string {
    return defTipo(tipo).color;
  }

  // De una etapa del caso (un trámite): completa no es lo mismo que caso terminado.
  estadoTexto(estado: EstadoTramite): string {
    return estado === 'en_curso' ? 'En curso' : estado === 'terminado' ? 'Completada' : 'Desistió';
  }

  // Del caso completo del cliente.
  estadoCasoTexto(estado: EstadoTramite): string {
    return estado === 'en_curso' ? 'En curso' : estado === 'terminado' ? 'Caso terminado' : 'Desistió';
  }

  estadoColor(estado: EstadoTramite): string {
    return estado === 'en_curso' ? 'processing' : estado === 'terminado' ? 'success' : 'default';
  }

  readonly ordenarPorNombre = (a: GrupoVista, b: GrupoVista): number => a.g.nombre.localeCompare(b.g.nombre);
  readonly ordenarPorHonorario = (a: GrupoVista, b: GrupoVista): number => a.g.honorario - b.g.honorario;
  readonly ordenarPorPorCobrar = (a: GrupoVista, b: GrupoVista): number => a.g.porCobrar - b.g.porCobrar;
  readonly ordenarPorPorPagar = (a: GrupoVista, b: GrupoVista): number => a.g.porPagarTerceros - b.g.porPagarTerceros;
  readonly ordenarPorDias = (a: GrupoVista, b: GrupoVista): number => (a.g.dias ?? -1) - (b.g.dias ?? -1);

  trackByGrupo(_: number, v: GrupoVista): string {
    return v.g.clave;
  }

  trackByFila(_: number, f: FilaTramite): string | undefined {
    return f.t.id;
  }

  // ============================================
  // ➕ Nuevo trámite
  // ============================================
  abrirNuevo(prefill?: Partial<DatosTramite>): void {
    this.formNuevo.reset({
      clienteNombre: prefill?.clienteNombre ?? '',
      clienteRuc: prefill?.clienteRuc ?? '',
      telefono: prefill?.telefono ?? '',
      contacto: prefill?.contacto ?? '',
      tipo: null,
      tipoDetalle: '',
      honorario: null
    });
    this.origenNuevo = prefill?.origenTramiteId ?? null;
    this.sugerencias = [];
    this.sinCoincidencias = false;
    this.busquedaCliente$.next(''); // para que la primera búsqueda de esta vez no se descarte por repetida
    this.mostrarNuevo = true;
  }

  // Los clientes de los casos suelen ser coactivados de las carteras: se
  // buscan por lo que se escribe (nombre, RUC o cédula), sin cargar la base.
  buscarCliente(texto: string): void {
    this.busquedaCliente$.next(texto);
  }

  // null = todavía no hay qué buscar (poco texto o un RUC a medias).
  private async buscarCoactivados(texto: string): Promise<Coactivado[] | null> {
    const termino = texto.trim();
    const digitos = normalizarCedula(termino);
    try {
      if (/^\d+$/.test(digitos)) {
        if (!esCedulaValida(digitos)) return null;
        const coactivado = await this.coactivadosService.getByCedula(digitos);
        return coactivado ? [coactivado] : [];
      }
      if (termino.length < 3) return null;
      return await this.coactivadosService.buscarPorNombre(termino);
    } catch (error) {
      console.error('Error buscando en las carteras:', error);
      return null;
    }
  }

  // Lo que el coactivado ya tiene se copia; lo que no tiene se deja como estaba.
  elegirCoactivado(cedula: string): void {
    const coactivado = this.sugerencias.find(c => c.cedula === cedula);
    if (!coactivado) return;
    // Al elegir, el buscador deja la cédula en el campo: se espera a que termine para poner los datos.
    setTimeout(() => {
      this.formNuevo.patchValue({
        clienteNombre: coactivado.nombre,
        clienteRuc: coactivado.cedula,
        ...(coactivado.telefono ? { telefono: coactivado.telefono } : {}),
        ...(coactivado.representanteLegal ? { contacto: coactivado.representanteLegal } : {})
      });
      this.sugerencias = [];
      this.sinCoincidencias = false;
    });
  }

  // Otra etapa del caso del cliente: nace con sus datos y, si tiene una sola
  // radiografía, enlazada a ella.
  agregarEtapa(grupo: GrupoCliente): void {
    const radiografias = grupo.tramites.filter(t => t.tipo === 'radiografia');
    this.abrirNuevo({
      clienteNombre: grupo.nombre,
      clienteRuc: grupo.clienteRuc,
      telefono: grupo.telefono,
      contacto: grupo.contacto,
      origenTramiteId: radiografias.length === 1 ? radiografias[0].id : undefined
    });
  }

  cancelarNuevo(): void {
    this.mostrarNuevo = false;
  }

  async guardarNuevo(): Promise<void> {
    if (this.formNuevo.invalid) {
      this.formNuevo.markAllAsTouched();
      return;
    }
    const v = this.formNuevo.value;
    let id: string | null = null;
    const ok = await this.hacer('nuevo', async () => {
      id = await this.tramitesService.crear({ ...v, honorario: v.honorario ?? 0, origenTramiteId: this.origenNuevo });
    }, 'Trámite creado.', 'No se pudo crear el trámite.');

    if (ok && id) {
      this.mostrarNuevo = false;
      this.abrirFichaPorId(id);
    }
  }

  // ============================================
  // 🗂️ Ficha
  // ============================================
  abrirFicha(t: Tramite): void {
    if (t.id) this.abrirFichaPorId(t.id);
  }

  private abrirFichaPorId(id: string): void {
    this.fichaId = id;
    this.fichaPreparada = null; // vuelve a llenar los formularios con este trámite
    this.pestana = 0;
    this.mostrarFormCosto = false;
    this.costoEditandoId = null;
    this.costoPagandoId = null;
    this.textoGestion = '';
    this.motivoCierre = '';
    this.mostrarFicha = true;
    this.actualizarFicha();
  }

  cerrarFicha(): void {
    this.mostrarFicha = false;
    this.fichaId = null;
    this.vista = null;
  }

  // Se recalcula cada vez que Firestore avisa un cambio: tras guardar, la
  // ficha se actualiza sola. Los formularios solo se llenan al abrirla (para
  // no pisar lo que se está escribiendo).
  private actualizarFicha(): void {
    if (!this.fichaId) return;
    const t = this.tramites.find(x => x.id === this.fichaId);
    if (!t) {
      // Todavía no llegó el trámite recién creado, o alguien lo borró.
      if (!this.cargando && this.fichaPreparada === this.fichaId) this.cerrarFicha();
      return;
    }

    const etapas = etapasDe(t);
    const actual = etapaActual(t);
    const conIndice = (pagos: PagoTramite[] | undefined): PagoFila[] => (pagos ?? []).map((pago, indice) => ({ pago, indice }));

    this.vista = {
      t,
      tot: totalesDe(t),
      etapas,
      etapaActualId: actual?.id ?? null,
      progreso: progresoEtapas(t),
      esperando: esperandoA(t),
      pagos: conIndice(t.pagos),
      costos: (t.costosTerceros ?? []).map(costo => ({ costo, tot: totalesCosto(costo), pagos: conIndice(costo.pagos) })),
      gestiones: [...(t.gestiones ?? [])].reverse().map(g => ({ ...g, fecha: aFecha(g.fecha) }))
    };

    if (this.fichaPreparada !== t.id) {
      this.fichaPreparada = t.id ?? null;
      this.llenarFormularios(t);
    }
  }

  private llenarFormularios(t: Tramite): void {
    this.formDatos.reset({
      clienteNombre: t.clienteNombre,
      clienteRuc: t.clienteRuc ?? '',
      telefono: t.telefono ?? '',
      contacto: t.contacto ?? '',
      tipo: t.tipo,
      tipoDetalle: t.tipoDetalle ?? '',
      nroIngreso: t.nroIngreso ?? '',
      fechaPresentacion: t.fechaPresentacion ?? '',
      nroResolucion: t.nroResolucion ?? '',
      fechaResolucion: t.fechaResolucion ?? ''
    });
    this.formSeguimiento.reset({ esperandoAManual: t.esperandoAManual ?? null, pendiente: t.pendiente ?? '' });
    this.formHonorario.reset({ honorario: t.honorario, montoAnular: t.montoAnular ?? null, porcentaje: t.porcentaje ?? null });
    this.formPago.reset({ monto: null, fecha: this.hoy, comprobante: '', nota: '' });
  }

  get tituloFicha(): string {
    return this.vista ? this.vista.t.clienteNombre : 'Trámite';
  }

  // ----- Datos
  async guardarDatos(): Promise<void> {
    if (!this.vista || this.formDatos.invalid) {
      this.formDatos.markAllAsTouched();
      return;
    }
    await this.hacer('datos', () => this.tramitesService.actualizarDatos(this.vista!.t.id!, this.formDatos.value),
      'Datos guardados.', 'No se pudieron guardar los datos.');
  }

  // Desde una radiografía terminada: el trámite siguiente nace con los datos del cliente.
  iniciarAnulacion(): void {
    if (!this.vista) return;
    const t = this.vista.t;
    this.cerrarFicha();
    this.abrirNuevo({
      clienteNombre: t.clienteNombre,
      clienteRuc: t.clienteRuc,
      telefono: t.telefono,
      contacto: t.contacto,
      origenTramiteId: t.id
    });
  }

  async eliminarTramite(): Promise<void> {
    if (!this.vista || !this.esAdmin) return;
    const id = this.vista.t.id!;
    const ok = await this.hacer('eliminar', () => this.tramitesService.eliminar(id), 'Trámite eliminado.', 'No se pudo eliminar el trámite.');
    if (ok) this.cerrarFicha();
  }

  // ----- Etapas y seguimiento
  async cambiarEtapa(e: EtapaVista, estado: EstadoEtapa): Promise<void> {
    if (!this.vista) return;
    await this.hacer('etapa', () => this.tramitesService.cambiarEtapa(this.vista!.t.id!, e.def.id, estado), '', 'No se pudo cambiar la etapa.');
  }

  async guardarSeguimiento(): Promise<void> {
    if (!this.vista) return;
    await this.hacer('seguimiento', () => this.tramitesService.actualizarDatos(this.vista!.t.id!, this.formSeguimiento.value),
      'Seguimiento guardado.', 'No se pudo guardar el seguimiento.');
  }

  async cerrar(estado: 'terminado' | 'desistido'): Promise<void> {
    if (!this.vista) return;
    const motivo = this.motivoCierre;
    const ok = await this.hacer('cierre', () => this.tramitesService.cerrar(this.vista!.t.id!, estado, motivo),
      estado === 'terminado' ? 'Etapa completada.' : 'Trámite marcado como desistido.', 'No se pudo cerrar el trámite.');
    if (ok) this.motivoCierre = '';
  }

  async reabrir(): Promise<void> {
    if (!this.vista) return;
    await this.hacer('cierre', () => this.tramitesService.reabrir(this.vista!.t.id!), 'Trámite reabierto.', 'No se pudo reabrir el trámite.');
  }

  get sinEtapasPendientes(): boolean {
    return !!this.vista && this.vista.t.estado === 'en_curso' && this.vista.etapaActualId === null;
  }

  // ----- Cobros al cliente
  calcularHonorario(): void {
    const { montoAnular, porcentaje } = this.formHonorario.value;
    if (montoAnular == null || porcentaje == null) {
      this.message.warning('Escribe el monto a anular y el porcentaje.');
      return;
    }
    this.formHonorario.patchValue({ honorario: redondear((montoAnular * porcentaje) / 100) });
  }

  async guardarHonorario(): Promise<void> {
    if (!this.vista) return;
    await this.hacer('honorario', () => this.tramitesService.actualizarDatos(this.vista!.t.id!, this.formHonorario.value),
      'Honorario guardado.', 'No se pudo guardar el honorario.');
  }

  async registrarPago(): Promise<void> {
    if (!this.vista) return;
    if (this.formPago.invalid) {
      this.formPago.markAllAsTouched();
      return;
    }
    const v = this.formPago.value;
    if (v.fecha > this.hoy) {
      this.message.warning('La fecha del cobro no puede ser futura.');
      return;
    }
    const ok = await this.hacer('pago', () => this.tramitesService.registrarPago(this.vista!.t.id!, v), 'Cobro registrado.', 'No se pudo registrar el cobro.');
    if (ok) this.formPago.reset({ monto: null, fecha: this.hoy, comprobante: '', nota: '' });
  }

  async reversarPago(indice: number): Promise<void> {
    if (!this.vista || !this.esAdmin) return;
    await this.hacer('reversar', () => this.tramitesService.reversarPago(this.vista!.t.id!, indice), 'Cobro reversado.', 'No se pudo reversar el cobro.');
  }

  // ----- Costos a terceros
  abrirCosto(costo?: CostoTercero): void {
    this.costoPagandoId = null;
    this.costoEditandoId = costo?.id ?? null;
    this.formCosto.reset({
      concepto: costo?.concepto ?? (this.vista ? conceptoSugerido(this.vista.t) : 'otro'),
      tercero: costo?.tercero ?? '',
      detalle: costo?.detalle ?? '',
      monto: costo?.monto ?? null
    });
    this.mostrarFormCosto = true;
  }

  cancelarCosto(): void {
    this.mostrarFormCosto = false;
    this.costoEditandoId = null;
  }

  async guardarCosto(): Promise<void> {
    if (!this.vista) return;
    if (this.formCosto.invalid) {
      this.formCosto.markAllAsTouched();
      return;
    }
    const ok = await this.hacer('costo', () => this.tramitesService.guardarCosto(this.vista!.t.id!, { ...this.formCosto.value, id: this.costoEditandoId ?? undefined }),
      this.costoEditandoId ? 'Costo actualizado.' : 'Costo agregado.', 'No se pudo guardar el costo.');
    if (ok) this.cancelarCosto();
  }

  async quitarCosto(costoId: string): Promise<void> {
    if (!this.vista || !this.esAdmin) return;
    await this.hacer('costo', () => this.tramitesService.quitarCosto(this.vista!.t.id!, costoId), 'Costo quitado.', 'No se pudo quitar el costo.');
  }

  abrirPagoTercero(costoId: string): void {
    this.cancelarCosto();
    this.costoPagandoId = costoId;
    this.formPagoTercero.reset({ monto: null, fecha: this.hoy, comprobante: '', nota: '' });
  }

  async guardarPagoTercero(): Promise<void> {
    if (!this.vista || !this.costoPagandoId) return;
    if (this.formPagoTercero.invalid) {
      this.formPagoTercero.markAllAsTouched();
      return;
    }
    const v = this.formPagoTercero.value;
    if (v.fecha > this.hoy) {
      this.message.warning('La fecha del pago no puede ser futura.');
      return;
    }
    const ok = await this.hacer('pagoTercero', () => this.tramitesService.registrarPagoTercero(this.vista!.t.id!, this.costoPagandoId!, v),
      'Pago registrado.', 'No se pudo registrar el pago.');
    if (ok) this.costoPagandoId = null;
  }

  async reversarPagoTercero(costoId: string, indice: number): Promise<void> {
    if (!this.vista || !this.esAdmin) return;
    await this.hacer('reversar', () => this.tramitesService.reversarPagoTercero(this.vista!.t.id!, costoId, indice), 'Pago reversado.', 'No se pudo reversar el pago.');
  }

  // ----- Gestiones
  async agregarGestion(): Promise<void> {
    if (!this.vista || !this.textoGestion.trim()) return;
    const texto = this.textoGestion;
    const ok = await this.hacer('gestion', () => this.tramitesService.agregarGestion(this.vista!.t.id!, texto), '', 'No se pudo agregar la gestión.');
    if (ok) this.textoGestion = '';
  }

  // ============================================
  // 📥 Importar desde Excel (solo admin)
  // ============================================
  abrirImportar(): void {
    if (!this.esAdmin) return;
    this.previa = null;
    this.nombreArchivo = '';
    this.mostrarImportar = true;
  }

  cerrarImportar(): void {
    if (this.trabajando === 'importar') return;
    this.mostrarImportar = false;
    this.previa = null;
  }

  async descargarPlantilla(): Promise<void> {
    this.descargandoPlantilla = true;
    try {
      await descargarPlantillaTramites();
    } catch (error) {
      console.error('Error generando la plantilla:', error);
      this.message.error('No se pudo generar la plantilla.');
    } finally {
      this.descargandoPlantilla = false;
    }
  }

  async elegirArchivo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = ''; // para poder volver a elegir el mismo archivo
    if (!archivo || !this.esAdmin) return;

    this.previa = null;
    this.nombreArchivo = archivo.name;
    this.leyendoArchivo = true;
    try {
      const lectura = leerTramites(await leerArchivoTablas(archivo));
      if (!lectura) {
        this.message.warning('No encontré la hoja de trámites. Usa la plantilla: necesita las columnas «Cliente» y «Tipo de trámite».');
        return;
      }
      this.previa = this.armarPrevia(lectura);
    } catch (error) {
      console.error('Error leyendo el archivo:', error);
      this.message.error('No se pudo leer el archivo. ¿Es un .xlsx o .csv válido?');
    } finally {
      this.leyendoArchivo = false;
    }
  }

  private armarPrevia(lectura: LecturaTramites): PreviaImportacion {
    const duplicados = marcarDuplicados(lectura.items, this.tramites);
    const origenes = origenesRadiografia(lectura.items);
    const ahora = new Date();
    const anonimo = { uid: '', nombre: '' };
    const grupos = new Map<string, GrupoPrevia>();

    lectura.items.forEach((item, i) => {
      const tramite = armarTramite(item, anonimo, ahora, this.hoy, () => '');
      const actual = etapaActual(tramite);
      const fila: FilaPrevia = {
        item,
        tramite,
        tot: totalesDe(tramite),
        etapaTexto: tramite.estado !== 'en_curso' ? '' : item.etapasHechas.length === 0 ? 'Sin iniciar' : actual?.nombre ?? 'Etapas completas',
        esperando: esperandoA(tramite),
        duplicado: duplicados[i],
        radiografiaFila: origenes[i] === null ? null : lectura.items[origenes[i]!].fila
      };
      const clave = claveCliente(tramite);
      const grupo = grupos.get(clave) ?? { clave, nombre: tramite.clienteNombre, ruc: tramite.clienteRuc, filas: [] };
      grupo.filas.push(fila);
      grupos.set(clave, grupo);
    });

    return {
      grupos: [...grupos.values()],
      nuevos: lectura.items.filter((_, i) => !duplicados[i]),
      duplicados: duplicados.filter(Boolean).length,
      errores: lectura.errores,
      avisos: lectura.avisos
    };
  }

  async confirmarImportar(): Promise<void> {
    const previa = this.previa;
    if (!previa || previa.nuevos.length === 0) return;
    const total = previa.nuevos.length;
    const ok = await this.hacer('importar', () => this.tramitesService.importar(previa.nuevos),
      `${total} trámite${total === 1 ? '' : 's'} importado${total === 1 ? '' : 's'}.`, 'No se pudieron importar los trámites.');
    if (ok) {
      this.mostrarImportar = false;
      this.previa = null;
      // Los terminados no se ven con el filtro por defecto: se muestran todos para ver lo que llegó.
      this.filtros = { ...this.filtros, estado: null };
      this.refiltrar();
    }
  }

  // ============================================
  // 🔑 Acceso (solo admin)
  // ============================================
  async abrirAcceso(): Promise<void> {
    if (!this.esAdmin) return;
    this.mostrarAcceso = true;
    this.cargandoAcceso = true;
    try {
      const usuarios = await this.registersService.getUsersByArea('iess');
      this.usuariosIess = usuarios
        .filter(u => u.activo && u.role !== 'admin')
        .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
    } catch (error) {
      console.error('Error cargando los usuarios del IESS:', error);
      this.message.error('No se pudo cargar la lista de usuarios.');
    } finally {
      this.cargandoAcceso = false;
    }
  }

  async cambiarAcceso(usuario: Register, acceso: boolean): Promise<void> {
    if (!this.esAdmin || this.cambiandoAcceso) return;
    this.cambiandoAcceso = usuario.uid;
    try {
      await this.registersService.setAccesoTramitesIess(usuario.uid, acceso);
      usuario.tramitesIess = acceso;
      this.message.success(acceso ? 'Acceso concedido.' : 'Acceso quitado.');
    } catch (error) {
      console.error('Error cambiando el acceso:', error);
      this.message.error('No se pudo cambiar el acceso.');
      // El interruptor ya se movió: se vuelven a crear las filas para que muestre lo guardado.
      this.usuariosIess = this.usuariosIess.map(u => ({ ...u }));
    } finally {
      this.cambiandoAcceso = null;
    }
  }

  // ============================================
  // 🔧 Guardado con aviso
  // ============================================
  // Una sola acción a la vez. Los errores de validación de la lógica (que ya
  // vienen redactados) se muestran tal cual; los de Firestore, con un texto genérico.
  private async hacer(clave: string, accion: () => Promise<unknown>, exito: string, falla: string): Promise<boolean> {
    if (this.trabajando) return false;
    this.trabajando = clave;
    try {
      await accion();
      if (exito) this.message.success(exito);
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
