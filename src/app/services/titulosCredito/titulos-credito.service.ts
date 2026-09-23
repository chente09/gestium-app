import { Injectable } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteField,
  doc,
  documentId,
  getDocs,
  query,
  updateDoc,
  where
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { RegistersService } from '../registers/registers.service';
import { UsersService } from '../users/users.service';
import { borrarEnLotes, escribirEnLotes, EscrituraLote } from '../firestore-utils/batch-delete';
import { COLECCION_COACTIVADOS, normalizarBusqueda } from '../coactivados/coactivados.util';
import { COLECCION_GESTIONES } from '../gestionesCoactivado/gestiones-coactivado.service';
import { TipoCancelacion, TituloCredito } from './titulos-credito.util';
import { claveGestionHistorica, Existente, FilaTitulo, GestionHistorica, PlanCarga } from './importador-titulos.util';
import { FilaPago, PlanPagos, TituloExistente } from './pagos-titulos.util';

export const COLECCION_TITULOS = 'titulos_credito';
export const COLECCION_CARGAS = 'cargas_titulos';
export const COLECCION_CARGAS_PAGOS = 'cargas_pagos_honorarios';

// Firestore 'in' admite hasta 30 valores por consulta.
const TAM_CHUNK_IN = 30;

function chunks<T>(arr: T[], tam: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += tam) out.push(arr.slice(i, i + tam));
  return out;
}

// Registro de auditoría de cada importación: nunca se edita ni se borra.
export interface CargaTitulos {
  id?: string;
  archivo: string;
  cartera: string;
  nuevos: number;
  coactivadosNuevos: number;
  transiciones: number;
  // Opcional: las cargas hechas antes de esta funcionalidad no lo tienen.
  actualizaciones?: number;
  duplicados: number;
  conflictos: number;
  invalidos: number;
  // Opcional: las cargas hechas antes de esta funcionalidad no lo tienen.
  gestionesHistoricas?: number;
  // Opcional: las cargas hechas antes de esta funcionalidad no lo tienen.
  contactosCompletados?: number;
  realizadoPor: { uid: string; nombre: string };
  fecha: Date | any;
}

// Registro de auditoría de cada carga masiva de pagos ya cobrados: nunca se
// edita ni se borra.
export interface CargaPagos {
  id?: string;
  archivo: string;
  aplicados: number;
  yaEstabanCobrados: number;
  noEncontrados: number;
  conflictos: number;
  invalidos: number;
  // Si el archivo representaba títulos con el honorario ya cobrado del IESS,
  // o solo títulos cancelados por el cliente pero con el honorario aún
  // pendiente de solicitar/cobrar.
  honorarioYaCobrado: boolean;
  realizadoPor: { uid: string; nombre: string };
  fecha: Date | any;
}

@Injectable({
  providedIn: 'root'
})
export class TitulosCreditoService {
  private collectionName = COLECCION_TITULOS;

  constructor(
    private firestore: Firestore,
    private registersService: RegistersService,
    private usersService: UsersService
  ) { }

  // Ficha del coactivado: en tiempo real, acotado a un solo coactivado (bajo
  // costo). Un solo where, sin orderBy, para no necesitar índice compuesto
  // — se ordena en el cliente.
  getPorCoactivado(coactivadoId: string): Observable<TituloCredito[]> {
    const ref = collection(this.firestore, this.collectionName);
    const q = query(ref, where('coactivadoId', '==', coactivadoId));

    return (collectionData(q) as Observable<TituloCredito[]>).pipe(
      map(lista => [...lista].sort((a, b) => a.numero.localeCompare(b.numero)))
    );
  }

  async eliminarPorCoactivado(coactivadoId: string): Promise<void> {
    const ref = collection(this.firestore, this.collectionName);
    const snap = await getDocs(query(ref, where('coactivadoId', '==', coactivadoId)));
    await borrarEnLotes(this.firestore, snap.docs.map(d => d.ref));
  }

