import { Component, OnInit } from '@angular/core';
import { ItinerarioService, Itinerario } from '../../services/itinerario/itinerario.service';// Asegúrate de que la ruta sea correcta
import { CommonModule } from '@angular/common';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { FormsModule } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import {NzPopconfirmModule} from 'ng-zorro-antd/popconfirm';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { RouterModule } from '@angular/router';



@Component({
  selector: 'app-history-itinerario',
  standalone: true,
  imports: [
    CommonModule,
    NzTagModule,
    NzTableModule,
    FormsModule,
    NzPopconfirmModule,
    NzButtonModule,
    NzIconModule,
    RouterModule
  ],
  templateUrl: './history-itinerario.component.html',
  styleUrl: './history-itinerario.component.css'
})
export class HistoryItinerarioComponent implements OnInit {

  itinerarios: Itinerario[] = [];
  editCache: { [key: string]: { edit: boolean; data: any } } = {};

  constructor(
    private itinerarioService: ItinerarioService,
    private message: NzMessageService
  ) { }

  ngOnInit(): void {
    this.itinerarioService.getItinerarios().subscribe((data) => {
      this.itinerarios = data;
      this.updateEditCache(this.itinerarios);
    });
    this.initEditCache();
  }

  private initEditCache(): void {
    this.itinerarios.forEach(item => {
      if (!this.editCache[item.id]) {
        this.editCache[item.id] = { edit: false, data: { ...item } };
      }
    });
  }
  trackById(index: number, item: any): string | number {
    return item.id ?? index;  // Evita que Angular reciba `undefined`
  }
  startEdit(id: string): void {
    if (this.editCache[id]) {
      this.editCache[id].edit = true;
    }
  }
  cancelEdit(id: string): void {
    const index = this.itinerarios.findIndex(item => item.id === id);
    if (index !== -1) {
      this.editCache[id] = {
        data: { ...this.itinerarios[index] },
        edit: false
      };
    }
  }
  async saveEdit(id: string): Promise<void> {
    if (!this.editCache[id]) return;

    const updatedItinerario = this.editCache[id].data;
    const index = this.itinerarios.findIndex(item => item.id === id);

    if (index === -1) return;

    // Evitar actualizaciones innecesarias
    if (JSON.stringify(this.itinerarios[index]) === JSON.stringify(updatedItinerario)) {
      console.log('No hay cambios en el itinerario.');
      this.editCache[id].edit = false;
      return;
    }

    try {
      await this.itinerarioService.updateItinerario(id, updatedItinerario);
      console.log('Itinerario actualizado');

      // Actualizar la lista original
      this.itinerarios[index] = { ...updatedItinerario };
      this.editCache[id].edit = false;
    } catch (error) {
      console.error('Error al actualizar el itinerario', error);
    }
  }
  updateEditCache(itinerarios: Itinerario[]): void {
    itinerarios.forEach(item => {
      if (item.id) {
        this.editCache[item.id] = {
          edit: false,
          data: { ...item }
        };
      }
    });
  }

  eliminar(id: string): void {
    this.itinerarioService.deleteItinerario(id).then(() => {
      this.itinerarios = this.itinerarios.filter(it => it.id !== id);
      this.message.success('Itinerario eliminado correctamente.');
    }).catch(error => {
      this.message.error('Error al eliminar el itinerario.');
      console.error(error);
    });
  }
}
