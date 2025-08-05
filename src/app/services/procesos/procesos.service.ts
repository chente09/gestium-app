import { Injectable } from '@angular/core';
import { Firestore, addDoc, collection, collectionData, doc, updateDoc, getDoc, deleteDoc, query, where } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { Observable, map } from 'rxjs';

export interface Documento {
  nombre: string;
  url: string;
}

export interface Etapa {
  nombre: string;
  descripcion: string;
  fechaRegistro: Date;
  documentos: Documento[];
}

export interface Proceso {
  id?: string;
  nombre: string;
  cedula: string;
  descripcion: string;
  abogadoId: string;
  fechaCreacion: Date;
  etapas: Etapa[];
  materia: string; // Nueva propiedad para categorizar por materia
}

export type MateriaProceso = 'ISSFA' | 'Inmobiliario' | 'Produbanco' | 'Civil' | 'Laboral' | 'Tributario' | 'Otros';

@Injectable({
  providedIn: 'root'
})
export class ProcesosService {

  private collectionName = 'procesos';

  constructor(private firestore: Firestore, private storage: Storage) { }

  // 📌 Crear un proceso judicial con materia

  async crearProceso(proceso: {
    nombre: string;
    descripcion: string;
    abogadoId: string;
    cedula: string;
    materia: MateriaProceso;
    fechaCreacion?: Date; // Hacer la fecha opcional
  }): Promise<string> {
    try {
      const docRef = collection(this.firestore, this.collectionName);
      const docSnap = await addDoc(docRef, {
        ...proceso,
        etapas: [],
        fechaCreacion: proceso.fechaCreacion || new Date() // Usar la fecha proporcionada o la actual
      });

      return docSnap.id;
    } catch (error) {
      console.error('Error al crear el proceso:', error);
      throw new Error('No se pudo crear el proceso');
    }
  }

  // 📌 Obtener todos los procesos en tiempo real
  getProcesos(): Observable<Proceso[]> {
    const procesosRef = collection(this.firestore, this.collectionName);
    return collectionData(procesosRef, { idField: 'id' }) as Observable<Proceso[]>;
  }

  // 📌 Obtener procesos por materia específica
  getProcesosPorMateria(materia: MateriaProceso): Observable<Proceso[]> {
    const procesosRef = collection(this.firestore, this.collectionName);
    const q = query(procesosRef, where('materia', '==', materia));
    return collectionData(q, { idField: 'id' }) as Observable<Proceso[]>;
  }

  // 📌 Obtener procesos por múltiples materias
  getProcesosPorMaterias(materias: MateriaProceso[]): Observable<Proceso[]> {
    if (!materias || materias.length === 0) {
      return this.getProcesos();
    }

    return this.getProcesos().pipe(
      map(procesos => procesos.filter(proceso => materias.includes(proceso.materia as MateriaProceso)))
    );
  }

  // 📌 Obtener procesos por abogado y materia
  getProcesosPorAbogadoYMateria(abogadoId: string, materia?: MateriaProceso): Observable<Proceso[]> {
    let q = query(collection(this.firestore, this.collectionName), where('abogadoId', '==', abogadoId));
    if (materia) q = query(q, where('materia', '==', materia));
    return collectionData(q, { idField: 'id' }) as Observable<Proceso[]>;
  }

  // 📌 Obtener un proceso por ID
  async getProcesoById(procesoId: string): Promise<Proceso | null> {
    try {
      const procesoRef = doc(this.firestore, `${this.collectionName}/${procesoId}`);
      const procesoSnap = await getDoc(procesoRef);

      if (!procesoSnap.exists()) {
        return null;
      }

      return { id: procesoSnap.id, ...procesoSnap.data() } as Proceso;
    } catch (error) {
      console.error('Error al obtener el proceso:', error);
      throw new Error('No se pudo obtener el proceso');
    }
  }

