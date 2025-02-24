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
    NzBreadCrumbModule
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

  isVisible = false; // Controla la visibilidad del modal
  isEnProcesoVisible = false;
  isConfirmLoading = false;

  isHistorialVisible = false; // Controla la visibilidad del modal
  historialActual: any[] = []; // Almacena el historial actual

  @ViewChild('rowSelectionTable') rowSelectionTable!: NzTableComponent<Itinerario>;

  // Filtros
  selectedArea = new FormControl('');
  selectedDate = new FormControl<[Date | null, Date | null]>([null, null]);
  areas: string[] = ['ISSFA', 'Bco. Pichincha', 'Bco. Produbanco', 'BNF', 'Inmobiliaria', 'David', 'Otro'];

  selectedEstado = new FormControl(null);
  estados: string[] = [ 'Incompleto', 'Pendiente'];

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
      this.filterItinerarios();
      this.itinerarios.forEach(item => {
        this.editCache[item.id] = { edit: false };
      });
      this.loading = false;
    });
    // Detectar cambios en los filtros
    this.selectedArea.valueChanges.subscribe(() => this.filterItinerarios());
    this.selectedDate.valueChanges.subscribe(() => this.filterItinerarios());
    this.selectedEstado.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.filterItinerarios());
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

  filterItinerarios(): void {
    const selectedAreaValue = this.selectedArea.value;
    const selectedEstadoValue = this.selectedEstado.value;
    const [fechaInicio, fechaFin] = this.selectedDate.value || [null, null];

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