  // Cualquiera del área IESS puede registrarlo (lo exigen las reglas de
  // Firestore, que solo dejan tocar estos campos puntuales, no el resto del
  // título). Un abono no cierra el título — solo un pago total lo marca
  // como cancelado (estadoIess) y guarda el honorario, que es el dato real
  // que interesa para la estadística de recuperación.
  async registrarCancelacion(
    numero: string,
    datos: { tipo: TipoCancelacion; montoCancelado?: number; honorario?: number }
  ): Promise<void> {
    const user = this.usersService.getCurrentUser();
    const register = this.registersService.getCurrentRegister();
    if (!user || !register) throw new Error('🔒 Usuario no autenticado');

    // any (no unknown): así coincide con el UpdateData laxo que espera el
    // SDK de Firestore para updateDoc en una referencia sin tipar.
    const patch: Record<string, any> = {
      tipoCancelacion: datos.tipo,
      canceladoPor: { uid: user.uid, nombre: register.displayName || user.email || 'Usuario' },
      fechaCancelacion: new Date()
    };
    if (datos.tipo === 'pago_total') {
      patch['estadoIess'] = 'CANCELADO';
      patch['montoCancelado'] = datos.montoCancelado ?? 0;
      patch['honorario'] = datos.honorario ?? 0;
    }

    await updateDoc(doc(this.firestore, `${this.collectionName}/${numero}`), patch);
  }

  // Solo admin: deshace una cancelación registrada por error (usa la regla
  // general de admin, no la de campos restringidos — por eso solo admin).
  async deshacerCancelacion(numero: string): Promise<void> {
    await updateDoc(doc(this.firestore, `${this.collectionName}/${numero}`), {
      tipoCancelacion: deleteField(),
      estadoIess: deleteField(),
      montoCancelado: deleteField(),
      honorario: deleteField(),
      canceladoPor: deleteField(),
      fechaCancelacion: deleteField(),
      honorarioCobrado: deleteField(),
      honorarioCobradoPor: deleteField(),
      fechaCobroHonorario: deleteField()
    });
  }

  // Que el título esté cancelado y que el IESS ya le haya pagado el
  // honorario a la oficina son cosas distintas — cualquiera del área lo
  // puede marcar, igual que registrarCancelacion.
  async marcarHonorarioCobrado(numero: string, cobrado: boolean): Promise<void> {
    const user = this.usersService.getCurrentUser();
    const register = this.registersService.getCurrentRegister();
    if (!user || !register) throw new Error('🔒 Usuario no autenticado');

    const patch: Record<string, any> = { honorarioCobrado: cobrado };
    if (cobrado) {
      patch['honorarioCobradoPor'] = { uid: user.uid, nombre: register.displayName || user.email || 'Usuario' };
      patch['fechaCobroHonorario'] = new Date();
    } else {
      patch['honorarioCobradoPor'] = deleteField();
      patch['fechaCobroHonorario'] = deleteField();
    }

    await updateDoc(doc(this.firestore, `${this.collectionName}/${numero}`), patch);
  }

  // ============================================
  // 📥 Importación (solo admin — lo exige la UI y las reglas de Firestore)
  // ============================================

  // Títulos ya cargados entre los RUC que trae el archivo — se consulta por
  // RUC (no por número de título uno por uno), así el costo depende de
  // cuántos títulos ya tienen esos coactivados, no del tamaño de toda la
  // colección.
  async getExistentesParaRucs(rucs: string[]): Promise<Map<string, Existente>> {
    const distintos = [...new Set(rucs)];
    const ref = collection(this.firestore, this.collectionName);

    const snaps = await Promise.all(
      chunks(distintos, TAM_CHUNK_IN).map(grupo => getDocs(query(ref, where('coactivadoId', 'in', grupo))))
    );
    const resultado = new Map<string, Existente>();
    snaps.forEach(snap => snap.forEach(d => {
      const data = d.data() as TituloCredito;
      resultado.set(d.id, { numero: d.id, coactivadoId: data.coactivadoId, estadoEntrega: data.estadoEntrega, estadoIess: data.estadoIess });
    }));
    return resultado;
  }

  async getCoactivadosParaRucs(
    rucs: string[]
  ): Promise<Map<string, { cartera: string; representanteLegal?: string; telefono?: string; correo?: string }>> {
    const distintos = [...new Set(rucs)];
    const ref = collection(this.firestore, COLECCION_COACTIVADOS);

    const snaps = await Promise.all(
      chunks(distintos, TAM_CHUNK_IN).map(grupo => getDocs(query(ref, where(documentId(), 'in', grupo))))
    );
    const resultado = new Map<string, { cartera: string; representanteLegal?: string; telefono?: string; correo?: string }>();
    snaps.forEach(snap => snap.forEach(d => {
      const data = d.data() as { cartera: string; representanteLegal?: string; telefono?: string; correo?: string };
      resultado.set(d.id, { cartera: data.cartera, representanteLegal: data.representanteLegal, telefono: data.telefono, correo: data.correo });
    }));
    return resultado;
  }