  // 📌 Actualizar la materia de un proceso
  async actualizarMateriaProceso(procesoId: string, materia: MateriaProceso): Promise<void> {
    try {
      const procesoRef = doc(this.firestore, `${this.collectionName}/${procesoId}`);
      await updateDoc(procesoRef, { materia });
    } catch (error) {
      console.error('Error al actualizar la materia del proceso:', error);
      throw new Error('No se pudo actualizar la materia del proceso');
    }
  }

  // 📌 Agregar etapa a un proceso
  async agregarEtapa(procesoId: string, etapa: { nombre: string; fechaRegistro: Date; descripcion: string }): Promise<void> {
    try {
      const procesoRef = doc(this.firestore, `${this.collectionName}/${procesoId}`);
      const procesoSnap = await getDoc(procesoRef);

      if (!procesoSnap.exists()) {
        throw new Error('El proceso no existe');
      }

      const data = procesoSnap.data() as Proceso;
      const nuevasEtapas = data.etapas || []; // Si no hay etapas, inicializa un arreglo vacío
      nuevasEtapas.push({ ...etapa, documentos: [] }); // Añade la nueva etapa

      await updateDoc(procesoRef, { etapas: nuevasEtapas });
    } catch (error) {
      console.error('Error al agregar la etapa:', error);
      throw new Error('No se pudo agregar la etapa');
    }
  }

  // 📌 Subir un documento a una etapa
  async subirDocumento(procesoId: string, indiceEtapa: number, file: File): Promise<string> {
    try {
      // Subir el archivo a Firebase Storage
      const filePath = `procesos/${procesoId}/etapas/${indiceEtapa}/${file.name}`;
      const fileRef = ref(this.storage, filePath);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      // Actualizar el proceso en Firestore
      const procesoRef = doc(this.firestore, `${this.collectionName}/${procesoId}`);
      const procesoSnap = await getDoc(procesoRef);

      if (!procesoSnap.exists()) {
        throw new Error('El proceso no existe');
      }

      const data = procesoSnap.data() as Proceso;
      if (!data.etapas || !data.etapas[indiceEtapa]) {
        throw new Error('La etapa no existe');
      }

      // Añade el documento a la etapa correspondiente
      const documentos = data.etapas[indiceEtapa].documentos || [];
      documentos.push({ nombre: file.name, url });
      data.etapas[indiceEtapa].documentos = documentos;

      await updateDoc(procesoRef, { etapas: data.etapas });

      return url; // Devuelve la URL del archivo subido
    } catch (error) {
      console.error('Error al subir el documento:', error);
      throw new Error('No se pudo subir el documento');
    }
  }

  // 📌 Actualizar un proceso existente
  async actualizarProceso(procesoId: string, nuevosDatos: Partial<Proceso>): Promise<void> {
    try {
      const procesoRef = doc(this.firestore, `${this.collectionName}/${procesoId}`);
      const procesoSnap = await getDoc(procesoRef);

      if (!procesoSnap.exists()) {
        throw new Error('El proceso no existe');
      }

      // Actualiza solo los campos proporcionados en `nuevosDatos`
      await updateDoc(procesoRef, nuevosDatos);
    } catch (error) {
      console.error('Error al actualizar el proceso:', error);
      throw new Error('No se pudo actualizar el proceso');
    }
  }

  // 📌 Actualizar una etapa de un proceso
  async actualizarEtapa(procesoId: string, indiceEtapa: number, nuevosDatos: Partial<Etapa>): Promise<void> {
    try {
      const procesoRef = doc(this.firestore, `${this.collectionName}/${procesoId}`);
      const procesoSnap = await getDoc(procesoRef);

      if (!procesoSnap.exists()) {
        throw new Error('El proceso no existe');
      }

      const data = procesoSnap.data() as Proceso;
      if (!data.etapas || !data.etapas[indiceEtapa]) {
        throw new Error('La etapa no existe');
      }

      // Actualiza solo los campos proporcionados en `nuevosDatos`
      data.etapas[indiceEtapa] = { ...data.etapas[indiceEtapa], ...nuevosDatos };

      // Guarda los cambios en Firestore
      await updateDoc(procesoRef, { etapas: data.etapas });
    } catch (error) {
      console.error('Error al actualizar la etapa:', error);
      throw new Error('No se pudo actualizar la etapa');
    }
  }

