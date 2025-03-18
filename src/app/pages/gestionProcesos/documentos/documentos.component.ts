import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { Observable, finalize, from } from 'rxjs';

import { Documento, Proceso, ProcesosService } from '../../../services/procesos/procesos.service';

@Component({
  selector: 'app-documentos',
  standalone: true,
  imports: [
    CommonModule,
    NzUploadModule,
    NzListModule,
    NzSpinModule,
    NzButtonModule,
    NzIconModule,
    NzEmptyModule,
    NzCardModule,
    NzToolTipModule
  ],
  templateUrl: './documentos.component.html',
  styleUrls: ['./documentos.component.css']
})
export class DocumentosComponent implements OnInit, OnChanges {
  @Input() proceso!: Proceso;
  @Input() indiceEtapa!: number;
  
  documentos: Documento[] = [];
  fileList: NzUploadFile[] = [];
  cargandoArchivo = false;
  isLoading = true;
  errorMessage: string | null = null;
  tiposPermitidos = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.txt';
  tamanoMaximo = 10; // en MB

  constructor(
    private procesosService: ProcesosService,
    private messageService: NzMessageService,
    private modalService: NzModalService
  ) {}

  ngOnInit(): void {
    this.cargarDocumentos();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['proceso'] || changes['indiceEtapa']) && this.proceso && this.indiceEtapa !== undefined) {
      this.cargarDocumentos();
    }
  }

  cargarDocumentos(): void {
    if (!this.proceso?.id || this.indiceEtapa === undefined) {
      this.errorMessage = 'No se puede cargar documentos: Datos incompletos';
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    from(this.procesosService.obtenerDocumentos(this.proceso.id, this.indiceEtapa))
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (docs) => {
          this.documentos = docs;
          this.fileList = docs.map(doc => ({ 
            uid: doc.nombre, 
            name: doc.nombre, 
            url: doc.url,
            status: 'done'
          } as NzUploadFile));
        },
        error: (err) => {
          this.errorMessage = 'Error al cargar los documentos';
          console.error('Error cargando documentos:', err);
          this.messageService.error('No se pudieron cargar los documentos');
        }
      });
  }

  beforeUpload = (file: NzUploadFile): boolean => {
    // Validar tipo de archivo
    const isValidType = this.validarTipoArchivo(file.name || '');
    if (!isValidType) {
      this.messageService.error(`Solo se permiten los siguientes tipos de archivo: ${this.tiposPermitidos}`);
      return false;
    }

    // Validar tamaño (convertir de bytes a MB)
    const isValidSize = (file.size || 0) / 1024 / 1024 < this.tamanoMaximo;
    if (!isValidSize) {
      this.messageService.error(`El archivo debe ser menor a ${this.tamanoMaximo}MB`);
      return false;
    }

    const fileObj = file as unknown as File;
    this.handleUpload(fileObj);
    return false; // Detener la subida automática
  };

  validarTipoArchivo(filename: string): boolean {
    const extension = '.' + filename.split('.').pop()?.toLowerCase();
    return this.tiposPermitidos.includes(extension);
  }

  async handleUpload(file: File): Promise<void> {
    if (!this.proceso?.id || this.indiceEtapa === undefined) {
      this.messageService.error('No se puede subir el documento: Datos incompletos');
      return;
    }

    this.cargandoArchivo = true;
    const loadingId = this.messageService.loading(`Subiendo ${file.name}...`).messageId;

    try {
      const url = await this.procesosService.subirDocumento(this.proceso.id, this.indiceEtapa, file);
      
      const nuevoDoc = { nombre: file.name, url };
      this.documentos.push(nuevoDoc);
      this.fileList = [...this.fileList, { 
        uid: file.name, 
        name: file.name, 
        url,
        status: 'done'
      } as NzUploadFile];
      
      this.messageService.remove(loadingId);
      this.messageService.success(`${file.name} subido con éxito`);
    } catch (error) {
      this.messageService.remove(loadingId);
      this.messageService.error(`Error al subir ${file.name}`);
      console.error('Error al subir archivo:', error);
    } finally {
      this.cargandoArchivo = false;
    }
  }

  descargarDocumento(documento: Documento): void {
    window.open(documento.url, '_blank');
  }

  eliminarDocumento(documento: Documento): void {
    if (!this.proceso?.id || this.indiceEtapa === undefined) {
      this.messageService.error('No se puede eliminar el documento: Datos incompletos');
      return;
    }

    this.modalService.confirm({
      nzTitle: '¿Estás seguro de eliminar este documento?',
      nzContent: `Vas a eliminar el documento "${documento.nombre}". Esta acción no se puede deshacer.`,
      nzOkText: 'Eliminar',
      nzOkDanger: true,
      nzCancelText: 'Cancelar',
      nzOnOk: () => {
        const loadingId = this.messageService.loading('Eliminando documento...').messageId;
        
        return new Promise<void>((resolve, reject) => {
          this.procesosService.eliminarDocumento(this.proceso.id!, this.indiceEtapa, documento)
            .then(() => {
              this.messageService.remove(loadingId);
              this.messageService.success('Documento eliminado correctamente');
              
              this.documentos = this.documentos.filter(doc => doc.nombre !== documento.nombre);
              this.fileList = this.fileList.filter(file => file.name !== documento.nombre);
              
              resolve();
            })
            .catch((error) => {
              this.messageService.remove(loadingId);
              this.messageService.error('No se pudo eliminar el documento');
              console.error('Error al eliminar el documento:', error);
              reject(error);
            });
        });
      }
    });
  }
}