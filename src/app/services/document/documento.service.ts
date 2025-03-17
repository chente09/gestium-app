import { Injectable } from '@angular/core';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class DocumentoService {

  private dmdProcOrd = 'assets/procOrdinario.docx';
  private matrizIssfa = 'assets/matriz.docx';

  constructor(private http: HttpClient) { }

  generarDmdProcOrd(datos: any) {
    this.http.get(this.dmdProcOrd, { responseType: 'arraybuffer' }).subscribe({
      next: (buffer: ArrayBuffer) => {
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
      error: (error) => {
        console.error('Error al cargar la plantilla:', error);
      }
    });
  }

  generarMatrizIssfa(datos: any) {
    this.http.get(this.matrizIssfa, { responseType: 'arraybuffer' }).subscribe({
      next: (buffer: ArrayBuffer) => {
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
          saveAs(blob, 'matrizIssfa.docx');
          console.log('Documento generado correctamente.');

        } catch (error) {
          console.error('Error al procesar la plantilla:', error);
        }
      },
      error: (error) => {
        console.error('Error al cargar la plantilla:', error);
      }
    });
  }

}
