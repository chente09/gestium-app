import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzTableComponent, NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { RouterModule } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { Subject, takeUntil } from 'rxjs';

import { ItinerarioService, Itinerario, RutaDiaria } from '../../../services/itinerario/itinerario.service';
import { UsersService } from '../../../services/users/users.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedDataService } from '../../../services/sharedData/shared-data.service';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

enum Estado {
  COMPLETADO = 'completado',
  INCOMPLETO = 'incompleto',
  PENDIENTE = 'pendiente'
}

@Component({
  selector: 'app-itinerario',
  standalone: true,
  imports: [
    CommonModule,
    NzSelectModule,
    FormsModule,
    NzTableModule,
    ReactiveFormsModule,
    NzTagModule,
    NzButtonModule,
    NzDatePickerModule,
    RouterModule,
    NzIconModule,
    NzUploadModule,
    NzModalModule,
    NzListModule,
    NzFormModule,
    NzBreadCrumbModule,
    NzMenuModule,
    NzDropDownModule,
    NzInputModule,
    NzCardModule,
    NzEmptyModule,
    NzGridModule,
    NzPopconfirmModule
  ],
  templateUrl: './itinerario.component.html',
  styleUrl: './itinerario.component.css'
})
export class ItinerarioComponent implements OnInit {

  // ========== PROPIEDADES DE DATOS ==========
  itinerarios: Itinerario[] = [];
  filteredItinerarios: Itinerario[] = [];
  listOfCurrentPageData: Itinerario[] = [];
  notificaciones: { area: string; tramite: string; fechaTermino: string, solicita: string, id: string }[] = [];

  // ========== PROPIEDADES DE ESTADO ==========
  loading = true;
  uploading = false;
  mostrarFormulario = false;
  formularioValido = false;
  mostrarNotificaciones = false;
  mostrarTodos = false;

  // ========== PROPIEDADES DE MODALES ==========
  isVisible = false;
  isEnProcesoVisible = false;
  isConfirmLoading = false;
  isHistorialVisible = false;

  // ========== PROPIEDADES DE SELECCIÓN ==========
  setOfCheckedId = new Set<string>();
  checked = false;
  indeterminate = false;
  selectedItem: any = {};

  // ========== PROPIEDADES DE EDICIÓN ==========
  editCache: { [key: string]: { edit: boolean } } = {};

  // ========== PROPIEDADES DE ACTIVIDADES ==========
  actividad: string = '';
  actividades: string[] = [];
  nuevaActividad: string = '';
  actividadesTemporales: string[] = [];
  actividadesGuardadas: RutaDiaria[] = [];
  editIndex: number | null = null;
  editActividad: string = '';
  historialActual: any[] = [];

  // ========== PROPIEDADES DE ARCHIVOS ==========
  imagenSeleccionada: File | null = null;
  imageFileList: any[] = [];

  // ========== PROPIEDADES DE FECHA/HORA ==========
  fechaActual: string = '';
  horaActual: string = '';

  // ========== FILTROS ==========
  selectedArea = new FormControl('');
  selectedDate = new FormControl<[Date | null, Date | null]>([null, null]);
  selectedEstado = new FormControl(null);
  searchTerm: string = '';

  // ========== CONFIGURACIONES ==========
  areas: string[] = [];
  estados: string[] = [];
  pageSize = 20;
  pageIndex = 1;
  Estado = Estado;

  // ========== VIEW CHILDREN ==========
  @ViewChild('rowSelectionTable') rowSelectionTable!: NzTableComponent<Itinerario>;
  @ViewChild('rutaActividades') rutaActividades!: ElementRef;

  // ========== OBSERVABLES ==========
  private destroy$ = new Subject<void>();

  constructor(
    private itinerarioService: ItinerarioService,
    private usersService: UsersService,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef,
    private sharedDataService: SharedDataService
  ) { }

