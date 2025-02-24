import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
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

enum Estado {
  COMPLETADO = 'completado',
  INCOMPLETO = 'incompleto',
  PENDIENTE = 'pendiente'
}


@Component({
  selector: 'app-itinerario',
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
    NzFormModule
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
  isConfirmLoading = false;

  isHistorialVisible = false; // Controla la visibilidad del modal
  historialActual: any[] = []; // Almacena el historial actual

  // Filtros
  selectedArea = new FormControl('');
  selectedDate = new FormControl<[Date | null, Date | null]>([null, null]);
  areas: string[] = ['ISSFA', 'Bco. Pichincha', 'Bco. Produbanco', 'BNF', 'Inmobiliaria', 'David', 'Otro'];

  listOfCurrentPageData: Itinerario[] = [];
  checked = false;
  indeterminate = false;

  constructor(
    private itinerarioService: ItinerarioService,
    private usersService: UsersService,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef,
  ) { }
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
    const [fechaInicio, fechaFin] = this.selectedDate.value || [null, null];

    this.filteredItinerarios = this.itinerarios.filter(item => {
      // Usar el enum Estado para filtrar los estados correctamente
      const estado = item.estado; // Esto ya es el valor del enum
      const isPendingOrIncomplete = estado === Estado.PENDIENTE || estado === Estado.INCOMPLETO;
      const isAreaMatch = selectedAreaValue ? item.area === selectedAreaValue : true;
      const fechaSolicitud = new Date(item.fechaSolicitud);
      const isDateInRange =
        (!fechaInicio || fechaSolicitud >= new Date(fechaInicio)) &&
        (!fechaFin || fechaSolicitud <= new Date(fechaFin));

      return isPendingOrIncomplete && isAreaMatch && isDateInRange;
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
    this.filterItinerarios();
  }
  showModal(): void {
    this.isVisible = true;
  }
  handleOk(): void {
    this.isConfirmLoading = true;
    setTimeout(() => {
      this.isVisible = false;
      this.isConfirmLoading = false;
    }, 1000);
  }
  // Método para manejar el botón "Cancelar"
  handleCancel(): void {
    this.isVisible = false;
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
  // 📌 Valida el formulario antes de guardar
  validarFormulario(): void {
    // Si el estado es "INCOMPLETO", no es obligatorio tener una observación
    if (this.selectedItem.estado === Estado.INCOMPLETO) {
      this.formularioValido = true;
    } else {
      // Para "COMPLETADO", la observación es obligatoria
      this.formularioValido = !!this.selectedItem?.obsCompletado?.trim()
        && !!this.selectedItem?.fechaCompletado
        && !!this.selectedItem?.horaCompletado;
    }
  }

  setEstado(item: Itinerario, estado: Estado): void {
    this.selectedItem = { ...item, estado };

    if (estado === Estado.COMPLETADO || estado === Estado.INCOMPLETO) {
      this.setFechaHoraActual(); // Asigna fecha y hora automáticamente
      if (estado === Estado.INCOMPLETO) {
        //Limpiar fecha y hora
        this.selectedItem.fechaCompletado = '';
        this.selectedItem.horaCompletado = '';
        this.selectedItem.obsCompletado = ''; // Limpia el campo de observación
        this.setFechaHoraActual();
      }
      this.showModal(); // 🔥 Abre el modal en lugar de mostrar el formulario
      this.cdr.detectChanges();
    } else {
      this.guardarEstado(); // Guarda automáticamente si es "En Proceso"
    }
  }
  // 📌 Guarda los datos del itinerario en el backend
  async guardarEstado(): Promise<void> {
    if (!this.selectedItem) return;

    this.validarFormulario();
    if (!this.formularioValido) return;

    const user = this.usersService.getCurrentUser();
    if (!user) {
      console.error("No hay un usuario autenticado.");
      return;
    }

    try {
      // 📌 Obtener el itinerario actual desde Firestore
      const itinerarioActual = await this.itinerarioService.getItinerarioById(this.selectedItem.id);
      let historialActual = itinerarioActual?.historial || [];

      if (this.selectedItem.estado === Estado.INCOMPLETO) {
        const ahora = new Date();
        const fecha = ahora.toISOString().split('T')[0];
        const hora = ahora.toTimeString().slice(0, 5);

        const nuevaEntrada = {
          observacion: this.selectedItem.obsCompletado || '',
          fecha,
          hora,
          uid: user.uid,
          email: user.email || '',
          nombre: user.displayName || '',
        };

        // 📌 Verifica si la última entrada en el historial es del mismo usuario y fecha
        const ultimaEntrada = historialActual.length > 0 ? historialActual[historialActual.length - 1] : null;

        if (
          ultimaEntrada &&
          ultimaEntrada.uid === user.uid &&
          ultimaEntrada.fecha === fecha &&
          ultimaEntrada.hora === hora
        ) {
          // ✅ Si ya existe, solo actualiza la observación
          ultimaEntrada.observacion = nuevaEntrada.observacion;
        } else {
          // ✅ Si no existe, agrega una nueva entrada
          historialActual.push(nuevaEntrada);
        }

        this.selectedItem.historial = historialActual;
      }

      let imgURL = this.selectedItem.imgcompletado;

      // 📌 Subir imagen si hay una nueva seleccionada
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

      // 📌 Crear el objeto con los datos actualizados
      const datosActualizados = {
        ...this.selectedItem,
        fechaCompletado: this.selectedItem.fechaCompletado || new Date().toISOString().split('T')[0],
        horaCompletado: this.selectedItem.horaCompletado || new Date().toTimeString().slice(0, 5),
        imgcompletado: imgURL,
        historial: historialActual, // ✅ Guardar el historial actualizado
      };

      // 📌 Guardar en Firestore
      await this.itinerarioService.updateItinerario(this.selectedItem.id, datosActualizados);

      this.message.success('Itinerario actualizado correctamente');
      this.mostrarFormulario = false;
      this.limpiarCampos();

    } catch (error) {
      console.error('Error al obtener o actualizar el itinerario:', error);
      this.message.error('Error al guardar el itinerario');
    }
  }
  // 📌 Manejo de archivos seleccionados en el formulario
  async onFileSelected(event: any): Promise<void> {
    const file = event.file?.originFileObj || null;
    this.imagenSeleccionada = file;

    this.validarFormulario();
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
