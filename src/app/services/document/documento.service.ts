import { Injectable } from '@angular/core';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DocumentoService {

  private dmdProcOrd = 'assets/procOrdinario.docx';
  private matrizIssfa = 'assets/matriz.docx';

  // Plantillas de providencias IESS
  private providenciaIndividualNatural = 'assets/inicio-cancelacion-individual-natural.docx';
  private providenciaIndividualJuridica = 'assets/inicio-cancelacion-individual-juridica.docx';
  private providenciaAgrupadosNatural = 'assets/inicio-cancelacion-agrupados-natural.docx';
  private providenciaAgrupadosJuridica = 'assets/inicio-cancelacion-agrupados-juridica.docx';

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

  /**
   * Genera providencia de inicio y cancelación - Individual Persona Natural
   */
  generarProvidenciaIndividualNatural(datos: any) {
    this.generarProvidencia(this.providenciaIndividualNatural, datos, 'providencia-individual-natural.docx');
  }

  /**
   * Genera providencia de inicio y cancelación - Individual Persona Jurídica
   */
  generarProvidenciaIndividualJuridica(datos: any) {
    this.generarProvidencia(this.providenciaIndividualJuridica, datos, 'providencia-individual-juridica.docx');
  }

  /**
   * Genera providencia de inicio y cancelación - Agrupados Persona Natural
   */
  generarProvidenciaAgrupadosNatural(datos: any) {
    this.generarProvidencia(this.providenciaAgrupadosNatural, datos, 'providencia-agrupados-natural.docx');
  }

  /**
   * Genera providencia de inicio y cancelación - Agrupados Persona Jurídica
   */
  generarProvidenciaAgrupadosJuridica(datos: any) {
    this.generarProvidencia(this.providenciaAgrupadosJuridica, datos, 'providencia-agrupados-juridica.docx');
  }

  /**
   * Método privado genérico para generar providencias
   */
  private generarProvidencia(templatePath: string, datos: any, nombreArchivo: string) {
    this.http.get(templatePath, { responseType: 'arraybuffer' }).subscribe({
      next: (buffer: ArrayBuffer) => {
        try {
          const zip = new PizZip(buffer);
          const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

          doc.setData(datos);

          try {
            doc.render();
          } catch (error) {
            console.error('Error al renderizar la plantilla:', error);
            console.error('Datos enviados:', datos);
            return;
          }

          const blob = doc.getZip().generate({ type: 'blob' });
          saveAs(blob, nombreArchivo);
          console.log('Providencia generada correctamente:', nombreArchivo);

        } catch (error) {
          console.error('Error al procesar la plantilla:', error);
        }
      },
      error: (error) => {
        console.error('Error al cargar la plantilla:', error);
      }
    });
  }

  /**
   * Genera múltiples providencias en un solo documento
   */
  async generarProvidenciasMultiples(providencias: any[], fechaProvidencia: Date) {
    if (providencias.length === 0) {
      console.error('No hay providencias para generar');
      return;
    }

    try {
      const documentos: ArrayBuffer[] = [];

      // Generar cada documento individualmente en memoria
      for (let i = 0; i < providencias.length; i++) {
        const providencia = providencias[i];
        console.log(`Generando providencia ${i + 1} de ${providencias.length}...`);

        const buffer = await this.generarDocumentoEnMemoria(providencia);
        documentos.push(buffer);
      }

      // Combinar manualmente usando PizZip
      await this.combinarDocumentos(documentos);

      console.log('Documento combinado generado correctamente');
    } catch (error) {
      console.error('Error al generar providencias múltiples:', error);
      throw error;
    }
  }

  /**
   * Genera un documento en memoria sin descargarlo
   */
  private async generarDocumentoEnMemoria(providencia: any): Promise<ArrayBuffer> {
    let templatePath = '';

    // Determinar qué plantilla usar
    if (providencia.tipo === 'individual') {
      templatePath = providencia.personaTipo === 'natural'
        ? this.providenciaIndividualNatural
        : this.providenciaIndividualJuridica;
    } else {
      templatePath = providencia.personaTipo === 'natural'
        ? this.providenciaAgrupadosNatural
        : this.providenciaAgrupadosJuridica;
    }

    try {
      // Cargar la plantilla
      const buffer = await firstValueFrom(
        this.http.get(templatePath, { responseType: 'arraybuffer' })
      );

      const zip = new PizZip(buffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      // Rellenar con datos
      doc.setData(providencia.datos);
      doc.render();

      // Retornar como ArrayBuffer
      return doc.getZip().generate({
        type: 'arraybuffer',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }) as ArrayBuffer;
    } catch (error) {
      console.error('Error al generar documento en memoria:', error);
      throw error;
    }
  }

  /**
   * Combina múltiples documentos ArrayBuffer en uno solo
   */
  private async combinarDocumentos(documentos: ArrayBuffer[]): Promise<void> {
    if (documentos.length === 0) return;

    try {
      // Tomar el primer documento como base
      const zipBase = new PizZip(documentos[0]);
      let documentXml = zipBase.files['word/document.xml'].asText();

      // Remover el cierre del body
      documentXml = documentXml.replace('</w:body></w:document>', '');

      // Agregar los demás documentos
      for (let i = 1; i < documentos.length; i++) {
        const zip = new PizZip(documentos[i]);
        let tempDocXml = zip.files['word/document.xml'].asText();

        // Extraer solo el contenido del body
        const bodyMatch = tempDocXml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/);
        if (bodyMatch && bodyMatch[1]) {
          // Agregar salto de página antes del siguiente documento
          documentXml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
          // Agregar contenido
          documentXml += bodyMatch[1];
        }
      }

      // Cerrar el documento
      documentXml += '</w:body></w:document>';

      // Actualizar el XML en el ZIP base
      zipBase.file('word/document.xml', documentXml);

      // Generar y descargar
      const blob = zipBase.generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      const nombreArchivo = `providencias-${new Date().getTime()}.docx`;
      saveAs(blob, nombreArchivo);

      console.log(`Documento combinado generado: ${nombreArchivo}`);
    } catch (error) {
      console.error('Error al combinar documentos:', error);
      throw error;
    }
  }

}