import { Injectable } from '@angular/core';
import { Firestore, addDoc, collection, doc, docData } from '@angular/fire/firestore';
import { filter, firstValueFrom, map, timeout } from 'rxjs';
import { GestionesCoactivadoService } from '../gestionesCoactivado/gestiones-coactivado.service';
import { GeneroFirma, armarAvisoPreCoactivo, formatoCapitalAviso } from './aviso-precoactivo.template';
import { MAX_DESTINATARIOS, PREFIJO_GESTION_AVISO, esCorreoValido, sumarCapital } from './correos-iess.util';

// Cola de la segunda instancia de la extensión "Trigger Email": envía desde
// la cuenta de notificaciones del IESS (la colección `mail` es la de la
// cuenta general de Gestium y no se toca).
export const COLECCION_MAIL_IESS = 'mail_iess';

// Qué tanto esperar a que la extensión confirme la entrega: el arranque en
// frío de la función puede tardar bastante la primera vez.
const ESPERA_ENTREGA_MS = 60000;

export interface EnvioAviso {
  coactivado: { cedula: string; nombre: string; cartera: string };
  // Quien firma: por defecto la cartera del coactivado, con el género que
  // tiene configurado en SharedDataService.
  abogado: { nombre: string; genero: GeneroFirma };
  // Solo empresas: a quién va dirigido el "Estimado:" (ver DatosAviso).
  representanteLegal?: string;
  destinatarios: string[];
  titulos: { numero: string; capital: number }[]; // solo los que se incluyen
}

export interface ResultadoEnvio {
  // enviado: Gmail aceptó el correo. en_cola: la extensión no confirmó a
  // tiempo (puede llegar igual). error: la extensión no pudo enviarlo.
  estado: 'enviado' | 'error' | 'en_cola';
  mailId: string;
  detalle?: string;
  aceptados: string[];
  rechazados: string[];
  gestionId?: string;
  // El correo salió pero la gestión no se pudo registrar: hay que anotarla a mano.
  errorGestion?: string;
}

interface EntregaCorreo {
  state: 'SUCCESS' | 'ERROR';
  error?: string;
  info?: { accepted?: string[]; rejected?: string[] };
}

@Injectable({
  providedIn: 'root'
})
export class CorreosIessService {
  constructor(
    private firestore: Firestore,
    private gestionesService: GestionesCoactivadoService
  ) { }

  // Encola el aviso, espera la confirmación de la extensión y, solo si el
  // correo salió, registra la gestión "Correo" del coactivado. Así una
  // gestión en la bitácora siempre significa un correo realmente enviado.
  async enviarAviso(envio: EnvioAviso): Promise<ResultadoEnvio> {
    const destinatarios = envio.destinatarios;
    if (destinatarios.length === 0) throw new Error('Falta al menos un destinatario.');
    if (destinatarios.length > MAX_DESTINATARIOS) throw new Error(`Máximo ${MAX_DESTINATARIOS} destinatarios por aviso.`);
    const invalido = destinatarios.find(c => !esCorreoValido(c));
    if (invalido) throw new Error(`"${invalido}" no es un correo válido.`);
    if (envio.titulos.length === 0) throw new Error('Incluye al menos un título de crédito.');

    const capital = sumarCapital(envio.titulos);
    const numeros = envio.titulos.map(t => t.numero);
    const aviso = armarAvisoPreCoactivo({
      nombre: envio.coactivado.nombre,
      ruc: envio.coactivado.cedula,
      capital,
      titulos: numeros,
      abogado: envio.abogado.nombre,
      generoAbogado: envio.abogado.genero,
      representanteLegal: envio.representanteLegal
    });

    const ref = await addDoc(collection(this.firestore, COLECCION_MAIL_IESS), {
      to: destinatarios,
      message: { subject: aviso.asunto, html: aviso.html, text: aviso.texto }
    });

    const entrega = await this.esperarEntrega(ref.id);

    if (!entrega) {
      return { estado: 'en_cola', mailId: ref.id, aceptados: [], rechazados: [] };
    }
    if (entrega.state === 'ERROR') {
      return { estado: 'error', mailId: ref.id, detalle: entrega.error, aceptados: [], rechazados: [] };
    }

    // nodemailer informa qué direcciones aceptó el servidor y cuáles no.
    const rechazados = entrega.info?.rejected ?? [];
    const aceptados = entrega.info?.accepted ?? destinatarios.filter(c => !rechazados.includes(c));
    const resultado: ResultadoEnvio = { estado: 'enviado', mailId: ref.id, aceptados, rechazados };

    try {
      resultado.gestionId = await this.gestionesService.registrarGestion({
        coactivadoId: envio.coactivado.cedula,
        coactivadoNombre: envio.coactivado.nombre,
        cartera: envio.coactivado.cartera,
        tipo: 'correo',
        descripcion: `${PREFIJO_GESTION_AVISO} por correo a ${aceptados.join(', ')}${envio.representanteLegal?.trim() ? ` (dirigido a ${envio.representanteLegal.trim()})` : ''}. TC: ${numeros.join('; ')}. Capital: ${formatoCapitalAviso(capital)}.`,
        mailId: ref.id
      });
    } catch (error: any) {
      resultado.errorGestion = error?.message || 'No se pudo registrar la gestión.';
    }

    return resultado;
  }

  // La extensión escribe `delivery` en el mismo documento: PENDING →
  // PROCESSING → SUCCESS o ERROR (con reintentos en RETRY). Solo nos interesa
  // el estado final. Si no llega a tiempo, o no se puede leer, se devuelve
  // null y el aviso queda "en cola": el correo puede salir igual.
  private async esperarEntrega(mailId: string): Promise<EntregaCorreo | null> {
    const ref = doc(this.firestore, `${COLECCION_MAIL_IESS}/${mailId}`);
    try {
      return await firstValueFrom(
        docData(ref).pipe(
          map(d => d?.['delivery'] as EntregaCorreo | undefined),
          filter((d): d is EntregaCorreo => d?.state === 'SUCCESS' || d?.state === 'ERROR'),
          timeout({ first: ESPERA_ENTREGA_MS })
        )
      );
    } catch (error) {
      console.warn('[Correos IESS] No se pudo confirmar la entrega de', mailId, error);
      return null;
    }
  }
}