  // ========== MÉTODOS DE CICLO DE VIDA ==========
  ngOnInit(): void {
    this.initializeComponent();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========== MÉTODOS DE INICIALIZACIÓN ==========
  private initializeComponent(): void {
    this.areas = this.sharedDataService.getAreas();
    this.estados = this.sharedDataService.getEstados();

    this.setFechaHoraActual();
    this.loadItinerarios();
    this.cargarActividades();
    this.obtenerActividadesGuardadas();
  }

  private setupSubscriptions(): void {
    this.selectedArea.valueChanges.subscribe(() => this.filterItinerarios());
    this.selectedDate.valueChanges.subscribe(() => this.filterItinerarios());
    this.selectedEstado.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
  }

  private loadItinerarios(): void {
    this.itinerarioService.getItinerarios().subscribe(data => {
      if (!Array.isArray(data)) {
        console.warn("Los datos obtenidos no son un array:", data);
        this.loading = false;
        return;
      }

      this.itinerarios = data;
      this.filterItinerarios();

      this.itinerarios.forEach(item => {
        this.editCache[item.id] = { edit: false };
        if (this.esFechaTerminoHoy(item.fechaTermino, item.estado)) {
          this.agregarNotificacion(item);
        }
      });

      this.loading = false;
    });
  }

  // ========== MÉTODOS DE FILTRADO Y BÚSQUEDA ==========
  onSearch(): void {
    this.filterItinerarios();
  }

  filterItinerarios(): void {
    const selectedAreaValue = this.selectedArea.value;
    const selectedEstadoValue = this.selectedEstado.value;
    const [fechaInicio, fechaFin] = this.selectedDate.value || [null, null];

    this.filteredItinerarios = this.itinerarios.filter(item => {
      const estado = item.estado;
      const estadoStr = String(item.estado).toLowerCase();
      const isEstadoMatch = selectedEstadoValue ? estadoStr === String(selectedEstadoValue).toLowerCase() : true;
      const isPendingOrIncomplete = estado === Estado.PENDIENTE || estado === Estado.INCOMPLETO;
      const isAreaMatch = selectedAreaValue ? item.area === selectedAreaValue : true;
      const fechaSolicitud = new Date(item.fechaSolicitud);
      const searchTermLower = this.searchTerm.toLowerCase();

      const isDateInRange =
        (!fechaInicio || fechaSolicitud >= new Date(fechaInicio)) &&
        (!fechaFin || fechaSolicitud <= new Date(fechaFin));

      const isSearchMatch = searchTermLower === '' ||
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(searchTermLower)
        );

      return isPendingOrIncomplete && isAreaMatch && isDateInRange && isEstadoMatch && isSearchMatch;
    });

    this.filteredItinerarios = this.sortData(this.filteredItinerarios);
    this.cdr.detectChanges();
  }

  private sortData(itinerarios: Itinerario[]): Itinerario[] {
    const unidadOrder: string[] = ['Pague Ya', 'Municipio', 'Notaria', 'SUPERCIAS', 'AMT', 'ANT', 'SRI', 'ISSFA', 'Consejo Provincial', 'Registro Propiedad', 'Registro Mercantil', 'Quitumbe', 'Iñaquito', 'Mejía', 'Cayambe', 'Rumiñahui', 'Calderon', 'Otro', ''];
    const pisoOrder: string[] = ['Pb', '5to', '8vo', 'Otro', ''];
    const materiaOrder: string[] = ['Archivo', 'Ingresos', 'Coordinación', 'Diligencias no Penales', 'Oficina de Citaciones', 'Familia', 'Laboral', 'Penal', 'Civil', 'Otro', ''];
    const diligenciaOrder: string[] = ['Copias para Citar', 'Desglose', 'Requerimiento', 'Oficios', 'Otro', ''];

    return itinerarios.sort((a, b) => {
      const indexUnidadA = unidadOrder.indexOf(a.manualJuzgado || a.juzgado);
      const indexUnidadB = unidadOrder.indexOf(b.manualJuzgado || b.juzgado);
      const indexPisoA = pisoOrder.indexOf(a.piso);
      const indexPisoB = pisoOrder.indexOf(b.piso);
      const indexMateriaA = materiaOrder.indexOf(a.materia);
      const indexMateriaB = materiaOrder.indexOf(b.materia);
      const indexDiligenciaA = diligenciaOrder.indexOf(a.diligencia);
      const indexDiligenciaB = diligenciaOrder.indexOf(b.diligencia);
      const fechaA = a.fechaTermino ? new Date(a.fechaTermino).getTime() : Number.MAX_SAFE_INTEGER;
      const fechaB = b.fechaTermino ? new Date(b.fechaTermino).getTime() : Number.MAX_SAFE_INTEGER;

      const getSafeIndex = (index: number, orderArray: string[]) =>
        index === -1 ? orderArray.length : index;

      return (
        getSafeIndex(indexUnidadA, unidadOrder) - getSafeIndex(indexUnidadB, unidadOrder) ||
        getSafeIndex(indexPisoA, pisoOrder) - getSafeIndex(indexPisoB, pisoOrder) ||
        getSafeIndex(indexMateriaA, materiaOrder) - getSafeIndex(indexMateriaB, materiaOrder) ||
        getSafeIndex(indexDiligenciaA, diligenciaOrder) - getSafeIndex(indexDiligenciaB, diligenciaOrder) ||
        fechaA - fechaB
      );
    });
  }