  // Notas históricas ya migradas para esos RUC (tipo 'migrado'), como set de
  // claves — para que el importador no vuelva a crear la misma gestión si se
  // repite una carga (a propósito o por doble clic en "Confirmar").
  async getNotasHistoricasExistentes(rucs: string[]): Promise<Set<string>> {
    const distintos = [...new Set(rucs)];
    const ref = collection(this.firestore, COLECCION_GESTIONES);

    const snaps = await Promise.all(
      chunks(distintos, TAM_CHUNK_IN).map(grupo => getDocs(query(ref, where('tipo', '==', 'migrado'), where('coactivadoId', 'in', grupo))))
    );
    const resultado = new Set<string>();
    snaps.forEach(snap => snap.forEach(d => {
      const clave = (d.data() as { claveHistorica?: string }).claveHistorica;
      if (clave) resultado.add(clave);
    }));
    return resultado;
  }

  // Aplica un plan ya confirmado por el admin: crea los coactivados nuevos,
  // crea los títulos nuevos, pasa a "entregado" los que correspondan (sin
  // tocar quién y cuándo se registraron originalmente) y deja el registro
  // de auditoría de la carga. Se crea el registro de auditoría PRIMERO para
  // tener su id y marcar cada escritura con `cargaId` — así, si el
  // navegador se cierra a mitad de una carga grande, se puede ver hasta
  // dónde llegó.
  async confirmarCarga(plan: PlanCarga, cartera: string, archivo: string): Promise<string> {
    const user = this.usersService.getCurrentUser();
    const register = this.registersService.getCurrentRegister();
    if (!user || !register) throw new Error('🔒 Usuario no autenticado');
    const realizadoPor = { uid: user.uid, nombre: register.displayName || user.email || 'Usuario' };

    const carga: Omit<CargaTitulos, 'id'> = {
      archivo,
      cartera,
      nuevos: plan.nuevos.length,
      coactivadosNuevos: plan.coactivadosNuevos.length,
      transiciones: plan.transiciones.length,
      actualizaciones: plan.actualizaciones.length,
      duplicados: plan.duplicados.length,
      conflictos: plan.conflictos.length,
      invalidos: plan.invalidos.length,
      gestionesHistoricas: plan.gestionesHistoricas.length,
      contactosCompletados: plan.contactosCompletados.length,
      realizadoPor,
      fecha: new Date()
    };
    const cargaRef = await addDoc(collection(this.firestore, COLECCION_CARGAS), carga);

    const escrituras: EscrituraLote[] = [];

    for (const c of plan.coactivadosNuevos) {
      const datosCoactivado: Record<string, unknown> = {
        cedula: c.ruc,
        nombre: c.nombre,
        nombreBusqueda: normalizarBusqueda(c.nombre),
        cartera: c.cartera,
        creadoPor: realizadoPor,
        fechaCreacion: new Date()
      };
      if (c.representanteLegal) datosCoactivado['representanteLegal'] = c.representanteLegal;
      if (c.telefono) datosCoactivado['telefono'] = c.telefono;
      if (c.correo) datosCoactivado['correo'] = c.correo;
      escrituras.push({
        ref: doc(this.firestore, `${COLECCION_COACTIVADOS}/${c.ruc}`),
        tipo: 'set',
        data: datosCoactivado
      });
    }

    // Coactivados ya existentes a los que la matriz les completa un dato de
    // contacto que no tenían — nunca pisa lo que ya estaba guardado.
    for (const c of plan.contactosCompletados) {
      const patch: Record<string, unknown> = {};
      if (c.representanteLegal) patch['representanteLegal'] = c.representanteLegal;
      if (c.telefono) patch['telefono'] = c.telefono;
      if (c.correo) patch['correo'] = c.correo;
      escrituras.push({
        ref: doc(this.firestore, `${COLECCION_COACTIVADOS}/${c.ruc}`),
        tipo: 'update',
        data: patch
      });
    }

    for (const f of plan.nuevos) {
      escrituras.push({
        ref: doc(this.firestore, `${this.collectionName}/${f.numero}`),
        tipo: 'set',
        data: { ...this.camposTitulo(f), creadoPor: realizadoPor, fechaCreacion: new Date(), cargaId: cargaRef.id }
      });
    }

    // Título que ya existía como "no entregado": se actualiza (no se
    // reemplaza el documento) para conservar quién y cuándo se registró
    // por primera vez.
    for (const f of plan.transiciones) {
      escrituras.push({
        ref: doc(this.firestore, `${this.collectionName}/${f.numero}`),
        tipo: 'update',
        data: { ...this.camposTitulo(f), actualizadoPor: realizadoPor, fechaActualizacion: new Date(), cargaId: cargaRef.id }
      });
    }

    // Mismo estado de entrega, pero cambió estadoIess (ej. recién se detecta
    // "CANCELADO" en la observación) — se actualiza igual que una transición.
    for (const f of plan.actualizaciones) {
      escrituras.push({
        ref: doc(this.firestore, `${this.collectionName}/${f.numero}`),
        tipo: 'update',
        data: { ...this.camposTitulo(f), actualizadoPor: realizadoPor, fechaActualizacion: new Date(), cargaId: cargaRef.id }
      });
    }

    for (const g of plan.gestionesHistoricas) {
      escrituras.push({
        ref: doc(collection(this.firestore, COLECCION_GESTIONES)), // ID automático
        tipo: 'set',
        data: this.gestionMigrada(g, realizadoPor, cargaRef.id)
      });
    }

    await escribirEnLotes(this.firestore, escrituras);
    return cargaRef.id;
  }

