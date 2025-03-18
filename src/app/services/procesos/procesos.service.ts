import { Injectable } from '@angular/core';
import { Firestore, addDoc, collection, collectionData, doc, updateDoc, getDoc, deleteDoc } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { Observable } from 'rxjs';

export interface Documento {
  nombre: string;
  url: string;
}

export interface Etapa {
  nombre: string;
  descripcion: string;
  documentos: Documento[];
}

export interface Proceso {
  id?: string;
  nombre: string;
  descripcion: string;
  abogadoId: string;
  fechaCreacion: Date;
  etapas: Etapa[];
}

@Injectable({
  providedIn: 'root'
})
export class ProcesosService {

  private collectionName = 'procesos';

  constructor(private firestore: Firestore, private storage: Storage) { }

  // 📌 Crear un proceso judicial
  async crearProceso(proceso: { nombre: string; descripcion: string; abogadoId: string }): Promise<void> {
    try {
      const docRef = collection(this.firestore, this.collectionName);
      await addDoc(docRef, {
        ...proceso,
        etapas: [], // Inicializa las etapas como un arreglo vacío
        fechaCreacion: new Date() // Añade la fecha de creación
      });
    } catch (error) {
      console.error('Error al crear el proceso:', error);
      throw new Error('No se pudo crear el proceso');
    }
  }

  // 📌 Obtener procesos en tiempo real
  getProcesos(): Observable<Proceso[]> {
    const procesosRef = collection(this.firestore, this.collectionName);
    return collectionData(procesosRef, { idField: 'id' }) as Observable<Proceso[]>;
  }

  // 📌 Agregar etapa a un proceso
  async agregarEtapa(procesoId: string, etapa: { nombre: string; descripcion: string }): Promise<void> {
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
      data.etapas[indiceEtapa].documentos.push({ nombre: file.name, url });
      await updateDoc(procesoRef, { etapas: data.etapas });

      return url; // Devuelve la URL del archivo subido
    } catch (error) {
      console.error('Error al subir el documento:', error);
      throw new Error('No se pudo subir el documento');
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
    const procesoRef = doc(this.firestore, `${this.collectionName}/${procesoId}`);
    const procesoSnap = getDoc(procesoRef);

    if (!(await procesoSnap).exists()) {
      throw new Error('El proceso no existe');
    }

    const data = (await procesoSnap).data() as Proceso;
    if (!data.etapas || !data.etapas[indiceEtapa]) {
      throw new Error('La etapa no existe');
    }

    return data.etapas[indiceEtapa].documentos;
  }
}