import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzTableComponent, NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';

import { ItinerarioService, Itinerario } from '../../services/itinerario/itinerario.service';
import { UsersService } from '../../services/users/users.service';
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
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';

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
  editIndex: number | null = null;
  editActividad: string = '';

  unidadOrder: string[] = ['Quitumbe', 'Iñaquito', 'Mejía', 'Cayambe', 'Rumiñahui', 'Calderon','Notaria 1','SUPERCIAS', 'ANT', 'Registro Propiedad', 'Otro',''];
  materiaOrder: string[] = ['Archivo', 'Ingresos', 'Coordinación', 'Diligencias no Penales', 'Oficina de Citaciones', 'Familia', 'Laboral', 'Penal', 'Civil', 'Otro', ''];
  diligenciaOrder: string[] = ['Copias para Citar', 'Desglose', 'Requerimiento', 'Retiro Oficios', 'Otro', ''];
  pisoOrder: string[] = ['Pb', '5to', '8vo', 'Otro', ''];

  @ViewChild('rowSelectionTable') rowSelectionTable!: NzTableComponent<Itinerario>;

  // Filtros
  selectedArea = new FormControl('');
  selectedDate = new FormControl<[Date | null, Date | null]>([null, null]);
  areas: string[] = ['ISSFA', 'Bco. Pichincha', 'Bco. Produbanco', 'BNF', 'Inmobiliaria', 'David', 'Otro'];

  selectedEstado = new FormControl(null);
  estados: string[] = ['Incompleto', 'Pendiente'];

  listOfCurrentPageData: Itinerario[] = [];
  checked = false;
  indeterminate = false;

  constructor(
    private itinerarioService: ItinerarioService,
    private usersService: UsersService,
    private message: NzMessageService,
  ) { }

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.setFechaHoraActual();
    this.itinerarioService.getItinerarios().subscribe(data => {
      this.itinerarios = data;
      this.filterItinerarios(); // Llamar a filterItinerarios después de obtener los datos
      this.itinerarios.forEach(item => {
        this.editCache[item.id] = { edit: false };

        // Verificar si la fecha de término es igual a la fecha actual
        if (this.esFechaTerminoHoy(item.fechaTermino, item.estado)) {
          this.agregarNotificacion(item);
        }
      });
      this.loading = false;
    });

    this.cargarDesdeLocalStorage();

    // Detectar cambios en los filtros
    this.selectedArea.valueChanges.subscribe(() => this.filterItinerarios());
    this.selectedDate.valueChanges.subscribe(() => this.filterItinerarios());
    this.selectedEstado.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
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
      const isDateInRange =
        (!fechaInicio || fechaSolicitud >= new Date(fechaInicio)) &&
        (!fechaFin || fechaSolicitud <= new Date(fechaFin));

      return isPendingOrIncomplete && isAreaMatch && isDateInRange && isEstadoMatch;
    });

    // Ordenar los datos después de filtrar
    this.filteredItinerarios = this.sortData(this.filteredItinerarios);
  }

  sortData(data: any[]): any[] {
    return data.sort((a, b) => {
      const unidadA = this.unidadOrder.indexOf(a.unidad);
      const unidadB = this.unidadOrder.indexOf(b.unidad);
      if (unidadA !== unidadB) {
        return unidadA - unidadB;
      }

      const materiaA = this.materiaOrder.indexOf(a.materia);
      const materiaB = this.materiaOrder.indexOf(b.materia);
      if (materiaA !== materiaB) {
        return materiaA - materiaB;
      }

      const diligenciaA = this.diligenciaOrder.indexOf(a.diligencia);
      const diligenciaB = this.diligenciaOrder.indexOf(b.diligencia);
      if (diligenciaA !== diligenciaB) {
        return diligenciaA - diligenciaB;
      }

      const pisoA = this.pisoOrder.indexOf(a.piso);
      const pisoB = this.pisoOrder.indexOf(b.piso);
      return pisoA - pisoB;
    });
  }

  agregarActividad() {
    if (this.actividad.trim() !== '') {
      this.actividades.push(this.actividad);
      this.actividad = ''; // Limpiar el input
      this.guardarEnLocalStorage(); // Guardar en localStorage
    }
  }

  getDataFromService(): any[] {
    // Simulación de datos obtenidos de un servicio
    return [
      { unidad: 'Iñaquito', materia: 'Familia', diligencia: 'Cop. Citar', piso: '5to' },
      { unidad: 'Quitumbe', materia: 'Archivo', diligencia: 'Desglose', piso: 'Pb' },
      { unidad: 'Quitumbe', materia: 'Archivo', diligencia: 'Desglose', piso: '8vo' },
      { unidad: 'Calderon', materia: 'Penal', diligencia: 'Requerimiento', piso: '5to' },
      // Más datos...
    ];
  }


  onFilterChange() {
    // Aplicar filtros y ordenar
    this.filteredItinerarios = this.sortData(this.filteredItinerarios);
  }

  eliminarActividad(index: number) {
    this.actividades.splice(index, 1);
    this.guardarEnLocalStorage(); // Guardar en localStorage
  }

  moverArriba(index: number) {
    if (index > 0) {
      [this.actividades[index], this.actividades[index - 1]] = [this.actividades[index - 1], this.actividades[index]];
      this.guardarEnLocalStorage(); // Guardar en localStorage
    }
  }

  moverAbajo(index: number) {
    if (index < this.actividades.length - 1) {
      [this.actividades[index], this.actividades[index + 1]] = [this.actividades[index + 1], this.actividades[index]];
      this.guardarEnLocalStorage(); // Guardar en localStorage
    }
  }

  editarActividad(index: number) {
    this.editIndex = index;
    this.editActividad = this.actividades[index];
  }

  guardarEdicion(index: number) {
    if (this.editActividad.trim() !== '') {
      this.actividades[index] = this.editActividad;
      this.editIndex = null;
      this.editActividad = '';
      this.guardarEnLocalStorage(); // Guardar en localStorage
    }
  }

  guardarEnLocalStorage() {
    const actividadesConTimestamp = {
      actividades: this.actividades,
      timestamp: new Date().getTime(), // Guardamos la fecha/hora actual
    };
    localStorage.setItem('actividades', JSON.stringify(actividadesConTimestamp));
  }

  cargarDesdeLocalStorage() {
    const actividadesGuardadas = localStorage.getItem('actividades');
    if (actividadesGuardadas) {
      const { actividades, timestamp } = JSON.parse(actividadesGuardadas);
      const ahora = new Date().getTime();
      const veinticuatroHoras = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

      // Verificar si han pasado menos de 24 horas
      if (ahora - timestamp < veinticuatroHoras) {
        this.actividades = actividades; // Cargar las actividades
      } else {
        localStorage.removeItem('actividades'); // Eliminar datos expirados
      }
    }
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

    // Guardar el valor original de nzPageSize
    const originalPageSize = this.rowSelectionTable.nzPageSize;

    // Mostrar todos los registros (desactivar paginación)
    this.rowSelectionTable.nzPageSize = 1000; // Un número muy grande

    // Esperar a que la tabla se actualice
    setTimeout(() => {
      const tabla = document.getElementById('tabla-itinerarios') as HTMLElement;

      // Capturar la tabla con html2canvas
      html2canvas(tabla).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');

        const imgWidth = 210; // Ancho de la página A4 en mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width; // Altura proporcional

        // Altura de la página A4 en mm
        const pageHeight = 297;

        // Si la imagen es más alta que una página, dividirla en varias páginas
        if (imgHeight > pageHeight) {
          let position = 0; // Posición inicial en el PDF

          while (position < imgHeight) {
            // Agregar una nueva página si no es la primera
            if (position > 0) {
              pdf.addPage();
            }

            // Calcular la altura de la porción de la imagen que cabe en la página
            const height = Math.min(pageHeight, imgHeight - position);

            // Agregar la porción de la imagen al PDF
            pdf.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight);

            // Mover la posición para la siguiente porción
            position += pageHeight;
          }
        } else {
          // Si la imagen cabe en una sola página, agregarla directamente
          pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        }

        // Descargar el PDF
        pdf.save('itinerarios.pdf');

        // Restaurar el valor original de nzPageSize
        this.rowSelectionTable.nzPageSize = originalPageSize;
      });
    }, 500); // Esperar 500ms para asegurar que la tabla se actualice
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
      && !!this.imageFileList?.length;
  }

  async onFileSelected(event: any): Promise<void> {
    const file = event.file?.originFileObj || null;
    this.imagenSeleccionada = file;

    this.validarFormulario();
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