  // Se atribuye a quien hace la importación (lo exigen las reglas de
  // Firestore) — quién hizo la llamada y cuándo, según el Excel, quedan en
  // el propio texto, no se pueden usar como `registradoPor` real.
  private gestionMigrada(g: GestionHistorica, realizadoPor: { uid: string; nombre: string }, cargaId: string): Record<string, unknown> {
    const contacto = g.personaLlama ? ` (contacto original: ${g.personaLlama})` : '';
    const [y, m, d] = g.fecha ? g.fecha.split('-').map(Number) : [];
    const data: Record<string, unknown> = {
      coactivadoId: g.ruc,
      coactivadoNombre: g.coactivadoNombre,
      tipo: 'migrado',
      descripcion: `${g.descripcion}${contacto}`,
      fecha: y ? new Date(y, m - 1, d, 12, 0, 0) : new Date(),
      registradoPor: realizadoPor,
      cargaId,
      // Clave estable (RUC + texto original, sin el sufijo de contacto) para
      // no volver a migrar esta misma nota si se repite una carga.
      claveHistorica: claveGestionHistorica(g.ruc, g.descripcion, g.observacionGeneral)
    };
    if (g.observacionGeneral) data['observacionGeneral'] = g.observacionGeneral;
    return data;
  }

  private camposTitulo(f: FilaTitulo): Record<string, unknown> {
    const data: Record<string, unknown> = {
      numero: f.numero,
      coactivadoId: f.ruc,
      capital: f.capital,
      estadoEntrega: f.estadoEntrega
    };
    if (f.cartera) data['cartera'] = f.cartera;
    if (f.estadoIess) data['estadoIess'] = f.estadoIess;
    if (f.guia) data['guia'] = f.guia;
    if (f.guiaCoactiva) data['guiaCoactiva'] = f.guiaCoactiva;
    if (f.fechaSorteo) data['fechaSorteo'] = f.fechaSorteo;
    if (f.fechaEntrega) data['fechaEntrega'] = f.fechaEntrega;
    if (f.fechaEmision) data['fechaEmision'] = f.fechaEmision;
    if (f.juez) data['juez'] = f.juez;
    return data;
  }

  // Deshace SOLO las gestiones históricas migradas por una carga (no toca
  // títulos ni coactivados) — para corregir un doble clic en "Confirmar" o
  // una migración hecha por error. La carga sigue en el historial: queda
  // registrado que se migró y que luego se deshizo, nunca se borra ni edita.
  async eliminarGestionesMigradasDeCarga(cargaId: string): Promise<number> {
    const ref = collection(this.firestore, COLECCION_GESTIONES);
    const snap = await getDocs(query(ref, where('cargaId', '==', cargaId), where('tipo', '==', 'migrado')));
    await borrarEnLotes(this.firestore, snap.docs.map(d => d.ref));
    return snap.size;
  }

