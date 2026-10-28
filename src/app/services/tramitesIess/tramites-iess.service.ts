import { Injectable } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  deleteField,
  doc,
  runTransaction,
  writeBatch
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { RegistersService } from '../registers/registers.service';
import { UsersService } from '../users/users.service';
import { DateUtilsService } from '../date-utils/date-utils.service';
import {
  COLECCION_TRAMITES,
  CambiosTramite,
  DatosTramite,
  EntradaCosto,
  EntradaPagoTramite,
  EstadoEtapa,
  Tramite,
  UsuarioRegistro,
  aFecha,
  cambiosAlAgregarGestion,
  cambiosAlCambiarEtapa,
  cambiosAlCerrar,
  cambiosAlGuardarCosto,
  cambiosAlPagarTercero,
  cambiosAlQuitarCosto,
  cambiosAlReabrir,
  cambiosAlRegistrarPago,
  cambiosAlReversarPago,
  cambiosAlReversarPagoTercero,
  normalizarDatos,
  tramiteNuevo
} from './tramites-iess.util';
import { TramiteImportable, armarTramite, origenesRadiografia } from './importador-tramites.util';

// Escrituras por lote al importar (Firestore admite 500).
const LOTE_IMPORTACION = 400;

// Los trámites son pocos (decenas o cientos): se leen todos en tiempo real
// con una sola consulta, sin filtros ni índices. Cada acción que toca un
// arreglo (pagos, costos, gestiones, etapas) va en una transacción, para que
// dos personas trabajando el mismo trámite no se pisen el historial.
@Injectable({
  providedIn: 'root'
})
export class TramitesIessService {
  constructor(
    private firestore: Firestore,
    private registersService: RegistersService,
    private usersService: UsersService,
    private dateUtils: DateUtilsService
  ) { }

  // Lo más reciente primero.
  getTramites(): Observable<Tramite[]> {
    const ref = collection(this.firestore, COLECCION_TRAMITES);
    return (collectionData(ref, { idField: 'id' }) as Observable<Tramite[]>).pipe(
      map(lista => [...lista].sort((a, b) =>
        (aFecha(b.ultimoMovimiento)?.getTime() ?? 0) - (aFecha(a.ultimoMovimiento)?.getTime() ?? 0)))
    );
  }

  // Quién anota cada cosa: queda en cada pago, etapa y gestión.
  private usuario(): UsuarioRegistro {
    const user = this.usersService.getCurrentUser();
    const register = this.registersService.getCurrentRegister();
    if (!user || !register) throw new Error('🔒 Usuario no autenticado');
    return { uid: user.uid, nombre: register.displayName || user.email || 'Usuario' };
  }

  private exigirAdmin(): void {
    if (!this.registersService.isCurrentUserAdmin()) throw new Error('Solo un admin puede hacer esto.');
  }

  private ref(id: string) {
    return doc(this.firestore, `${COLECCION_TRAMITES}/${id}`);
  }

  async crear(datos: DatosTramite): Promise<string> {
    const nuevo = tramiteNuevo(datos, this.usuario(), new Date());
    const creado = await addDoc(collection(this.firestore, COLECCION_TRAMITES), nuevo);
    return creado.id;
  }

  // Solo se tocan los campos que vienen; los vacíos se borran del documento.
  async actualizarDatos(id: string, datos: Partial<DatosTramite>): Promise<void> {
    const { valores, borrar } = normalizarDatos(datos);
    const patch: Record<string, any> = { ...valores };
    borrar.forEach(campo => { patch[campo] = deleteField(); });

    await runTransaction(this.firestore, async tx => {
      const ref = this.ref(id);
      if (!(await tx.get(ref)).exists()) throw new Error('El trámite ya no existe.');
      tx.update(ref, patch);
    });
  }