  mostrarDuplicados(): void {
    const tramiteMap = new Map<string, number>();
    this.filteredItinerarios.forEach(item => {
      const count = tramiteMap.get(item.tramite) || 0;
      tramiteMap.set(item.tramite, count + 1);
    });
    const duplicados = this.filteredItinerarios.filter(item => tramiteMap.get(item.tramite)! > 1);
    this.filteredItinerarios = duplicados;
  }

  showAllAreas(): void {
    this.selectedArea.setValue('');
    this.selectedDate.setValue([null, null]);
    this.selectedEstado.setValue(null);
    this.filterItinerarios();
  }

  // ========== MÉTODOS DE COMPLETAR ITEM ==========
  async completarItem(item: Itinerario): Promise<void> {
    this.selectedItem = { ...item, estado: Estado.COMPLETADO };
    this.setFechaHoraActual();
    this.isVisible = true;
    this.validarFormulario();
  }

  validarFormulario(): void {
    const user = this.usersService.getCurrentUser();

    console.log('Validando formulario para usuario:', user?.email);
    console.log('Imagen seleccionada:', this.imagenSeleccionada);
    console.log('Observación:', this.selectedItem?.obsCompletado);

    if (user?.email === 'msaguano.gestium@gmail.com') {
      this.formularioValido = !!(this.selectedItem?.obsCompletado?.trim() && this.imagenSeleccionada);
      console.log('Usuario específico - Formulario válido:', this.formularioValido);
    } else {
      this.formularioValido = true;
      console.log('Otro usuario - Formulario válido automáticamente');
    }
  }

  async guardarEstado(): Promise<void> {
    if (!this.selectedItem) return;

    this.validarFormulario();
    if (!this.formularioValido) {
      this.message.error('La imagen y la observación son obligatorias para completar el ítem.');
      return;
    }

    const user = this.usersService.getCurrentUser();
    if (!user) {
      console.error("No hay un usuario autenticado.");
      this.message.error("No hay un usuario autenticado.");
      return;
    }

    try {
      let imgURL = this.selectedItem.imgcompletado;

      // Subir imagen si hay una nueva seleccionada
      if (this.imagenSeleccionada) {
        const filePath = `itinerarios/imagesComplete/${Date.now()}_${this.imagenSeleccionada.name}`;
        try {
          imgURL = await this.itinerarioService.uploadImage(filePath, this.imagenSeleccionada);
          console.log('Imagen subida exitosamente:', imgURL);
        } catch (error) {
          this.message.error('Error al subir la imagen');
          console.error('Error al subir la imagen:', error);
          return;
        }
      }

      // Crear el objeto con los datos actualizados - eliminando valores undefined
      const datosActualizados: any = {
        ...this.selectedItem,
        fechaCompletado: this.selectedItem.fechaCompletado || new Date().toISOString().split('T')[0],
        horaCompletado: this.selectedItem.horaCompletado || new Date().toTimeString().slice(0, 5),
        completPor: user.displayName || '',
        historial: this.selectedItem.historial || [],
      };

      // Solo agregar imgcompletado si no es undefined
      if (imgURL !== undefined && imgURL !== null) {
        datosActualizados.imgcompletado = imgURL;
      }

      // Eliminar cualquier campo undefined del objeto
      Object.keys(datosActualizados).forEach(key => {
        if (datosActualizados[key] === undefined) {
          delete datosActualizados[key];
        }
      });

      // Guardar en Firestore
      await this.itinerarioService.updateItinerario(this.selectedItem.id, datosActualizados);

      // Solo después de guardar exitosamente
      this.message.success('Itinerario actualizado correctamente');
      this.limpiarCampos(); // Limpiar primero
      this.handleCancel(); // Luego cerrar modal

    } catch (error) {
      console.error('Error al obtener o actualizar el itinerario:', error);
      this.message.error('Error al guardar el itinerario');
    }
  }

  handleCancel(): void {
    this.isVisible = false;
  }