  // 📌 Eliminar un proceso
  async eliminarProceso(procesoId: string): Promise<void> {
    try {
      const procesoRef = doc(this.firestore, `${this.collectionName}/${procesoId}`);
      const procesoSnap = await getDoc(procesoRef);

      if (!procesoSnap.exists()) {
        throw new Error('El proceso no existe');
      }

      // Eliminar el proceso de Firestore
      await deleteDoc(procesoRef);
    } catch (error) {
      console.error('Error al eliminar el proceso:', error);
      throw new Error('No se pudo eliminar el proceso');
    }
  }

  // 📌 Eliminar una etapa de un proceso
  async eliminarEtapa(procesoId: string, indiceEtapa: number): Promise<void> {
    try {
      const procesoRef = doc(this.firestore, `${this.collectionName}/${procesoId}`);
      const procesoSnap = await getDoc(procesoRef);

      if (!procesoSnap.exists()) {
        throw new Error('El proceso no existe');
      }

      const data = procesoSnap.data() as Proceso;
      if (!data.etapas || !data.etapas[indiceEtapa]) {
        throw new Error('La etapa no existe');
      }

      // Eliminar la etapa del arreglo de etapas
      data.etapas.splice(indiceEtapa, 1);

      // Actualizar el proceso en Firestore
      await updateDoc(procesoRef, { etapas: data.etapas });
    } catch (error) {
      console.error('Error al eliminar la etapa:', error);
      throw new Error('No se pudo eliminar la etapa');
    }
  }

  // 📌 Eliminar documento de una etapa
  async eliminarDocumento(procesoId: string, indiceEtapa: number, documento: Documento): Promise<void> {
    try {
      // Eliminar el archivo de Firebase Storage
      const filePath = `procesos/${procesoId}/etapas/${indiceEtapa}/${documento.nombre}`;
      const fileRef = ref(this.storage, filePath);
      await deleteObject(fileRef);

      // Obtener el proceso de Firestore
      const procesoRef = doc(this.firestore, `${this.collectionName}/${procesoId}`);
      const procesoSnap = await getDoc(procesoRef);

      if (!procesoSnap.exists()) {
        throw new Error('El proceso no existe');
      }

      const data = procesoSnap.data() as Proceso;
      if (!data.etapas || !data.etapas[indiceEtapa]) {
        throw new Error('La etapa no existe');
      }

      // Filtrar los documentos de la etapa y eliminar el documento seleccionado
      data.etapas[indiceEtapa].documentos = data.etapas[indiceEtapa].documentos.filter(doc => doc.nombre !== documento.nombre);
      await updateDoc(procesoRef, { etapas: data.etapas });
    } catch (error) {
      console.error('Error al eliminar el documento:', error);
      throw new Error('No se pudo eliminar el documento');
    }
  }

  async obtenerDocumentos(procesoId: string, indiceEtapa: number): Promise<Documento[]> {
    try {
      const procesoRef = doc(this.firestore, `${this.collectionName}/${procesoId}`);
      const procesoSnap = await getDoc(procesoRef);

      if (!procesoSnap.exists()) {
        throw new Error('El proceso no existe');
      }

      const data = procesoSnap.data() as Proceso;
      if (!data.etapas || !data.etapas[indiceEtapa]) {
        throw new Error('La etapa no existe');
      }

      return data.etapas[indiceEtapa].documentos || [];
    } catch (error) {
      console.error('Error al obtener documentos:', error);
      throw new Error('No se pudieron obtener los documentos');
    }
  }
}