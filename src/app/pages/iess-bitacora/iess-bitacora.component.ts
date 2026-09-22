import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';

import { SharedDataService } from '../../services/sharedData/shared-data.service';
import { UsersService } from '../../services/users/users.service';
import { RegistersService } from '../../services/registers/registers.service';
import { AreaActivity } from '../../services/areaActivities/area-activities.service';
import {
  CoactivadosService,
  Coactivado,
  ResumenCartera,
  esCedulaValida,
  normalizarCedula
} from '../../services/coactivados/coactivados.service';
import {
  AREA_IESS,
  GestionesCoactivadoService,
  GestionCoactivado,
  TipoGestion,
  TIPOS_GESTION,
  TIPOS_GESTION_SELECCIONABLES
} from '../../services/gestionesCoactivado/gestiones-coactivado.service';
import { TitulosCreditoService } from '../../services/titulosCredito/titulos-credito.service';
import {
  TituloCredito,
  TipoCancelacion,
  ResumenTitulos,
  esCancelado,
  fechaCorta,
  formatoMoneda,
  resumirTitulos
} from '../../services/titulosCredito/titulos-credito.util';

@Component({
  selector: 'app-iess-bitacora',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NzCardModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
    NzTagModule,
    NzSelectModule,
    NzFormModule,
    NzRadioModule,
    NzSwitchModule,
    NzDatePickerModule,
    NzModalModule,
    NzToolTipModule,
    NzPopconfirmModule,
    NzEmptyModule,
    NzAlertModule,
    NzCollapseModule,
    NzTableModule,
    NzBreadCrumbModule
  ],
  templateUrl: './iess-bitacora.component.html',
  styleUrl: './iess-bitacora.component.css'
})
export class IessBitacoraComponent implements OnInit, OnDestroy {
  readonly carteras: string[];
  // 'migrado' no aparece: lo pone solo el importador de títulos, no se elige a mano.
  readonly tiposGestion = TIPOS_GESTION_SELECCIONABLES.map(value => ({ value, label: TIPOS_GESTION[value] }));

  // Búsqueda
  termino = '';
  buscando = false;
  resultados: Coactivado[] | null = null; // null = todavía no se buscó por nombre
  cedulaNoEncontrada: string | null = null;

  // Coactivado abierto
  seleccionado: Coactivado | null = null;
  gestiones: GestionCoactivado[] = [];
  cargandoGestiones = false;

  // Alta / edición de coactivado
  mostrarAlta = false;
  guardandoCoactivado = false;
  mostrarEdicion = false;
  guardandoEdicion = false;

  // Eliminación (solo admin): pide teclear la cédula para confirmar.
  mostrarEliminacion = false;
  confirmacionCedula = '';
  eliminando = false;

  // Edición (todo el área) y eliminación (solo admin) de una gestión.
  mostrarEdicionGestion = false;
  guardandoEdicionGestion = false;
  gestionEditando: GestionCoactivado | null = null;
  eliminandoGestionId: string | null = null;

  guardandoGestion = false;

  // Recordatorios: integrantes del IESS entre quienes elegir responsable, y
  // los recordatorios todavía abiertos del coactivado abierto.
  responsables: { uid: string; nombre: string }[] = [];
  recordatorios: AreaActivity[] = [];
  completandoId: string | null = null;

  // Títulos de crédito del coactivado abierto.
  titulos: TituloCredito[] = [];
  cargandoTitulos = false;
  filtroTitulos = '';
  readonly formatoMoneda = formatoMoneda;
  readonly esCancelado = esCancelado;

  get titulosFiltrados(): TituloCredito[] {
    const t = this.filtroTitulos.trim().toUpperCase();
    if (!t) return this.titulos;
    return this.titulos.filter(x => x.numero.includes(t) || (x.guia ?? '').toUpperCase().includes(t));
  }

  // Registrar abono/pago total de un título (cualquiera del área).
  mostrarCancelacion = false;
  guardandoCancelacion = false;
  tituloCancelando: TituloCredito | null = null;
  cancelacionForm: FormGroup;

