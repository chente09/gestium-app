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

  // ✅ Mapeo estructurado de plantillas (fácil de mantener y escalar)
  private templates = {
    procOrdinario: 'assets/procOrdinario.docx',
    matrizIssfa: 'assets/matriz.docx',
    providencia: {
      individual: {
        natural: 'assets/iess/inicio-cancelacion/inicio-cancelacion-individual-natural.docx',
        juridica: 'assets/iess/inicio-cancelacion/inicio-cancelacion-individual-juridica.docx'
      },
      agrupados: {
        natural: 'assets/iess/inicio-cancelacion/inicio-cancelacion-agrupados-natural.docx',
        juridica: 'assets/iess/inicio-cancelacion/inicio-cancelacion-agrupados-juridica.docx'
      }
    },
    rpv: {
      natural: 'assets/iess/rpv/rpvNaturales.docx',
      juridica: 'assets/iess/rpv/rpvJuridicos.docx'
    },
    opi: {
      individual: {
        natural: 'assets/iess/opi/opi-indiv-natural.docx',
        juridica: 'assets/iess/opi/opi-indiv-juridica.docx'
      },
      agrupados: {
        natural: 'assets/iess/opi/opi-agrup-natural.docx',
        juridica: 'assets/iess/opi/opi-agrup-juridica.docx'
      }
    }
  };

  constructor(private http: HttpClient) { }

  // ========================================
  // MÉTODOS PÚBLICOS - DOCUMENTOS SIMPLES
  // ========================================

  generarDmdProcOrd(datos: any) {
    this.generarDocumentoSimple(this.templates.procOrdinario, datos, 'demanda.docx');
  }

  generarMatrizIssfa(datos: any) {
    this.generarDocumentoSimple(this.templates.matrizIssfa, datos, 'matrizIssfa.docx');
  }

  // --- PROVIDENCIAS INDIVIDUALES ---

  generarProvidenciaIndividualNatural(datos: any) {
    this.generarDocumentoSimple(
      this.templates.providencia.individual.natural,
      datos,
      'providencia-individual-natural.docx'
    );
  }

  generarProvidenciaIndividualJuridica(datos: any) {
    this.generarDocumentoSimple(
      this.templates.providencia.individual.juridica,
      datos,
      'providencia-individual-juridica.docx'
    );
  }

  generarProvidenciaAgrupadosNatural(datos: any) {
    this.generarDocumentoSimple(
      this.templates.providencia.agrupados.natural,
      datos,
      'providencia-agrupados-natural.docx'
    );
  }

  generarProvidenciaAgrupadosJuridica(datos: any) {
    this.generarDocumentoSimple(
      this.templates.providencia.agrupados.juridica,
      datos,
      'providencia-agrupados-juridica.docx'
    );
  }

  // --- RPV INDIVIDUALES ---

  generarRpvNatural(datos: any) {
    this.generarDocumentoSimple(
      this.templates.rpv.natural,
      datos,
      'RPV-Persona-Natural.docx'
    );
  }

  generarRpvJuridica(datos: any) {
    this.generarDocumentoSimple(
      this.templates.rpv.juridica,
      datos,
      'RPV-Persona-Juridica.docx'
    );
  }

  // --- OPI INDIVIDUALES ---

  generarOpiIndividualNatural(datos: any) {
    this.generarDocumentoSimple(
      this.templates.opi.individual.natural,
      datos,
      'OPI-Individual-Persona-Natural.docx'
    );
  }

  generarOpiIndividualJuridica(datos: any) {
    this.generarDocumentoSimple(
      this.templates.opi.individual.juridica,
      datos,
      'OPI-Individual-Persona-Juridica.docx'
    );
  }

  generarOpiAgrupadosNatural(datos: any) {
    this.generarDocumentoSimple(
      this.templates.opi.agrupados.natural,
      datos,
      'OPI-Agrupados-Persona-Natural.docx'
    );
  }

  generarOpiAgrupadosJuridica(datos: any) {
    this.generarDocumentoSimple(
      this.templates.opi.agrupados.juridica,
      datos,
      'OPI-Agrupados-Persona-Juridica.docx'
    );
  }

  // ========================================
  // MÉTODOS PÚBLICOS - DOCUMENTOS MÚLTIPLES (WRAPPERS)
  // ========================================

  /**
   * Genera múltiples providencias de inicio y cancelación en un solo documento
   */
  async generarProvidenciasMultiples(providencias: any[], fechaProvidencia: Date) {
    return this.generarDocumentosMultiples(providencias, 'INICIO_CANCELACION', fechaProvidencia);
  }

  /**
   * Genera múltiples RPV en un solo documento
   */
  async generarRpvMultiples(rpvs: any[], fechaRpv: Date) {
    return this.generarDocumentosMultiples(rpvs, 'RPV', fechaRpv);
  }

  /**
   * Genera múltiples OPI en un solo documento
   */
  async generarOpiMultiples(opis: any[], fechaOpi: Date) {
    return this.generarDocumentosMultiples(opis, 'OPI', fechaOpi);
  }

  /**
   * ✅ Método universal para generar múltiples documentos combinados
   * CORREGIDO: Detecta automáticamente si es individual o agrupado para OPI
   */
  private async generarDocumentosMultiples(
    items: any[],
    categoria: 'INICIO_CANCELACION' | 'RPV' | 'OPI',
    fecha: Date
  ) {
    if (items.length === 0) {
      console.error('No hay documentos para generar');
      return;
    }

    try {
      const documentos: ArrayBuffer[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // --- CORRECCIÓN #30 ---
        // Usar tipoDocumento si existe, sino usar tipo
        let tipoParaTemplate = item.tipoDocumento || item.tipo;

        // ✅ NUEVO: Fallback para detectar agrupados por presencia de array titulos
        // Aplica tanto para OPI como para INICIO_CANCELACION
        if (!item.tipoDocumento && !item.tipo) {
          // Si no hay tipo explícito, detectar por estructura de datos
          if (item.datos.titulos && Array.isArray(item.datos.titulos) && item.datos.titulos.length > 0) {
            tipoParaTemplate = 'agrupados';
          } else {
            tipoParaTemplate = 'individual';
          }
        }

        // ✅ AGREGADO: Validación adicional para INICIO_CANCELACION
        // Si dice "agrupados" pero no tiene array de titulos, es un error
        if (categoria === 'INICIO_CANCELACION' && tipoParaTemplate === 'agrupados') {
          if (!item.datos.titulos || !Array.isArray(item.datos.titulos) || item.datos.titulos.length === 0) {
            console.error('⚠️ Error: Documento marcado como "agrupados" pero no tiene array de títulos');
            tipoParaTemplate = 'individual'; // Fallback seguro
          }
        }

        const templatePath = this.obtenerRutaPlantilla(categoria, tipoParaTemplate, item.personaTipo);

        const buffer = await this.generarBufferEnMemoria(templatePath, item.datos);
        documentos.push(buffer);
      }

      const primerItem = items[0];
      const nombreBase = this.construirNombreArchivo(categoria, primerItem, fecha);

      await this.combinarDocumentos(documentos, nombreBase);

    } catch (error) {
      console.error(`Error al generar múltiples ${categoria}:`, error);
      throw error;
    }
  }

  // ========================================
  // HELPERS PRIVADOS - REUTILIZABLES
  // ========================================

  /**
   * Obtiene la ruta de la plantilla según categoría, tipo y persona
   */
  private obtenerRutaPlantilla(
    categoria: string,
    tipo: 'individual' | 'agrupados',
    personaTipo: 'natural' | 'juridica'
  ): string {
    if (categoria === 'INICIO_CANCELACION') {
      return this.templates.providencia[tipo][personaTipo];
    }
    if (categoria === 'OPI') {
      return this.templates.opi[tipo][personaTipo];
    }
    if (categoria === 'RPV') {
      return this.templates.rpv[personaTipo];
    }
    throw new Error(`Categoría desconocida: ${categoria}`);
  }

  /**
   * Construye el nombre del archivo según la categoría
   */
  private construirNombreArchivo(
    categoria: string,
    primerItem: any,
    fecha: Date
  ): string {
    const personaStr = primerItem.personaTipo === 'natural' ? 'PERSONA_NATURAL' : 'PERSONA_JURIDICA';
    const fechaStr = this.formatearFechaParaNombre(fecha);

    // RPV no tiene tipo individual/agrupados
    if (categoria === 'RPV') {
      return `RPV_${personaStr}_${fechaStr}`;
    }

    // Para INICIO_CANCELACION y OPI - usar tipoDocumento si existe, sino tipo
    const tipoParaNombre = primerItem.tipoDocumento || primerItem.tipo;
    const tipoStr = tipoParaNombre === 'individual' ? 'INDIVIDUAL' : 'AGRUPADOS';
    return `${categoria}_${tipoStr}_${personaStr}_${fechaStr}`;
  }

  /**
   * Genera un documento simple (descarga inmediata)
   */
  private generarDocumentoSimple(templatePath: string, datos: any, nombreSalida: string) {
    this.http.get(templatePath, { responseType: 'arraybuffer' }).subscribe({
      next: (buffer: ArrayBuffer) => {
        try {
          const blob = this.procesarPlantilla(buffer, datos);
          if (blob) {
            saveAs(blob, nombreSalida);
          }
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
   * Genera un buffer en memoria sin descargarlo
   */
  private async generarBufferEnMemoria(templatePath: string, datos: any): Promise<ArrayBuffer> {
    try {
      const buffer = await firstValueFrom(
        this.http.get(templatePath, { responseType: 'arraybuffer' })
      );

      const zip = new PizZip(buffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: (part: any) => {
          console.warn('⚠️ Variable no encontrada:', part.value);
          return '';
        }
      });

      doc.setData(datos);

      try {
        doc.render();
      } catch (renderError: any) {
        console.error('❌ ERROR AL RENDERIZAR:');
        console.error('Mensaje:', renderError.message);

        if (renderError.properties) {
          console.error('📍 Propiedades del error:', renderError.properties);

          // Mostrar errores individuales si existen
          if (renderError.properties.errors) {
            console.error('📋 Lista de errores:');
            renderError.properties.errors.forEach((err: any, index: number) => {
              console.error(`  ${index + 1}. ${err.message}`);
              if (err.properties) {
                console.error('     Variable:', err.properties.id);
                console.error('     Explicación:', err.properties.explanation);
              }
            });
          }
        }

        throw renderError;
      }

      return doc.getZip().generate({
        type: 'arraybuffer',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }) as ArrayBuffer;
    } catch (error: any) {
      console.error('❌ Error crítico:', error);
      throw error;
    }
  }

  /**
   * Procesa una plantilla y retorna un Blob listo para guardar
   */
  private procesarPlantilla(buffer: ArrayBuffer, datos: any): Blob | null {
    try {
      const zip = new PizZip(buffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      doc.setData(datos);
      doc.render();

      return doc.getZip().generate({ type: 'blob' });
    } catch (error) {
      console.error('Error al renderizar la plantilla:', error);
      console.error('Datos enviados:', datos);
      return null;
    }
  }

  /**
   * Combina múltiples documentos ArrayBuffer en uno solo
   */
  private async combinarDocumentos(documentos: ArrayBuffer[], nombreBase: string): Promise<void> {
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

      // Generar y descargar con nombre dinámico
      const blob = zipBase.generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      const nombreArchivo = `${nombreBase}.docx`;
      saveAs(blob, nombreArchivo);
    } catch (error) {
      console.error('Error al combinar documentos:', error);
      throw error;
    }
  }

  /**
   * Formatea fecha para el nombre del archivo
   */
  private formatearFechaParaNombre(fecha: Date): string {
    const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = meses[fecha.getMonth()];
    const anio = fecha.getFullYear();
    return `${dia}${mes}${anio}`;
  }

}