import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzTableComponent, NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';

import { ItinerarioService, Itinerario, RutaDiaria } from '../../../services/itinerario/itinerario.service';
import { UsersService } from '../../../services/users/users.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { RouterModule } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzFormModule } from 'ng-zorro-antd/form';
import { Subject, takeUntil } from 'rxjs';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import jsPDF from 'jspdf';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';

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

  itinerarios: Itinerario[] = [];
  filteredItinerarios: Itinerario[] = [];
  setOfCheckedId = new Set<string>(); // IDs seleccionados
  loading = true;
  uploading = false;
  selectedItem: any = {};
  editCache: { [key: string]: { edit: boolean } } = {};
  Estado = Estado;
  mostrarFormulario = false; // Controla si se muestra el formulario
  formularioValido = false; // Controla si el botón "Guardar" está habilitado
  imagenSeleccionada: File | null = null;
  imageFileList: any[] = [];
  fechaActual: string = '';  // Variable para la fecha por defecto
  horaActual: string = '';
  notificaciones: { area: string; tramite: string; fechaTermino: string }[] = [];
  mostrarNotificaciones = false; // Estado para mostrar/ocultar la lista

  isVisible = false; // Controla la visibilidad del modal
  isEnProcesoVisible = false;
  isConfirmLoading = false;

  isHistorialVisible = false; // Controla la visibilidad del modal
  historialActual: any[] = []; // Almacena el historial actual

  actividad: string = '';
  actividades: string[] = [];

  nuevaActividad: string = '';
  actividadesTemporales: string[] = [];
  editIndex: number | null = null;
  editActividad: string = '';
  actividadesGuardadas: RutaDiaria[] = [];  // Almacena las actividades guardadas
  mostrarTodos: boolean = false;

  @ViewChild('rowSelectionTable') rowSelectionTable!: NzTableComponent<Itinerario>;
  @ViewChild('rutaActividades') rutaActividades!: ElementRef;

  // Filtros
  selectedArea = new FormControl('');
  selectedDate = new FormControl<[Date | null, Date | null]>([null, null]);
  areas: string[] = ['ISSFA', 'Bco. Pichincha', 'Bco. Produbanco', 'BNF', 'Inmobiliaria', 'David', 'Otro'];

  selectedEstado = new FormControl(null);
  estados: string[] = ['Incompleto', 'Pendiente'];

  listOfCurrentPageData: Itinerario[] = [];
  checked = false;
  indeterminate = false;

  searchTerm: string = '';

  pageSize = 20;
  pageIndex = 1;

  constructor(
    private itinerarioService: ItinerarioService,
    private usersService: UsersService,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef
  ) { }

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.setFechaHoraActual();
    this.itinerarioService.getItinerarios().subscribe(data => {
      if (!Array.isArray(data)) {
        console.warn("Los datos obtenidos no son un array:", data);
        this.loading = false;
        return;
      }

      this.itinerarios = data;
      this.filterItinerarios(); // Filtrar datos después de obtenerlos

      this.itinerarios.forEach(item => {
        this.editCache[item.id] = { edit: false };

        // Verificar si la fecha de término es igual a la fecha actual
        if (this.esFechaTerminoHoy(item.fechaTermino, item.estado)) {
          this.agregarNotificacion(item);
        }
      });

      this.loading = false;
    });



    this.cargarActividades();
    this.obtenerActividadesGuardadas();

    // Detectar cambios en los filtros
    this.selectedArea.valueChanges.subscribe(() => this.filterItinerarios());
    this.selectedDate.valueChanges.subscribe(() => this.filterItinerarios());
    this.selectedEstado.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
  }

  onSearch(): void {
    this.filterItinerarios();
  }
  irASeccion() {
    this.rutaActividades.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  filterItinerarios(): void {
    const selectedAreaValue = this.selectedArea.value;
    const selectedEstadoValue = this.selectedEstado.value;
    const [fechaInicio, fechaFin] = this.selectedDate.value || [null, null];

    // Filtrar los datos
    this.filteredItinerarios = this.itinerarios.filter(item => {
      // Usar el enum Estado para filtrar los estados correctamente
      const estado = item.estado; // Esto ya es el valor del enum
      const estadoStr = String(item.estado).toLowerCase();
      const isEstadoMatch = selectedEstadoValue ? estadoStr === String(selectedEstadoValue).toLowerCase() : true;
      const isPendingOrIncomplete = estado === Estado.PENDIENTE || estado === Estado.INCOMPLETO;
      const isAreaMatch = selectedAreaValue ? item.area === selectedAreaValue : true;
      const fechaSolicitud = new Date(item.fechaSolicitud);
      const searchTermLower = this.searchTerm.toLowerCase();

      const isDateInRange =
        (!fechaInicio || fechaSolicitud >= new Date(fechaInicio)) &&
        (!fechaFin || fechaSolicitud <= new Date(fechaFin));

      // Busca coincidencias en todos los campos relevantes
      const isSearchMatch = searchTermLower === '' ||
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(searchTermLower)
        );

      return isPendingOrIncomplete && isAreaMatch && isDateInRange && isEstadoMatch && isSearchMatch;
    });
    // Ordenar los datos después de filtrar
    this.filteredItinerarios = this.sortData(this.filteredItinerarios);

    this.cdr.detectChanges();
  }

  private sortData(itinerarios: Itinerario[]): Itinerario[] {
    const unidadOrder: string[] = ['Pague Ya', 'Municipio', 'Notaria', 'SUPERCIAS','AMT', 'ANT', 'SRI', 'ISSFA', 'Consejo Provincial', 'Registro Propiedad', 'Registro Mercantil', 'Quitumbe', 'Iñaquito', 'Mejía', 'Cayambe', 'Rumiñahui', 'Calderon', 'Otro', ''];
    const pisoOrder: string[] = ['Pb', '5to', '8vo', 'Otro', ''];
    const materiaOrder: string[] = [
      'Archivo', 'Ingresos', 'Coordinación', 'Diligencias no Penales',
      'Oficina de Citaciones', 'Familia', 'Laboral', 'Penal', 'Civil', 'Otro', ''
    ];
    const diligenciaOrder: string[] = [
      'Copias para Citar', 'Desglose', 'Requerimiento', 'Retiro Oficios', 'Otro', ''
    ];

    return itinerarios.sort((a, b) => {
      // Obtener los índices en cada orden
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

      // Función para manejar valores no encontrados
      const getSafeIndex = (index: number, orderArray: string[]) =>
        index === -1 ? orderArray.length : index;

      // Comparar según la jerarquía
      return (
        getSafeIndex(indexUnidadA, unidadOrder) - getSafeIndex(indexUnidadB, unidadOrder) ||
        getSafeIndex(indexPisoA, pisoOrder) - getSafeIndex(indexPisoB, pisoOrder) ||
        getSafeIndex(indexMateriaA, materiaOrder) - getSafeIndex(indexMateriaB, materiaOrder) ||
        getSafeIndex(indexDiligenciaA, diligenciaOrder) - getSafeIndex(indexDiligenciaB, diligenciaOrder) ||
        fechaA - fechaB 
      );
    });
  }


  async cargarActividades() {
    const rutasDiarias = await this.itinerarioService.getRutasDiarias().toPromise();
    if (rutasDiarias) {
      this.actividades = rutasDiarias.map(ruta => ruta.lugar.join(', '));
    }
  }

  agregarActividadTemporal() {
    if (this.nuevaActividad.trim()) {
      this.actividadesTemporales.push(this.nuevaActividad.trim());
      this.nuevaActividad = ''; // Limpia el input
    }
  }

  // Elimina una actividad del arreglo temporal
  eliminarActividadTemporal(index: number) {
    this.actividadesTemporales.splice(index, 1);
  }


  async agregarActividad() {
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

  // Guarda todas las actividades en Firestore
  async guardarTodasLasActividades() {
    if (this.actividadesTemporales.length > 0) {
      const rutaDiaria: Omit<RutaDiaria, 'id' | 'orden'> = {
        fecha: new Date().toISOString(), // Fecha actual
        lugar: this.actividadesTemporales, // Todas las actividades
      };

      try {
        await this.itinerarioService.createRutaDiaria(rutaDiaria);
        this.message.success('Actividades guardadas correctamente.');
        this.actividadesTemporales = []; // Limpia el arreglo temporal
      } catch (error) {
        console.error('Error al guardar las actividades:', error);
        this.message.error('Hubo un error al guardar las actividades.');
      }
    }
  }

  editarActividad(index: number) {
    this.editIndex = index;
    this.editActividad = this.actividadesTemporales[index];
  }

  guardarEdicion(index: number) {
    if (this.editActividad.trim()) {
      this.actividadesTemporales[index] = this.editActividad.trim();
      this.editIndex = null; // Finaliza la edición
      this.editActividad = ''; // Limpia el campo de edición
    }
  }

  async eliminarActividad(index: number) {
    const rutaDiaria = await this.itinerarioService.getRutasDiarias().toPromise();
    if (rutaDiaria) {
      const ruta = rutaDiaria[index];
      await this.itinerarioService.deleteRutaDiaria(ruta.id);
      this.cargarActividades();
    }
  }

  moverArriba(index: number) {
    if (index > 0) {
      const temp = this.actividadesTemporales[index];
      this.actividadesTemporales[index] = this.actividadesTemporales[index - 1];
      this.actividadesTemporales[index - 1] = temp;
    }
  }

  moverAbajo(index: number) {
    if (index < this.actividadesTemporales.length - 1) {
      const temp = this.actividadesTemporales[index];
      this.actividadesTemporales[index] = this.actividadesTemporales[index + 1];
      this.actividadesTemporales[index + 1] = temp;
    }
  }


  obtenerActividadesGuardadas(): void {
    this.itinerarioService.getRutasDiarias().subscribe({
      next: (data) => {
        // Ordenar por fecha (más reciente primero)
        this.actividadesGuardadas = data.sort((a, b) =>
          new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        );
      },
      error: (error) => {
        console.error('Error al obtener las actividades guardadas:', error);
        this.message.error('Error al cargar las actividades guardadas.');
      },
      complete: () => {
        this.cdr.detectChanges(); // Detecta los cambios en la vista
      }
    });
  }

  // Función para obtener las actividades a mostrar
  getActividadesAMostrar(): any[] {
    return this.mostrarTodos ? this.actividadesGuardadas : [this.actividadesGuardadas[0]];

  }

  toggleMostrarTodos(): void {
    this.mostrarTodos = !this.mostrarTodos; // Cambia el estado de "mostrarTodos"
    this.cdr.detectChanges();
  }
  


  // Eliminar una actividad guardada (opcional)
  async eliminarActividadGuardada(index: number): Promise<void> {
    const actividad = this.actividadesGuardadas[index]; // Obtén la actividad a eliminar
    const id = actividad.id; // Obtén el ID de la actividad
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

  // Método para verificar si la fecha de término es hoy y el estado no es COMPLETADO
  esFechaTerminoHoy(fechaTermino: string, estado: Estado): boolean {
    const fechaActual = new Date().toISOString().split('T')[0]; // Fecha actual en formato YYYY-MM-DD
    return fechaTermino <= fechaActual && estado !== Estado.COMPLETADO;
  }

  agregarNotificacion(item: Itinerario): void {
    if (this.esFechaTerminoHoy(item.fechaTermino, item.estado)) {
      const notificacion = {
        area: item.area,
        tramite: item.tramite,
        fechaTermino: item.fechaTermino,
      };

      if (!this.notificaciones.some(n => n.tramite === notificacion.tramite && n.fechaTermino === notificacion.fechaTermino)) {
        this.notificaciones.push(notificacion);
      }
    }
  }


  descargarRegistrosPDF(): void {
    if (this.filteredItinerarios.length === 0) {
      this.message.warning('No hay registros para descargar.');
      return;
    }
  
    const pdf = new jsPDF({
      orientation: 'landscape', // Orientación horizontal
      unit: 'mm',
      format: 'a4',
    });
  
    pdf.setFont('Helvetica');

    // Definir las columnas con los mismos nombres de la tabla
    const columnas = [
      'Estado',
      'Área Oficina',
      'Trámite',
      'Unidad',
      'Piso y Juez',
      'Área',
      'Diligencia',
      'Recibe',
      'Fechas',
      'Observaciones'
    ];
  
    // Función para normalizar caracteres especiales
  const normalizarTexto = (texto: string): string => {
    return texto
      .normalize('NFD') // Normaliza los caracteres a su forma descompuesta
      .replace(/[\u0300-\u036f]/g, ''); // Elimina los acentos
  };

    // Extraer datos de `filteredItinerarios` y asegurarse de que no haya valores `undefined`
    const filas = this.filteredItinerarios.map(itinerario => [
      itinerario.estado || '', // Estado
      `Área: ${itinerario.manualArea || itinerario.area || ''}\nSolicita: ${itinerario.creadoPor || ''}`, // Área Oficina
      `Actividad: ${itinerario.tramite || ''}\n${itinerario.nroProceso ? 'N° Juicio: ' + itinerario.nroProceso : ''}`, // Trámite
      itinerario.manualJuzgado || itinerario.juzgado || '', // Unidad
      `Piso: ${itinerario.manualPiso || itinerario.piso || ''}\nJuez: ${normalizarTexto(itinerario.juez || '')}`,  // Piso y Juez
      itinerario.manualMateria || itinerario.materia || '', // Área
      itinerario.manualDiligencia || itinerario.diligencia || '', // Diligencia
      itinerario.solicita || '', // Recibe
      `Solicitud: ${itinerario.fechaSolicitud || ''}\nHora: ${itinerario.horaSolicitud || ''}\nTérmino: ${itinerario.fechaTermino || ''}`, // Fechas
      itinerario.observaciones || '' // Observaciones
    ]);
  
    // Generar la tabla en el PDF
    autoTable(pdf, {
      head: [columnas],
      body: filas,
      startY: 20, // Espacio desde la parte superior
      theme: 'striped', // Estilo de tabla (opciones: 'grid', 'striped', 'plain')
      styles: { fontSize: 8 }, // Reducir tamaño de fuente para mejor ajuste
      headStyles: { fillColor: [13, 20, 27] }, // Color de encabezado (verde)
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
  
    // Guardar el archivo PDF
    pdf.save('itinerarios.pdf');
  }
  

  getCurrentUserId(): string | null {
    const user = this.usersService.getCurrentUser();
    return user ? user.uid : null;
  }
  getCurrentUserEmail(): string | null {
    const user = this.usersService.getCurrentUser();
    return user ? user.email : null;
  }

  // Método para obtener el nombre del usuario actual
  getCurrentUserName(): string | null {
    const user = this.usersService.getCurrentUser();
    return user ? user.displayName : null;
  }

  getEstadoColor(estado: Estado): string {
    switch (estado) {
      case Estado.COMPLETADO:
        return 'green'; // Completado
      case Estado.INCOMPLETO:
        return 'orange'; // Incompleto
      case Estado.PENDIENTE:
        return 'red'; // Pendiente
      default:
        return 'gray'; // En caso de que el estado no sea válido
    }
  }

  getEstadoTexto(estado: Estado): string {
    switch (estado) {
      case Estado.COMPLETADO:
        return 'Completado';
      case Estado.INCOMPLETO:
        return 'Incompleto';
      case Estado.PENDIENTE:
        return 'Pendiente';
      default:
        return 'Estado desconocido'; // En caso de que el estado no sea válido
    }
  }

  showAllAreas(): void {
    this.selectedArea.setValue('');
    this.selectedDate.setValue([null, null]);
    this.selectedEstado.setValue(null);
    this.filterItinerarios();

  }
  // 📌 Asigna la fecha y hora actual si no existen
  setFechaHoraActual(): void {
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0]; // YYYY-MM-DD
    const hora = ahora.toTimeString().slice(0, 5);   // HH:MM

    // Actualiza la fecha y hora siempre
    this.selectedItem.fechaCompletado = fecha;
    this.selectedItem.horaCompletado = hora;
  }

  async completarItem(item: Itinerario): Promise<void> {
    this.selectedItem = { ...item, estado: Estado.COMPLETADO };

    // Asignar fecha y hora actual
    this.setFechaHoraActual();

    // Mostrar el modal para solicitar el formulario
    this.isVisible = true;

    // Inicializar la validación del formulario
    this.validarFormulario();
  }

  handleCancel(): void {
    this.isVisible = false;
  }

  validarFormulario(): void {
    // Validar que la imagen y la observación estén presentes
    this.formularioValido = !!this.selectedItem?.obsCompletado?.trim()
      && !!this.imagenSeleccionada;
  }

  onFileSelected(event: any) {
    const file = event.target?.files?.[0] || null;
    if (file) {
      console.log('Archivo seleccionado:', file);
      
      // Guardar el archivo para la subida
      this.imagenSeleccionada = file; 
  
      // Actualizar la lista de imágenes para la vista
      this.imageFileList = [{ 
        uid: '-1', 
        name: file.name, 
        status: 'done', 
        originFileObj: file 
      }];
  
      // Validar el formulario después de seleccionar la imagen
      this.validarFormulario();
    } else {
      console.warn('No se seleccionó ningún archivo.');
    }
  }
  

  async guardarEstado(): Promise<void> {
    if (!this.selectedItem) return;

    // Validar el formulario antes de guardar
    this.validarFormulario();
    if (!this.formularioValido) {
      this.message.error('La imagen y la observación son obligatorias para completar el ítem.');
      return;
    }

    const user = this.usersService.getCurrentUser();
    if (!user) {
      console.error("No hay un usuario autenticado.");
      return;
    }

    try {
      let imgURL = this.selectedItem.imgcompletado;

      // Subir imagen si hay una nueva seleccionada
      if (this.imagenSeleccionada) {
        const filePath = `itinerarios/imagesComplete/${Date.now()}_${this.imagenSeleccionada.name}`;
        try {
          imgURL = await this.itinerarioService.uploadImage(filePath, this.imagenSeleccionada);
          this.message.success('Imagen subida con éxito');
          this.imagenSeleccionada = null;
          this.handleCancel();
        } catch (error) {
          this.message.error('Error al subir la imagen');
          console.error('Error al subir la imagen:', error);
          return;
        }
      }

      // Crear el objeto con los datos actualizados
      const datosActualizados = {
        ...this.selectedItem,
        fechaCompletado: this.selectedItem.fechaCompletado || new Date().toISOString().split('T')[0],
        horaCompletado: this.selectedItem.horaCompletado || new Date().toTimeString().slice(0, 5),
        completPor: user.displayName,
        imgcompletado: imgURL,
        historial: this.selectedItem.historial || [], // Guardar el historial actualizado
      };

      // Guardar en Firestore
      await this.itinerarioService.updateItinerario(this.selectedItem.id, datosActualizados);

      this.message.success('Itinerario actualizado correctamente');
      this.mostrarFormulario = false;
      this.limpiarCampos();

    } catch (error) {
      console.error('Error al obtener o actualizar el itinerario:', error);
      this.message.error('Error al guardar el itinerario');
    }
  }

  enProcesoItem(item: Itinerario): void {
    this.selectedItem = { ...item, estado: Estado.INCOMPLETO, obsEnProceso: '' }; // Inicializar obsEnProceso
    this.selectedItem.fechaCompletado = '';
    this.selectedItem.horaCompletado = '';
    this.setFechaHoraActual();
    this.isEnProcesoVisible = true;
    this.validarFormularioEnProceso(); // Validar el formulario al abrir el modal
  }

  handleCancelEnProceso(): void {
    this.isEnProcesoVisible = false;
    this.limpiarCampos();
  }

  validarFormularioEnProceso(): void {
    this.formularioValido = !!this.selectedItem?.obsEnProceso?.trim();
  }

  async guardarEstadoEnProceso(): Promise<void> {
    if (!this.selectedItem) return;

    // Validar el formulario antes de guardar
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

    // Actualizar el itinerario con la nueva entrada y el estado INCOMPLETO
    try {
      await this.itinerarioService.updateItinerario(this.selectedItem.id, {
        estado: Estado.INCOMPLETO, // Actualizar el estado a INCOMPLETO
        historial: [nuevaEntrada], // Envía la nueva entrada como un arreglo
      });
      this.message.success('Estado actualizado correctamente');
      this.isEnProcesoVisible = false;
      this.limpiarCampos();
    } catch (error) {
      console.error('Error al actualizar el itinerario:', error);
      this.message.error('Error al guardar el estado.');
    }
  }

  verHistorial(item: any): void {
    this.historialActual = item.historial || []; // Asigna el historial del item
    this.isHistorialVisible = true; // Abre el modal
  }

  cerrarHistorial(): void {
    this.isHistorialVisible = false; // Cierra el modal
    this.historialActual = []; // Limpia el historial
  }

  limpiarCampos(): void {
    this.selectedItem = null;
    this.imagenSeleccionada = null;
    this.imageFileList = [];
    this.isVisible = false;
  }

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
