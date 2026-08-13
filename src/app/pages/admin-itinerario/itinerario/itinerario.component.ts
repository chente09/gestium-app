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
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { Subject, takeUntil } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

import { ItinerarioService, Itinerario, RutaDiaria } from '../../../services/itinerario/itinerario.service';
import { UsersService } from '../../../services/users/users.service';
import { RegistersService } from '../../../services/registers/registers.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedDataService } from '../../../services/sharedData/shared-data.service';
import { DateUtilsService } from '../../../services/date-utils/date-utils.service';
import { ItinerarioEditModalComponent } from '../itinerario-edit-modal/itinerario-edit-modal.component';

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
    NzPopconfirmModule,
    NzAlertModule,
    NzToolTipModule,
    NzCollapseModule,
    ItinerarioEditModalComponent
  ],
  templateUrl: './itinerario.component.html',
  styleUrl: './itinerario.component.css'
})
export class ItinerarioComponent implements OnInit {

  // ========== PROPIEDADES DE DATOS ==========
  itinerarios: Itinerario[] = [];
  filteredItinerarios: Itinerario[] = [];
  listOfCurrentPageData: Itinerario[] = [];
  notificaciones: {
    area: string;
    tramite: string;
    fechaTermino: string;
    solicita: string;
    id: string;
    diasVencidos: number;
    prioridad: 'alta' | 'media' | 'baja';
    fechaLegible: string;
  }[] = [];

  // ========== PROPIEDADES DE ESTADO ==========
  loading = true;
  uploading = false;
  mostrarFormulario = false;
  formularioValido = false;
  mostrarNotificaciones = false;
  mostrarTodos = false;
  notificacionFiltroActivo: string | null = null;

  // ========== EDICIÓN (modal compartido con Historial) ==========
  editModalVisible = false;
  editingItem: Itinerario | null = null;

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
  pdfCompletadoSeleccionado: File | null = null;
  readonly maxPdfSizeMB = 5;

  // ========== PROPIEDADES DE FECHA/HORA ==========
  fechaActual: string = '';
  horaActual: string = '';

  // ========== FILTROS ==========
  selectedArea = new FormControl('');
  selectedDate = new FormControl<[Date | null, Date | null]>([null, null]);
  selectedEstado = new FormControl(null);
  searchTerm: string = '';

  // ========== CONFIGURACIONES ==========
  areas: { nombre: string; slug: string }[] = [];
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
    private registersService: RegistersService,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef,
    private sharedDataService: SharedDataService,
    private dateUtils: DateUtilsService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  // ID a abrir en edición apenas cargue la lista, cuando se llega acá vía
  // /itinerario?editId=... (por ejemplo desde el aviso de proceso duplicado
  // activo en el formulario de creación).
  private editIdPendiente: string | null = null;

