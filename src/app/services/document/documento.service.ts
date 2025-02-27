import { Injectable } from '@angular/core';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class DocumentoService {

  private docUrl = 'assets/procOrdinario.docx';

  constructor(private http: HttpClient) {}

  generarDocumento(datos: any) {
    this.http.get(this.docUrl, { responseType: 'arraybuffer' }).subscribe(
      (buffer: ArrayBuffer) => {
        try {
          const zip = new PizZip(buffer);
          const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

          doc.setData(datos);

          try {
            doc.render();
          } catch (error) {
            console.error('Error al renderizar la plantilla:', error);
            return;
          }

          const blob = doc.getZip().generate({ type: 'blob' });
          saveAs(blob, 'demanda.docx');
          console.log('Documento generado correctamente.');

        } catch (error) {
          console.error('Error al procesar la plantilla:', error);
        }
      },
      (error) => {
        console.error('Error al cargar la plantilla:', error);
      }
    );
  }
}