  // ========== MÉTODOS DE EN PROCESO ==========
  enProcesoItem(item: Itinerario): void {
    this.selectedItem = { ...item, estado: Estado.INCOMPLETO, obsEnProceso: '' };
    this.selectedItem.fechaCompletado = '';
    this.selectedItem.horaCompletado = '';
    this.setFechaHoraActual();
    this.isEnProcesoVisible = true;
    this.validarFormularioEnProceso();
  }

  validarFormularioEnProceso(): void {
    this.formularioValido = !!this.selectedItem?.obsEnProceso?.trim();
  }

  async guardarEstadoEnProceso(): Promise<void> {
    if (!this.selectedItem) return;

    this.validarFormularioEnProceso();
    if (!this.formularioValido) {
      this.message.error('La observación es obligatoria para guardar el estado.');
      return;
    }

    const user = this.usersService.getCurrentUser();
    if (!user) {
      this.message.error('No hay un usuario autenticado.');
      return;
    }

    const ahora = new Date();
    const nuevaEntrada = {
      observacion: this.selectedItem.obsEnProceso || '',
      fecha: ahora.toISOString().split('T')[0],
      hora: ahora.toTimeString().slice(0, 5),
      uid: user.uid,
      email: user.email || '',
      nombre: user.displayName || '',
    };

    try {
      await this.itinerarioService.updateItinerario(this.selectedItem.id, {
        estado: Estado.INCOMPLETO,
        historial: [nuevaEntrada],
      });
      this.message.success('Estado actualizado correctamente');
      this.isEnProcesoVisible = false;
      this.selectedItem = {};
      this.formularioValido = false;
    } catch (error) {
      console.error('Error al actualizar el itinerario:', error);
      this.message.error('Error al guardar el estado.');
    }
  }

  handleCancelEnProceso(): void {
    this.isEnProcesoVisible = false;
    this.selectedItem = {};
    this.imagenSeleccionada = null;
    this.imageFileList = [];
    this.formularioValido = false;
  }

  // ========== MÉTODOS DE ARCHIVOS ==========
  onFileSelected(event: any): void {
    const file = event.target?.files?.[0] || null;
    if (file) {
      console.log('Archivo seleccionado:', file);
      this.imagenSeleccionada = file;
      this.imageFileList = [{
        uid: '-1',
        name: file.name,
        status: 'done',
        originFileObj: file
      }];
      this.validarFormulario();
    } else {
      console.warn('No se seleccionó ningún archivo.');
    }
  }

  // ========== MÉTODOS DE ACTIVIDADES ==========
  async cargarActividades(): Promise<void> {
    const rutasDiarias = await this.itinerarioService.getRutasDiarias().toPromise();
    if (rutasDiarias) {
      this.actividades = rutasDiarias.map(ruta => ruta.lugar.join(', '));
    }
  }

  agregarActividadTemporal(): void {
    if (this.nuevaActividad.trim()) {
      this.actividadesTemporales.push(this.nuevaActividad.trim());
      this.nuevaActividad = '';
    }
  }

  eliminarActividadTemporal(index: number): void {
    this.actividadesTemporales.splice(index, 1);
  }

  async agregarActividad(): Promise<void> {
    if (this.actividad.trim()) {
      const nuevaRuta: Omit<RutaDiaria, 'id' | 'orden'> = {
        fecha: new Date().toISOString(),
        lugar: [this.actividad.trim()]
      };
      await this.itinerarioService.createRutaDiaria(nuevaRuta);
      this.actividad = '';
      this.cargarActividades();
    }
  }

  async guardarTodasLasActividades(): Promise<void> {
    if (this.actividadesTemporales.length > 0) {
      const rutaDiaria: Omit<RutaDiaria, 'id' | 'orden'> = {
        fecha: new Date().toISOString(),
        lugar: this.actividadesTemporales,
      };

      try {
        await this.itinerarioService.createRutaDiaria(rutaDiaria);
        this.message.success('Actividades guardadas correctamente.');
        this.actividadesTemporales = [];
      } catch (error) {
        console.error('Error al guardar las actividades:', error);
        this.message.error('Hubo un error al guardar las actividades.');
      }
    }
  }

  editarActividad(index: number): void {
    this.editIndex = index;
    this.editActividad = this.actividadesTemporales[index];
  }