  // ========== MÉTODOS DE CICLO DE VIDA ==========
  ngOnInit(): void {
    this.editIdPendiente = this.route.snapshot.queryParamMap.get('editId');
    this.initializeComponent();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========== MÉTODOS DE INICIALIZACIÓN ==========
  private initializeComponent(): void {
    this.registersService.getActiveAreaEntries().then(entries => {
      this.areas = [...entries, { nombre: 'Otro', slug: 'Otro' }];
    });
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
    this.itinerarioService.getItinerariosPendientes().subscribe(data => {
      if (!Array.isArray(data)) {
        console.warn("Los datos obtenidos no son un array:", data);
        this.loading = false;
        return;
      }

      this.itinerarios = data;
      this.filterItinerarios();

      this.itinerarios.forEach(item => {
        this.editCache[item.id] = { edit: false };
        if (this.esFechaTerminoVencida(item.fechaTermino, item.estado)) {
          this.agregarNotificacion(item);
        }
      });

      this.loading = false;
      this.abrirEdicionPendienteSiCorresponde();
    });
  }

  private abrirEdicionPendienteSiCorresponde(): void {
    if (!this.editIdPendiente) return;
    const item = this.itinerarios.find(i => i.id === this.editIdPendiente);
    this.editIdPendiente = null;
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    if (item) {
      this.startEdit(item);
    } else {
      this.message.warning('El itinerario ya no está disponible para editar (puede que ya no esté pendiente/incompleto).');
    }
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
    const duplicadosMap = new Map<string, Itinerario[]>();

    // Crear una "huella digital" única para cada registro
    this.itinerarios.forEach(item => {
      // Combinar TODOS los campos importantes que deberían ser únicos
      const huella = [
        item.area,
        item.tramite,
        item.nroProceso || '',
        item.juzgado || '',
        item.piso || '',
        item.materia || '',
        item.diligencia || '',
        item.solicita || '',
        item.fechaSolicitud,
        item.horaSolicitud || '',
        item.fechaTermino,
        item.creadoPor
      ].join('|').toLowerCase().trim();

      if (!duplicadosMap.has(huella)) {
        duplicadosMap.set(huella, []);
      }
      duplicadosMap.get(huella)!.push(item);
    });

    // Extraer solo grupos con más de 1 registro (duplicados reales)
    const duplicados: Itinerario[] = [];
    let gruposDuplicados = 0;

    duplicadosMap.forEach((items, huella) => {
      if (items.length > 1) {
        duplicados.push(...items);
        gruposDuplicados++;
      }
    });

    if (duplicados.length === 0) {
      this.message.info('✅ No se encontraron registros duplicados.');
      this.filteredItinerarios = [];
    } else {
      this.filteredItinerarios = this.sortData(duplicados);
      this.message.warning(
        `⚠️ Se encontraron ${duplicados.length} registros duplicados distribuidos en ${gruposDuplicados} grupos.`
      );
      console.table(duplicados.map(d => ({
        ID: d.id,
        Trámite: d.tramite,
        Área: d.area,
        'Nº Proceso': d.nroProceso,
        Fecha: d.fechaSolicitud,
        'Creado por': d.creadoPor
      })));
    }

    this.cdr.detectChanges();
  }

  showAllAreas(): void {
    this.selectedArea.setValue('');
    this.selectedDate.setValue([null, null]);
    this.selectedEstado.setValue(null);
    this.filterItinerarios();
  }

  // El itinerario guarda el slug del área; esto lo traduce al nombre para mostrar.
  getAreaDisplayName(slug: string): string {
    return this.areas.find(area => area.slug === slug)?.nombre || slug;
  }

  // ========== MÉTODOS DE COMPLETAR ITEM ==========
  async completarItem(item: Itinerario): Promise<void> {
    this.selectedItem = { ...item, estado: Estado.COMPLETADO };
    this.setFechaHoraActual();
    this.isVisible = true;
    this.validarFormulario();
  }

  // Por área en vez de por email: así reasignar quién está en Trámites
  // (o quitar la restricción) se hace desde Admin > Usuarios, sin tocar código.
  validarFormulario(): void {
    const area = this.registersService.getCurrentRegister()?.areaAsignada;

    if (area === 'tramites') {
      // Solo válido si tiene observación + imagen
      this.formularioValido = !!(
        this.selectedItem?.obsCompletado?.trim() &&
        this.imagenSeleccionada
      );
    } else {
      // Para el resto de áreas siempre es válido
      this.formularioValido = true;
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
          imgURL = await this.itinerarioService.uploadFile(filePath, this.imagenSeleccionada);
        } catch (error) {
          this.message.error('Error al subir la imagen');
          console.error('Error al subir la imagen:', error);
          return;
        }
      }

      let pdfURL = this.selectedItem.pdfCompletado;

      // Subir PDF si hay uno nuevo seleccionado
      if (this.pdfCompletadoSeleccionado) {
        const pdfPath = `itinerarios/pdfsComplete/${Date.now()}_${this.pdfCompletadoSeleccionado.name}`;
        try {
          pdfURL = await this.itinerarioService.uploadFile(pdfPath, this.pdfCompletadoSeleccionado);
        } catch (error) {
          this.message.error('Error al subir el PDF');
          console.error('Error al subir el PDF:', error);
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

      // Solo agregar pdfCompletado si no es undefined
      if (pdfURL !== undefined && pdfURL !== null) {
        datosActualizados.pdfCompletado = pdfURL;
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

  onPdfCompletadoSelected(event: any): void {
    const file = event.target?.files?.[0] || null;
    if (!file) return;

    const maxBytes = this.maxPdfSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      this.message.error(
        `El PDF pesa ${(file.size / 1024 / 1024).toFixed(1)}MB, el máximo permitido es ${this.maxPdfSizeMB}MB. Comprímelo antes de subirlo (ej. ilovepdf.com o smallpdf.com) y vuelve a intentarlo.`
      );
      event.target.value = '';
      return;
    }

    this.pdfCompletadoSeleccionado = file;
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
  private esFechaTerminoVencida(fechaTermino: string, estado: Estado): boolean {
    if (estado === Estado.COMPLETADO) {
      return false;
    }

    // ✅ LÓGICA CORREGIDA: solo vencidas (anterior a hoy, SIN incluir hoy)
    return this.dateUtils.isFechaVencida(fechaTermino);
  }

  agregarNotificacion(item: Itinerario): void {
    if (!this.esFechaTerminoVencida(item.fechaTermino, item.estado)) {
      return;
    }

    const diasVencidos = this.dateUtils.getDiasVencidos(item.fechaTermino);

    let prioridad: 'alta' | 'media' | 'baja';
    if (diasVencidos > 7) {
      prioridad = 'alta';
    } else if (diasVencidos > 3) {
      prioridad = 'media';
    } else {
      prioridad = 'baja';
    }

    const notificacion = {
      id: item.id,
      solicita: item.creadoPor,
      area: item.area,
      tramite: item.tramite,
      fechaTermino: item.fechaTermino,
      diasVencidos: diasVencidos,
      prioridad: prioridad,
      fechaLegible: this.dateUtils.formatFechaLegible(item.fechaTermino)
    };

    // Verificar duplicados por ID (más confiable)
    const yaExiste = this.notificaciones.some(n => n.id === notificacion.id);

    if (!yaExiste) {
      this.notificaciones.push(notificacion);
      this.ordenarNotificacionesPorFecha();
    }
  }

  private ordenarNotificacionesPorFecha(): void {
    this.notificaciones.sort((a, b) => {
      const fechaA = new Date(a.fechaTermino).getTime();
      const fechaB = new Date(b.fechaTermino).getTime();
      return fechaB - fechaA;
    });
  }

  // Al hacer clic en una notificación, la tabla se filtra a ese único
  // registro en vez de dejar la lista de notificaciones como una vitrina
  // sin acción.
  irANotificacion(notif: { id: string }): void {
    const item = this.itinerarios.find(i => i.id === notif.id);
    if (!item) {
      this.message.warning('No se encontró el registro (puede que ya haya cambiado de estado).');
      return;
    }

    this.notificacionFiltroActivo = notif.id;
    this.filteredItinerarios = [item];
    this.pageIndex = 1;
    this.mostrarNotificaciones = false;
    this.cdr.detectChanges();

    document.getElementById('tabla-itinerarios')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  limpiarFiltroNotificacion(): void {
    this.notificacionFiltroActivo = null;
    this.filterItinerarios();
  }

  // Mismo modal de edición que Historial, para no tener que salir de
  // Pendientes a editar algo que sigue pendiente. La lista se actualiza
  // sola: esta pantalla mantiene un listener en tiempo real.
  startEdit(item: Itinerario): void {
    const areaAsignada = this.registersService.getCurrentRegister()?.areaAsignada;
    if (!areaAsignada || areaAsignada === 'sin_asignar') {
      this.message.error('No tienes permiso para editar este itinerario.');
      return;
    }

    this.editingItem = item;
    this.editModalVisible = true;
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
    this.pdfCompletadoSeleccionado = null;
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
      `Área: ${itinerario.manualArea || this.getAreaDisplayName(itinerario.area || '')}\nSolicita: ${itinerario.creadoPor || ''}`,
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

  // Fila compacta por defecto; el detalle completo (unidad, piso, materia,
  // diligencia, adjuntos, historial) se abre bajo demanda en vez de mostrar
  // 14 columnas siempre — mismo patrón que la tabla de Roles de Pago.
  private expandedIds = new Set<string>();

  toggleExpand(id: string): void {
    if (this.expandedIds.has(id)) {
      this.expandedIds.delete(id);
    } else {
      this.expandedIds.add(id);
    }
  }

  isExpanded(id: string): boolean {
    return this.expandedIds.has(id);
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