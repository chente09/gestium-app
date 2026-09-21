import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  runTransaction,
  query,
  where,
  limit
} from '@angular/fire/firestore';
import { RegistersService } from '../registers/registers.service';
import { UsersService } from '../users/users.service';
import { GestionesCoactivadoService } from '../gestionesCoactivado/gestiones-coactivado.service';

// La cédula (o RUC) es el ID del documento: así un mismo coactivado no se
// puede registrar dos veces, aunque dos personas lo creen a la vez.
export interface Coactivado {
  cedula: string;
  nombre: string;
  nombreBusqueda: string; // MAYÚSCULAS sin tildes, para buscar por prefijo
  cartera: string;
  creadoPor: { uid: string; nombre: string };
  fechaCreacion: Date | any;
}

export function normalizarCedula(valor: string): string {
  return valor.replace(/[\s.-]/g, '');
}

export function esCedulaValida(valor: string): boolean {
  return /^(\d{10}|\d{13})$/.test(valor);
}

function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function normalizarBusqueda(texto: string): string {
  return normalizarNombre(texto).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

@Injectable({
  providedIn: 'root'
})
export class CoactivadosService {
  private collectionName = 'coactivados';

  constructor(
    private firestore: Firestore,
    private registersService: RegistersService,
    private usersService: UsersService,
    private gestionesService: GestionesCoactivadoService
  ) { }

  async getByCedula(cedula: string): Promise<Coactivado | null> {
    const ref = doc(this.firestore, `${this.collectionName}/${cedula}`);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as Coactivado) : null;
  }

  // Prefijo sobre nombreBusqueda (los nombres van "APELLIDOS NOMBRES"): una
  // sola condición de rango + limit, sin índice compuesto y sin traer toda
  // la colección.
  async buscarPorNombre(termino: string): Promise<Coactivado[]> {
    const t = normalizarBusqueda(termino);
    if (!t) return [];

    const ref = collection(this.firestore, this.collectionName);
    const q = query(ref, where('nombreBusqueda', '>=', t), where('nombreBusqueda', '<=', t + ''), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Coactivado);
  }

  // Lanza Error('YA_EXISTE') si esa cédula ya está registrada.
  async crear(data: { cedula: string; nombre: string; cartera: string }): Promise<Coactivado> {
    const user = this.usersService.getCurrentUser();
    const register = this.registersService.getCurrentRegister();
    if (!user || !register) throw new Error('🔒 Usuario no autenticado');

    const cedula = normalizarCedula(data.cedula);
    const nombre = normalizarNombre(data.nombre);
    const coactivado: Coactivado = {
      cedula,
      nombre,
      nombreBusqueda: normalizarBusqueda(nombre),
      cartera: data.cartera,
      creadoPor: { uid: user.uid, nombre: register.displayName || user.email || 'Usuario' },
      fechaCreacion: new Date()
    };

    const ref = doc(this.firestore, `${this.collectionName}/${cedula}`);
    await runTransaction(this.firestore, async tx => {
      const snap = await tx.get(ref);
      if (snap.exists()) throw new Error('YA_EXISTE');
      tx.set(ref, coactivado);
    });

    return coactivado;
  }

  // Solo nombre y cartera son editables (las reglas de Firestore lo exigen).
  async actualizar(actual: Coactivado, cambios: { nombre: string; cartera: string }): Promise<Coactivado> {
    const nombre = normalizarNombre(cambios.nombre);
    const patch = { nombre, nombreBusqueda: normalizarBusqueda(nombre), cartera: cambios.cartera };

    const ref = doc(this.firestore, `${this.collectionName}/${actual.cedula}`);
    await updateDoc(ref, patch);
    return { ...actual, ...patch };
  }

  // Solo admin (las reglas de Firestore lo exigen). Primero borra lo que
  // cuelga del coactivado (gestiones y recordatorios) y por último el
  // coactivado: si algo falla a la mitad, la ficha sigue ahí y se puede
  // reintentar sin dejar registros huérfanos.
  async eliminar(cedula: string): Promise<void> {
    await this.gestionesService.eliminarPorCoactivado(cedula);
    await deleteDoc(doc(this.firestore, `${this.collectionName}/${cedula}`));
  }
}
