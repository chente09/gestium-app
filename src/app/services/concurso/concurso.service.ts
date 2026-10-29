import { Injectable } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  doc,
  docData,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ImageCompressionService } from '../image-compression/image-compression.service';
import {
  COLECCION_ESTADO,
  COLECCION_PARTICIPANTES,
  COLECCION_VOTOS,
  DOC_ESTADO,
  MAX_BYTES_FOTO,
  Participante,
  Voto,
  claveNombre,
  validarVoto
} from './concurso.util';

// Concurso de disfraces. Lo de la votación (leer participantes, votar) se usa
// SIN sesión desde la página pública del jurado; lo demás es solo del admin y
// lo exigen las reglas de Firestore, no esta clase.
@Injectable({
  providedIn: 'root'
})
export class ConcursoService {
  constructor(
    private firestore: Firestore,
    private imageCompression: ImageCompressionService
  ) { }

  // ============================================
  // 🗳️ Página del jurado (sin sesión)
  // ============================================
  async getParticipantes(): Promise<Participante[]> {
    const snap = await getDocs(query(collection(this.firestore, COLECCION_PARTICIPANTES), orderBy('orden')));
    return snap.docs.map(d => ({ ...(d.data() as Participante), id: d.id }));
  }

  async votacionAbierta(): Promise<boolean> {
    const snap = await getDoc(doc(this.firestore, `${COLECCION_ESTADO}/${DOC_ESTADO}`));
    return snap.exists() && snap.data()['abierta'] === true;
  }

  // Un voto por nombre: la clave del documento sale del nombre, y las reglas
  // solo dejan crearlo (un segundo voto con el mismo nombre se rechaza).
  async votar(nombre: string, participanteId: string, razon: string): Promise<void> {
    const error = validarVoto({ nombre, participanteId, razon });
    if (error) throw new Error(error);

    try {
      await setDoc(doc(this.firestore, `${COLECCION_VOTOS}/${claveNombre(nombre)}`), {
        nombre: nombre.trim().replace(/\s+/g, ' '),
        participanteId,
        razon: razon.trim(),
        fecha: serverTimestamp()
      });
    } catch (e: any) {
      if (e?.code === 'permission-denied') {
        throw new Error('No pudimos registrar tu voto. Puede que ya hayas votado con ese nombre o que la votación no esté abierta.');
      }
      throw e;
    }
  }

  // ============================================
  // 🛠️ Panel del admin
  // ============================================
  participantes$(): Observable<Participante[]> {
    const ref = query(collection(this.firestore, COLECCION_PARTICIPANTES), orderBy('orden'));
    return collectionData(ref, { idField: 'id' }) as Observable<Participante[]>;
  }

  // Cada voto lleva su id (la clave del nombre) para poder quitarlo.
  votos$(): Observable<(Voto & { id: string })[]> {
    const ref = query(collection(this.firestore, COLECCION_VOTOS), orderBy('fecha'));
    return collectionData(ref, { idField: 'id' }) as Observable<(Voto & { id: string })[]>;
  }

  votacionAbierta$(): Observable<boolean> {
    return (docData(doc(this.firestore, `${COLECCION_ESTADO}/${DOC_ESTADO}`)) as Observable<{ abierta?: boolean } | undefined>)
      .pipe(map(estado => estado?.abierta === true));
  }

  async cambiarVotacion(abierta: boolean): Promise<void> {
    await setDoc(doc(this.firestore, `${COLECCION_ESTADO}/${DOC_ESTADO}`), { abierta, actualizado: serverTimestamp() }, { merge: true });
  }

  async agregarParticipante(datos: { nombre: string; mensaje: string; foto: File | null }): Promise<void> {
    const nombre = datos.nombre.trim();
    const mensaje = datos.mensaje.trim();
    if (!nombre) throw new Error('Escribe el nombre del participante.');
    if (!mensaje) throw new Error('Escribe el mensaje que acompaña al participante.');
    if (!datos.foto) throw new Error('Elige la foto del participante.');

    const foto = await this.fotoComoTexto(datos.foto);
    await addDoc(collection(this.firestore, COLECCION_PARTICIPANTES), {
      nombre, mensaje, foto, orden: Date.now(), creado: serverTimestamp()
    });
  }

  async eliminarParticipante(id: string): Promise<void> {
    const lote = writeBatch(this.firestore);
    lote.delete(doc(this.firestore, `${COLECCION_PARTICIPANTES}/${id}`));
    await lote.commit();
  }

  // Si un jurado se equivocó, se quita su voto y puede votar de nuevo.
  async quitarVoto(id: string): Promise<void> {
    const lote = writeBatch(this.firestore);
    lote.delete(doc(this.firestore, `${COLECCION_VOTOS}/${id}`));
    await lote.commit();
  }

  // Limpia el concurso completo (participantes, votos y el estado).
  async borrarTodo(): Promise<void> {
    const lote = writeBatch(this.firestore);
    for (const coleccion of [COLECCION_PARTICIPANTES, COLECCION_VOTOS, COLECCION_ESTADO]) {
      const snap = await getDocs(collection(this.firestore, coleccion));
      snap.docs.forEach(d => lote.delete(d.ref));
    }
    await lote.commit();
  }

  // La foto viaja dentro del documento (como texto): se achica antes para que
  // no pese demasiado en cada lectura del jurado.
  private async fotoComoTexto(archivo: File): Promise<string> {
    if (!archivo.type.startsWith('image/')) throw new Error('El archivo tiene que ser una imagen.');
    const comprimida = await this.imageCompression.compressImage(archivo, 900, 0.72);
    if (comprimida.size > MAX_BYTES_FOTO) throw new Error('La foto pesa demasiado: elige una más pequeña.');

    return new Promise<string>((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result));
      lector.onerror = () => reject(new Error('No se pudo leer la foto.'));
      lector.readAsDataURL(comprimida);
    });
  }
}