  // Panel de carteras: para decidir por dónde seguir gestionando (solo se
  // carga cuando se aterriza en la vista vacía, no al abrir un coactivado
  // directo desde la agenda).
  resumenCarteras: ResumenCartera[] = [];
  cargandoResumen = false;

  altaForm: FormGroup;
  edicionForm: FormGroup;
  gestionForm: FormGroup;
  edicionGestionForm: FormGroup;

  private gestionesSub?: Subscription;
  private recordatoriosSub?: Subscription;
  private titulosSub?: Subscription;
  private uid: string | null;

  // El seguimiento se agenda de lunes a viernes (la agenda semanal no
  // muestra fines de semana) y nunca en el pasado.
  readonly fechaNoDisponible = (fecha: Date): boolean => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const dia = fecha.getDay();
    return fecha < hoy || dia === 0 || dia === 6;
  };

  constructor(
    private sharedData: SharedDataService,
    private coactivadosService: CoactivadosService,
    private gestionesService: GestionesCoactivadoService,
    private titulosService: TitulosCreditoService,
    private usersService: UsersService,
    private registersService: RegistersService,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private message: NzMessageService
  ) {
    this.carteras = this.sharedData.getCarterasIess();
    this.uid = this.usersService.getCurrentUser()?.uid ?? null;

    this.altaForm = this.fb.group({
      cedula: ['', [Validators.required, Validators.pattern(/^(\d{10}|\d{13})$/)]],
      nombre: ['', [Validators.required, Validators.pattern(/\S/)]],
      cartera: [null, Validators.required]
    });

    this.edicionForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.pattern(/\S/)]],
      cartera: [null, Validators.required]
    });

    this.gestionForm = this.fb.group({
      tipo: ['llamada', Validators.required],
      descripcion: ['', [Validators.required, Validators.pattern(/\S/)]],
      recordatorio: [false],
      fechaRecordatorio: [null],
      responsable: [this.uid]
    });

    this.edicionGestionForm = this.fb.group({
      tipo: ['llamada', Validators.required],
      descripcion: ['', [Validators.required, Validators.pattern(/\S/)]]
    });

    this.cancelacionForm = this.fb.group({
      tipo: ['abono', Validators.required],
      montoCancelado: [null],
      honorario: [null]
    });

    // La fecha solo es obligatoria si se pidió recordatorio.
    this.gestionForm.get('recordatorio')!.valueChanges.subscribe(activo => {
      const fecha = this.gestionForm.get('fechaRecordatorio')!;
      fecha.setValidators(activo ? [Validators.required] : []);
      fecha.updateValueAndValidity();
    });

    // Monto y honorario solo son obligatorios si es pago total.
    this.cancelacionForm.get('tipo')!.valueChanges.subscribe((tipo: TipoCancelacion) => {
      const requerido = tipo === 'pago_total' ? [Validators.required, Validators.min(0.01)] : [];
      this.cancelacionForm.get('montoCancelado')!.setValidators(requerido);
      this.cancelacionForm.get('honorario')!.setValidators(requerido);
      this.cancelacionForm.get('montoCancelado')!.updateValueAndValidity();
      this.cancelacionForm.get('honorario')!.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    this.cargarResponsables();

    // Desde la agenda: un recordatorio abre directo la ficha de su coactivado
    // (en ese caso no hace falta cargar el panel de carteras).
    const cedula = this.route.snapshot.queryParamMap.get('cedula');
    if (cedula) this.abrirPorCedula(cedula);
    else this.cargarResumenCarteras();
  }

  private async cargarResumenCarteras(): Promise<void> {
    this.cargandoResumen = true;
    try {
      this.resumenCarteras = await Promise.all(this.carteras.map(c => this.coactivadosService.getResumenCartera(c)));
    } catch (error) {
      console.error('Error cargando el panel de carteras:', error);
    } finally {
      this.cargandoResumen = false;
    }
  }

  get totalCoactivadosCartera(): number {
    return this.resumenCarteras.reduce((s, r) => s + r.coactivados, 0);
  }

  ngOnDestroy(): void {
    this.gestionesSub?.unsubscribe();
    this.recordatoriosSub?.unsubscribe();
  }

  private async cargarResponsables(): Promise<void> {
    const usuarios = (await this.registersService.getUsersByArea(AREA_IESS)).filter(u => u.activo);

    // Un admin/coordinador de otra área también puede registrar gestiones y
    // debe poder asignarse el recordatorio a sí mismo.
    const actual = this.registersService.getCurrentRegister();
    if (actual && !usuarios.some(u => u.uid === actual.uid)) usuarios.push(actual);

    this.responsables = usuarios
      .map(u => ({ uid: u.uid, nombre: u.displayName || u.nickname || u.email }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  private async abrirPorCedula(cedula: string): Promise<void> {
    try {
      const coactivado = await this.coactivadosService.getByCedula(normalizarCedula(cedula));
      if (coactivado) this.seleccionar(coactivado);
      else this.message.warning('No se encontró el coactivado de ese recordatorio.');
    } catch (error) {
      console.error('Error abriendo coactivado desde la agenda:', error);
      this.message.error('No se pudo abrir la ficha del coactivado.');
    }
  }

  // ============================================
  // 🔍 Búsqueda
  // ============================================
  async buscar(): Promise<void> {
    const termino = this.termino.trim();
    if (!termino || this.buscando) return;

    this.limpiarSeleccion();
    this.mostrarAlta = false;
    this.resultados = null;
    this.cedulaNoEncontrada = null;
    this.buscando = true;

    try {
      const digitos = normalizarCedula(termino);
      if (/^\d+$/.test(digitos)) {
        if (!esCedulaValida(digitos)) {
          this.message.warning('La cédula debe tener 10 dígitos (13 si es RUC).');
          return;
        }
        const encontrado = await this.coactivadosService.getByCedula(digitos);
        if (encontrado) {
          this.seleccionar(encontrado);
        } else {
          this.cedulaNoEncontrada = digitos;
        }
      } else {
        this.resultados = await this.coactivadosService.buscarPorNombre(termino);
      }
    } catch (error) {
      console.error('Error buscando coactivado:', error);
      this.message.error('No se pudo realizar la búsqueda.');
    } finally {
      this.buscando = false;
    }
  }

  // ============================================
  // 👤 Ficha del coactivado
  // ============================================
  seleccionar(coactivado: Coactivado): void {
    this.limpiarSeleccion();
    this.mostrarAlta = false;
    this.cedulaNoEncontrada = null;
    this.seleccionado = coactivado;
    this.reiniciarFormularioGestion();

    this.recordatoriosSub = this.gestionesService.getRecordatoriosPendientes(coactivado.cedula).subscribe({
      next: recordatorios => this.recordatorios = recordatorios,
      error: error => console.error('Error cargando recordatorios:', error)
    });

    this.cargandoTitulos = true;
    this.titulosSub = this.titulosService.getPorCoactivado(coactivado.cedula).subscribe({
      next: titulos => { this.titulos = titulos; this.cargandoTitulos = false; },
      error: error => { console.error('Error cargando títulos:', error); this.cargandoTitulos = false; }
    });

    this.cargandoGestiones = true;
    this.gestionesSub = this.gestionesService.getGestiones(coactivado.cedula).subscribe({
      next: gestiones => {
        this.gestiones = gestiones;
        this.cargandoGestiones = false;
      },
      error: error => {
        console.error('Error cargando gestiones:', error);
        this.cargandoGestiones = false;
        this.message.error('No se pudieron cargar las gestiones.');
      }
    });
  }

  private limpiarSeleccion(): void {
    this.gestionesSub?.unsubscribe();
    this.recordatoriosSub?.unsubscribe();
    this.titulosSub?.unsubscribe();
    this.seleccionado = null;
    this.gestiones = [];
    this.recordatorios = [];
    this.titulos = [];
    this.filtroTitulos = '';
  }

  get resumenTitulos(): ResumenTitulos {
    return resumirTitulos(this.titulos);
  }

  private reiniciarFormularioGestion(tipo: TipoGestion = 'llamada'): void {
    this.gestionForm.reset({
      tipo,
      descripcion: '',
      recordatorio: false,
      fechaRecordatorio: null,
      responsable: this.uid
    });
  }

  get recordatorioActivo(): boolean {
    return !!this.gestionForm.get('recordatorio')?.value;
  }

  // Vencido = su fecha ya pasó y sigue abierto.
  esVencido(recordatorio: AreaActivity): boolean {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return new Date(recordatorio.fechaLimite) < hoy;
  }

  async completarRecordatorio(recordatorio: AreaActivity): Promise<void> {
    if (!recordatorio.id) return;

    this.completandoId = recordatorio.id;
    try {
      await this.gestionesService.completarRecordatorio(recordatorio.id);
      this.message.success('Recordatorio completado.');
    } catch (error) {
      console.error('Error completando recordatorio:', error);
      this.message.error('No se pudo completar el recordatorio.');
    } finally {
      this.completandoId = null;
    }
  }

  // Aviso ante el caso que motivó esta bitácora: otra persona ya gestionó
  // hoy a este mismo coactivado.
  get ultimaGestion(): GestionCoactivado | null {
    return this.gestiones[0] ?? null;
  }

  get ultimaEsHoyDeOtro(): boolean {
    const g = this.ultimaGestion;
    return !!g && g.registradoPor.uid !== this.uid && g.fecha.toDateString() === new Date().toDateString();
  }

  get bannerMensaje(): string {
    const g = this.ultimaGestion;
    if (!g) return '';
    if (this.ultimaEsHoyDeOtro) {
      return `Hoy ya lo gestionó ${g.registradoPor.nombre} (${formatDate(g.fecha, 'HH:mm', 'en-US')})`;
    }
    return `Última gestión: ${formatDate(g.fecha, 'dd/MM/yyyy HH:mm', 'en-US')} por ${g.registradoPor.nombre}`;
  }

  // ============================================
  // ➕ Alta de coactivado
  // ============================================
  abrirAlta(cedula = ''): void {
    this.limpiarSeleccion();
    this.altaForm.reset({ cedula, nombre: '', cartera: null });
    this.mostrarAlta = true;
  }

  cancelarAlta(): void {
    this.mostrarAlta = false;
  }

  async guardarCoactivado(): Promise<void> {
    if (this.altaForm.invalid) {
      this.altaForm.markAllAsTouched();
      return;
    }

    this.guardandoCoactivado = true;
    try {
      const nuevo = await this.coactivadosService.crear(this.altaForm.value);
      this.message.success('Coactivado registrado.');
      this.seleccionar(nuevo);
    } catch (error: any) {
      if (error?.message === 'YA_EXISTE') {
        await this.abrirExistente(this.altaForm.value.cedula);
      } else {
        console.error('Error registrando coactivado:', error);
        this.message.error('No se pudo registrar el coactivado.');
      }
    } finally {
      this.guardandoCoactivado = false;
    }
  }

  // Dos personas pueden intentar dar de alta la misma cédula casi a la vez:
  // la segunda no pisa nada, simplemente abre la ficha que ya existe.
  private async abrirExistente(cedula: string): Promise<void> {
    try {
      const existente = await this.coactivadosService.getByCedula(normalizarCedula(cedula));
      if (existente) {
        this.message.info('Esa cédula ya estaba registrada — abrimos su ficha.');
        this.seleccionar(existente);
        return;
      }
    } catch (error) {
      console.error('Error abriendo coactivado existente:', error);
    }
    this.message.error('No se pudo registrar el coactivado.');
  }

  // ============================================
  // ✏️ Edición (nombre / cartera)
  // ============================================
  abrirEdicion(): void {
    if (!this.seleccionado) return;
    this.edicionForm.reset({ nombre: this.seleccionado.nombre, cartera: this.seleccionado.cartera });
    this.mostrarEdicion = true;
  }

  async guardarEdicion(): Promise<void> {
    if (!this.seleccionado || this.edicionForm.invalid) return;

    this.guardandoEdicion = true;
    try {
      const actualizado = await this.coactivadosService.actualizar(this.seleccionado, this.edicionForm.value);
      this.seleccionado = actualizado;
      if (this.resultados) {
        this.resultados = this.resultados.map(c => c.cedula === actualizado.cedula ? actualizado : c);
      }
      this.mostrarEdicion = false;
      this.message.success('Coactivado actualizado.');
    } catch (error) {
      console.error('Error actualizando coactivado:', error);
      this.message.error('No se pudo actualizar el coactivado.');
    } finally {
      this.guardandoEdicion = false;
    }
  }

  // ============================================
  // 🗑️ Eliminación (solo admin)
  // ============================================
  get esAdmin(): boolean {
    return this.registersService.isCurrentUserAdmin();
  }

  get confirmacionValida(): boolean {
    return !!this.seleccionado && this.confirmacionCedula.trim() === this.seleccionado.cedula;
  }

  abrirEliminacion(): void {
    this.confirmacionCedula = '';
    this.mostrarEliminacion = true;
  }

  async confirmarEliminacion(): Promise<void> {
    const coactivado = this.seleccionado;
    if (!coactivado || !this.esAdmin || !this.confirmacionValida) return;

    this.eliminando = true;
    try {
      await this.coactivadosService.eliminar(coactivado.cedula);
      this.mostrarEliminacion = false;
      this.limpiarSeleccion();
      this.resultados = this.resultados?.filter(c => c.cedula !== coactivado.cedula) ?? null;
      this.message.success('Coactivado eliminado con sus gestiones y recordatorios.');
    } catch (error) {
      console.error('Error eliminando coactivado:', error);
      this.message.error('No se pudo eliminar por completo. Vuelve a intentarlo.');
    } finally {
      this.eliminando = false;
    }
  }

  // ============================================
  // 📝 Nueva gestión
  // ============================================
  async registrarGestion(): Promise<void> {
    if (!this.seleccionado || this.gestionForm.invalid) return;

    this.guardandoGestion = true;
    try {
      const { tipo, descripcion, recordatorio, fechaRecordatorio, responsable } = this.gestionForm.value;
      const gestionId = await this.gestionesService.registrarGestion({
        coactivadoId: this.seleccionado.cedula,
        coactivadoNombre: this.seleccionado.nombre,
        cartera: this.seleccionado.cartera,
        tipo,
        descripcion
      });

      if (recordatorio) {
        await this.crearRecordatorio(gestionId, descripcion, fechaRecordatorio, responsable);
      } else {
        this.message.success('Gestión registrada.');
      }

      this.reiniciarFormularioGestion(tipo);
    } catch (error) {
      console.error('Error registrando gestión:', error);
      this.message.error('No se pudo registrar la gestión.');
    } finally {
      this.guardandoGestion = false;
    }
  }

  // La gestión ya quedó guardada: si el recordatorio falla no se pierde
  // nada, solo se avisa para crearlo a mano desde la agenda.
  private async crearRecordatorio(gestionId: string, descripcion: string, fecha: Date, responsableUid: string): Promise<void> {
    const responsable = this.responsables.find(r => r.uid === responsableUid)
      ?? { uid: this.uid ?? '', nombre: this.registersService.getCurrentRegister()?.displayName ?? 'Usuario' };

    try {
      await this.gestionesService.crearRecordatorio({
        coactivado: this.seleccionado!,
        gestionId,
        descripcion,
        fecha,
        responsable
      });
      this.message.success('Gestión registrada y recordatorio creado en la agenda.');
    } catch (error) {
      console.error('Error creando recordatorio:', error);
      this.message.warning('La gestión se guardó, pero no se pudo crear el recordatorio en la agenda. Créalo desde la agenda.');
    }
  }

  // ============================================
  // ✏️ Gestión individual: editar (todo el área) / eliminar (solo admin)
  // ============================================
  abrirEdicionGestion(gestion: GestionCoactivado): void {
    this.gestionEditando = gestion;
    this.edicionGestionForm.reset({ tipo: gestion.tipo, descripcion: gestion.descripcion });
    this.mostrarEdicionGestion = true;
  }

  async guardarEdicionGestion(): Promise<void> {
    const gestion = this.gestionEditando;
    if (!gestion?.id || this.edicionGestionForm.invalid) return;

    this.guardandoEdicionGestion = true;
    try {
      await this.gestionesService.editarGestion(gestion.id, this.edicionGestionForm.value);
      this.mostrarEdicionGestion = false;
      this.gestionEditando = null;
      this.message.success('Gestión actualizada.');
    } catch (error) {
      console.error('Error editando gestión:', error);
      this.message.error('No se pudo actualizar la gestión.');
    } finally {
      this.guardandoEdicionGestion = false;
    }
  }

  async eliminarGestion(gestion: GestionCoactivado): Promise<void> {
    if (!gestion.id || !this.esAdmin) return;

    this.eliminandoGestionId = gestion.id;
    try {
      await this.gestionesService.eliminarGestion(gestion.id);
      this.message.success('Gestión eliminada.');
    } catch (error) {
      console.error('Error eliminando gestión:', error);
      this.message.error('No se pudo eliminar la gestión.');
    } finally {
      this.eliminandoGestionId = null;
    }
  }

  // Detalle de la marca "editada" (quién y cuándo), para el tooltip.
  textoEdicion(gestion: GestionCoactivado): string {
    if (!gestion.editadoPor) return '';
    const cuando = gestion.fechaEdicion ? formatDate(gestion.fechaEdicion, 'dd/MM/yyyy HH:mm', 'en-US') : '';
    return `Editada por ${gestion.editadoPor.nombre}${cuando ? ' el ' + cuando : ''}`;
  }

  tipoLabel(tipo: TipoGestion): string {
    return TIPOS_GESTION[tipo];
  }

  tipoColor(tipo: TipoGestion): string {
    switch (tipo) {
      case 'llamada': return 'geekblue';
      case 'mensaje': return 'green';
      case 'reunion': return 'purple';
      case 'migrado': return 'default';
      default: return 'default';
    }
  }

  trackByCedula(index: number, c: Coactivado): string {
    return c.cedula;
  }

  trackById(index: number, g: GestionCoactivado): string | undefined {
    return g.id;
  }

  trackByActividad(index: number, a: AreaActivity): string | undefined {
    return a.id;
  }

  fechaCorta(iso?: string): string {
    return fechaCorta(iso);
  }

  trackByTitulo(index: number, t: TituloCredito): string {
    return t.numero;
  }

  // ============================================
  // 💰 Registrar abono / pago total de un título
  // ============================================
  abrirCancelacion(t: TituloCredito): void {
    this.tituloCancelando = t;
    this.cancelacionForm.reset({ tipo: 'abono', montoCancelado: null, honorario: null });
    this.mostrarCancelacion = true;
  }

  cerrarCancelacion(): void {
    this.mostrarCancelacion = false;
    this.tituloCancelando = null;
  }

  async guardarCancelacion(): Promise<void> {
    if (!this.tituloCancelando || this.cancelacionForm.invalid) {
      this.cancelacionForm.markAllAsTouched();
      return;
    }

    this.guardandoCancelacion = true;
    try {
      const v = this.cancelacionForm.value;
      await this.titulosService.registrarCancelacion(this.tituloCancelando.numero, {
        tipo: v.tipo,
        montoCancelado: v.tipo === 'pago_total' ? v.montoCancelado : undefined,
        honorario: v.tipo === 'pago_total' ? v.honorario : undefined
      });
      this.message.success('Cancelación registrada.');
      this.cerrarCancelacion();
    } catch (error) {
      console.error('Error registrando la cancelación:', error);
      this.message.error('No se pudo registrar la cancelación.');
    } finally {
      this.guardandoCancelacion = false;
    }
  }

  // Solo admin: corrige una cancelación/abono registrada por error.
  async deshacerCancelacion(t: TituloCredito): Promise<void> {
    try {
      await this.titulosService.deshacerCancelacion(t.numero);
      this.message.success('Cancelación deshecha.');
    } catch (error) {
      console.error('Error deshaciendo la cancelación:', error);
      this.message.error('No se pudo deshacer la cancelación.');
    }
  }
}