  guardarEdicion(index: number): void {
    if (this.editActividad.trim()) {
      this.actividadesTemporales[index] = this.editActividad.trim();
      this.editIndex = null;
      this.editActividad = '';
    }
  }

  async eliminarActividad(index: number): Promise<void> {
    const rutaDiaria = await this.itinerarioService.getRutasDiarias().toPromise();
    if (rutaDiaria) {
      const ruta = rutaDiaria[index];
      await this.itinerarioService.deleteRutaDiaria(ruta.id);
      this.cargarActividades();
    }
  }

  moverArriba(index: number): void {
    if (index > 0) {
      const temp = this.actividadesTemporales[index];
      this.actividadesTemporales[index] = this.actividadesTemporales[index - 1];
      this.actividadesTemporales[index - 1] = temp;
    }
  }

  moverAbajo(index: number): void {
    if (index < this.actividadesTemporales.length - 1) {
      const temp = this.actividadesTemporales[index];
      this.actividadesTemporales[index] = this.actividadesTemporales[index + 1];
      this.actividadesTemporales[index + 1] = temp;
    }
  }

  obtenerActividadesGuardadas(): void {
    this.itinerarioService.getRutasDiarias().subscribe({
      next: (data) => {
        this.actividadesGuardadas = data.sort((a, b) =>
          new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        );
      },
      error: (error) => {
        console.error('Error al obtener las actividades guardadas:', error);
        this.message.error('Error al cargar las actividades guardadas.');
      },
      complete: () => {
        this.cdr.detectChanges();
      }
    });
  }

  getActividadesAMostrar(): any[] {
    return this.mostrarTodos ? this.actividadesGuardadas : [this.actividadesGuardadas[0]];
  }

  toggleMostrarTodos(): void {
    this.mostrarTodos = !this.mostrarTodos;
    this.cdr.detectChanges();
  }

  async eliminarActividadGuardada(index: number): Promise<void> {
    const actividad = this.actividadesGuardadas[index];
    const id = actividad.id;
    try {
      await this.itinerarioService.deleteRutaDiaria(id);
      this.actividadesGuardadas.splice(index, 1);
      this.message.success('Actividad eliminada correctamente.');
    } catch (error) {
      console.error('Error al eliminar la actividad:', error);
      this.message.error('Error al eliminar la actividad. Inténtalo de nuevo.');
    }
    this.cdr.detectChanges();
  }

  // ========== MÉTODOS DE NOTIFICACIONES ==========
  private esFechaTerminoHoy(fechaTermino: string, estado: Estado): boolean {
    const fechaActual = new Date().toISOString().split('T')[0];
    return fechaTermino <= fechaActual && estado !== Estado.COMPLETADO;
  }

  agregarNotificacion(item: Itinerario): void {
    if (this.esFechaTerminoHoy(item.fechaTermino, item.estado)) {
      const notificacion = {
        id: item.id,
        solicita: item.creadoPor,
        area: item.area,
        tramite: item.tramite,
        fechaTermino: item.fechaTermino,
      };

      if (!this.notificaciones.some(n => n.tramite === notificacion.tramite && n.fechaTermino === notificacion.fechaTermino)) {
        this.notificaciones.push(notificacion);
        this.ordenarNotificacionesPorFecha();
      }
    }
  }

  private ordenarNotificacionesPorFecha(): void {
    this.notificaciones.sort((a, b) => {
      const fechaA = new Date(a.fechaTermino).getTime();
      const fechaB = new Date(b.fechaTermino).getTime();
      return fechaB - fechaA;
    });
  }

  // ========== MÉTODOS DE HISTORIAL ==========
  verHistorial(item: any): void {
    this.historialActual = item.historial || [];
    this.isHistorialVisible = true;
  }

  cerrarHistorial(): void {
    this.isHistorialVisible = false;
    this.historialActual = [];
  }