  async getCargas(): Promise<CargaTitulos[]> {
    const snap = await getDocs(collection(this.firestore, COLECCION_CARGAS));
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Omit<CargaTitulos, 'id'>) }))
      .map(c => ({ ...c, fecha: (c.fecha as any)?.toDate ? (c.fecha as any).toDate() : c.fecha }))
      .sort((a, b) => (b.fecha as Date).getTime() - (a.fecha as Date).getTime());
  }

  // ============================================
  // 💰 Carga masiva de pagos ya cobrados (solo admin)
  // ============================================

  // Se busca por número de título (documentId), no por RUC — acá ya
  // sabemos exactamente qué títulos trae el archivo.
  async getTitulosPorNumeros(numeros: string[]): Promise<Map<string, TituloExistente>> {
    const distintos = [...new Set(numeros)];
    const ref = collection(this.firestore, this.collectionName);

    const snaps = await Promise.all(
      chunks(distintos, TAM_CHUNK_IN).map(grupo => getDocs(query(ref, where(documentId(), 'in', grupo))))
    );
    const resultado = new Map<string, TituloExistente>();
    snaps.forEach(snap => snap.forEach(d => {
      const data = d.data() as TituloCredito;
      resultado.set(d.id, { numero: d.id, coactivadoId: data.coactivadoId, yaEstabaCobrado: !!data.honorarioCobrado });
    }));
    return resultado;
  }

  async confirmarPagos(plan: PlanPagos, archivo: string, honorarioYaCobrado: boolean): Promise<string> {
    const user = this.usersService.getCurrentUser();
    const register = this.registersService.getCurrentRegister();
    if (!user || !register) throw new Error('🔒 Usuario no autenticado');
    const realizadoPor = { uid: user.uid, nombre: register.displayName || user.email || 'Usuario' };

    const carga: Omit<CargaPagos, 'id'> = {
      archivo,
      aplicados: plan.validos.length,
      yaEstabanCobrados: plan.yaEstabanCobrados.length,
      noEncontrados: plan.noEncontrados.length,
      conflictos: plan.conflictos.length,
      invalidos: plan.invalidos.length,
      honorarioYaCobrado,
      realizadoPor,
      fecha: new Date()
    };
    const cargaRef = await addDoc(collection(this.firestore, COLECCION_CARGAS_PAGOS), carga);

    const escrituras: EscrituraLote[] = plan.validos.map(f => ({
      ref: doc(this.firestore, `${this.collectionName}/${f.numero}`),
      tipo: 'update',
      data: this.camposPago(f, realizadoPor, cargaRef.id, honorarioYaCobrado)
    }));

    await escribirEnLotes(this.firestore, escrituras);
    return cargaRef.id;
  }

  private camposPago(
    f: FilaPago,
    realizadoPor: { uid: string; nombre: string },
    cargaId: string,
    honorarioYaCobrado: boolean
  ): Record<string, any> {
    const [y, m, d] = f.fecha ? f.fecha.split('-').map(Number) : [];
    const fechaCancelacion = y ? new Date(y, m - 1, d, 12, 0, 0) : new Date();
    const data: Record<string, any> = {
      tipoCancelacion: 'pago_total',
      estadoIess: 'CANCELADO',
      montoCancelado: f.montoCancelado,
      honorario: f.honorario,
      canceladoPor: realizadoPor,
      fechaCancelacion,
      cargaPagosId: cargaId
    };
    // El cliente ya canceló el título en ambos casos; el honorario del IESS
    // a la oficina es un cobro aparte que puede no haberse solicitado aún.
    if (honorarioYaCobrado) {
      data['honorarioCobrado'] = true;
      data['honorarioCobradoPor'] = realizadoPor;
      data['fechaCobroHonorario'] = fechaCancelacion;
    }
    if (f.comprobante) data['comprobantePago'] = f.comprobante;
    return data;
  }

  async getCargasPagos(): Promise<CargaPagos[]> {
    const snap = await getDocs(collection(this.firestore, COLECCION_CARGAS_PAGOS));
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Omit<CargaPagos, 'id'>) }))
      .map(c => ({ ...c, fecha: (c.fecha as any)?.toDate ? (c.fecha as any).toDate() : c.fecha }))
      .sort((a, b) => (b.fecha as Date).getTime() - (a.fecha as Date).getTime());
  }
}