  // Lee el trámite actual, calcula los cambios (lógica pura, probada) y los guarda.
  private async aplicar(id: string, calcular: (t: Tramite, usuario: UsuarioRegistro, ahora: Date) => CambiosTramite): Promise<void> {
    const usuario = this.usuario();
    const ahora = new Date();
    const ref = this.ref(id);

    await runTransaction(this.firestore, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('El trámite ya no existe.');

      const { cambios, quitar } = calcular({ ...(snap.data() as Tramite), id }, usuario, ahora);
      const patch: Record<string, any> = { ...cambios };
      quitar.forEach(campo => { patch[campo] = deleteField(); });
      tx.update(ref, patch);
    });
  }

  private hoy(): string {
    return this.dateUtils.getFechaActualEcuador();
  }

  cambiarEtapa(id: string, etapaId: string, estado: EstadoEtapa): Promise<void> {
    return this.aplicar(id, (t, u, ahora) => cambiosAlCambiarEtapa(t, etapaId, estado, u, ahora, this.hoy()));
  }

  registrarPago(id: string, pago: EntradaPagoTramite): Promise<void> {
    return this.aplicar(id, (t, u, ahora) => cambiosAlRegistrarPago(t, pago, u, ahora));
  }

  // Solo admin (lo exige la pantalla; las reglas de Firestore no distinguen
  // un pago quitado dentro del arreglo).
  reversarPago(id: string, indice: number): Promise<void> {
    this.exigirAdmin();
    return this.aplicar(id, (t, u, ahora) => cambiosAlReversarPago(t, indice, u, ahora));
  }

  guardarCosto(id: string, costo: Omit<EntradaCosto, 'id'> & { id?: string }): Promise<void> {
    const entrada: EntradaCosto = { ...costo, id: costo.id ?? crypto.randomUUID() };
    return this.aplicar(id, (t, u, ahora) => cambiosAlGuardarCosto(t, entrada, u, ahora));
  }

  quitarCosto(id: string, costoId: string): Promise<void> {
    this.exigirAdmin();
    return this.aplicar(id, (t, u, ahora) => cambiosAlQuitarCosto(t, costoId, u, ahora));
  }

  registrarPagoTercero(id: string, costoId: string, pago: EntradaPagoTramite): Promise<void> {
    return this.aplicar(id, (t, u, ahora) => cambiosAlPagarTercero(t, costoId, pago, u, ahora));
  }

  reversarPagoTercero(id: string, costoId: string, indice: number): Promise<void> {
    this.exigirAdmin();
    return this.aplicar(id, (t, u, ahora) => cambiosAlReversarPagoTercero(t, costoId, indice, u, ahora));
  }

  agregarGestion(id: string, texto: string): Promise<void> {
    return this.aplicar(id, (t, u, ahora) => cambiosAlAgregarGestion(t, texto, u, ahora));
  }

  cerrar(id: string, estado: 'terminado' | 'desistido', motivo?: string): Promise<void> {
    return this.aplicar(id, (t, u, ahora) => cambiosAlCerrar(t, estado, motivo, u, ahora, this.hoy()));
  }

  reabrir(id: string): Promise<void> {
    return this.aplicar(id, (t, u, ahora) => cambiosAlReabrir(t, u, ahora));
  }

  // Carga de trámites desde el Excel (solo admin). Los ids se generan antes de
  // escribir para poder enlazar cada anulación con su radiografía; todo va en
  // lotes, así un lote que falla no deja trámites a medias.
  async importar(items: TramiteImportable[]): Promise<number> {
    this.exigirAdmin();
    if (items.length === 0) return 0;

    const usuario = this.usuario();
    const ahora = new Date();
    const hoyIso = this.hoy();
    const origenes = origenesRadiografia(items);
    const refs = items.map(() => doc(collection(this.firestore, COLECCION_TRAMITES)));

    const tramites = items.map((item, i) => {
      const tramite = armarTramite(item, usuario, ahora, hoyIso, () => crypto.randomUUID());
      const origen = origenes[i];
      if (origen !== null) tramite.origenTramiteId = refs[origen].id;
      return tramite;
    });

    for (let desde = 0; desde < tramites.length; desde += LOTE_IMPORTACION) {
      const lote = writeBatch(this.firestore);
      tramites.slice(desde, desde + LOTE_IMPORTACION).forEach((tramite, k) => lote.set(refs[desde + k], tramite));
      await lote.commit();
    }
    return tramites.length;
  }

  async eliminar(id: string): Promise<void> {
    this.exigirAdmin();
    await deleteDoc(this.ref(id));
  }
}