  // ========== MÉTODOS DE UTILIDAD ==========
  irASeccion(): void {
    this.rutaActividades.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  setFechaHoraActual(): void {
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().slice(0, 5);
    this.selectedItem.fechaCompletado = fecha;
    this.selectedItem.horaCompletado = hora;
  }

  limpiarCampos(): void {
    this.selectedItem = null;
    this.imagenSeleccionada = null;
    this.imageFileList = [];
    this.isVisible = false;
  }

  // ========== MÉTODOS DE USUARIOS ==========
  getCurrentUserId(): string | null {
    const user = this.usersService.getCurrentUser();
    return user ? user.uid : null;
  }

  getCurrentUserEmail(): string | null {
    const user = this.usersService.getCurrentUser();
    return user ? user.email : null;
  }

  getCurrentUserName(): string | null {
    const user = this.usersService.getCurrentUser();
    return user ? user.displayName : null;
  }

  // ========== MÉTODOS DE ESTADO ==========
  getEstadoColor(estado: Estado): string {
    switch (estado) {
      case Estado.COMPLETADO: return 'green';
      case Estado.INCOMPLETO: return 'orange';
      case Estado.PENDIENTE: return 'red';
      default: return 'gray';
    }
  }

  getEstadoTexto(estado: Estado): string {
    switch (estado) {
      case Estado.COMPLETADO: return 'Completado';
      case Estado.INCOMPLETO: return 'Incompleto';
      case Estado.PENDIENTE: return 'Pendiente';
      default: return 'Estado desconocido';
    }
  }

  // ========== MÉTODOS DE PDF ==========
  descargarRegistrosPDF(): void {
    if (this.filteredItinerarios.length === 0) {
      this.message.warning('No hay registros para descargar.');
      return;
    }

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    pdf.setFont('Helvetica');

    const columnas = [
      'Estado', 'Área Oficina', 'Trámite', 'Unidad', 'Piso y Juez',
      'Área', 'Diligencia', 'Recibe', 'Fechas', 'Observaciones'
    ];

    const normalizarTexto = (texto: string): string => {
      return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    };

    const filas = this.filteredItinerarios.map(itinerario => [
      itinerario.estado || '',
      `Área: ${itinerario.manualArea || itinerario.area || ''}\nSolicita: ${itinerario.creadoPor || ''}`,
      `Actividad: ${itinerario.tramite || ''}\n${itinerario.nroProceso ? 'N° Juicio: ' + itinerario.nroProceso : ''}`,
      itinerario.manualJuzgado || itinerario.juzgado || '',
      `Piso: ${itinerario.manualPiso || itinerario.piso || ''}\nJuez: ${normalizarTexto(itinerario.juez || '')}`,
      itinerario.manualMateria || itinerario.materia || '',
      itinerario.manualDiligencia || itinerario.diligencia || '',
      itinerario.solicita || '',
      `Solicitud: ${itinerario.fechaSolicitud || ''}\nHora: ${itinerario.horaSolicitud || ''}\nTérmino: ${itinerario.fechaTermino || ''}`,
      itinerario.observaciones || ''
    ]);

    autoTable(pdf, {
      head: [columnas],
      body: filas,
      startY: 20,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [13, 20, 27] },
      columnStyles: {
        0: { cellWidth: 18 }, // Estado
        1: { cellWidth: 20 }, // Área Oficina
        2: { cellWidth: 40 }, // Trámite
        3: { cellWidth: 18 }, // Unidad
        4: { cellWidth: 30 }, // Piso y Juez
        5: { cellWidth: 20 }, // Área
        6: { cellWidth: 30 }, // Diligencia
        7: { cellWidth: 18 }, // Recibe
        8: { cellWidth: 35 }, // Fechas
        9: { cellWidth: 40 } // Observaciones
      },
    });

    pdf.save('itinerarios.pdf');
  }

  // ========== MÉTODOS DE TABLA Y SELECCIÓN ==========
  trackById(index: number, item: Itinerario): string | undefined {
    return item.id;
  }

  onCurrentPageDataChange(list: readonly Itinerario[]): void {
    this.listOfCurrentPageData = [...list];
    this.refreshCheckedStatus();
  }

  refreshCheckedStatus(): void {
    const listOfEnabledData = this.listOfCurrentPageData;
    this.checked = listOfEnabledData.every(({ id }) => id && this.setOfCheckedId.has(id));
    this.indeterminate = listOfEnabledData.some(({ id }) => id && this.setOfCheckedId.has(id)) && !this.checked;
  }

  onItemChecked(id: string, checked: boolean): void {
    if (checked) {
      this.setOfCheckedId.add(id);
    } else {
      this.setOfCheckedId.delete(id);
    }
    this.refreshCheckedStatus();
  }

  onAllChecked(checked: boolean): void {
    this.listOfCurrentPageData.forEach(({ id }) => {
      if (id) {
        if (checked) {
          this.setOfCheckedId.add(id);
        } else {
          this.setOfCheckedId.delete(id);
        }
      }
    });
    this.refreshCheckedStatus();
  }
}