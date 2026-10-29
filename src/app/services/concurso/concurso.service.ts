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
  updateDoc,
  writeBatch
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ImageCompressionService } from '../image-compression/image-compression.service';
import {
  COLECCION_ESTADO,
  COLECCION_JURADOS,
  COLECCION_PARTICIPANTES,
  DOC_ESTADO,
  Jurado,
  MAX_BYTES_FOTO,
  Participante,
  claveCorreo,
  esCorreoValido,
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

  // Un solo voto por correo: el voto se guarda en el documento del jurado y
  // las reglas no dejan cambiarlo una vez puesto.
  async votar(correo: string, participanteId: string, mensaje: string): Promise<void> {
    if (!esCorreoValido(correo)) throw new Error('Escribe un correo válido.');
    const error = validarVoto(participanteId, mensaje);
    if (error) throw new Error(error);

    try {
      await updateDoc(doc(this.firestore, `${COLECCION_JURADOS}/${claveCorreo(correo)}`), {
        voto: { participanteId, mensaje: mensaje.trim(), fecha: serverTimestamp() }
      });
    } catch (e: any) {
      if (e?.code === 'permission-denied' || e?.code === 'not-found') {
        throw new Error('No pudimos registrar tu voto. Revisa que sea el correo con el que te registraron como jurado, que no hayas votado antes y que la votación esté abierta.');
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

  jurados$(): Observable<Jurado[]> {
    const ref = query(collection(this.firestore, COLECCION_JURADOS), orderBy('correo'));
    return collectionData(ref) as Observable<Jurado[]>;
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

  async agregarJurado(correo: string): Promise<void> {
    if (!esCorreoValido(correo)) throw new Error('Escribe un correo válido.');
    const ref = doc(this.firestore, `${COLECCION_JURADOS}/${claveCorreo(correo)}`);
    // setDoc pisaría el voto de un jurado que ya votó: primero se mira si existe.
    if ((await getDoc(ref)).exists()) throw new Error('Ese correo ya está en la lista de jurados.');
    await setDoc(ref, { correo: claveCorreo(correo), voto: null, creado: serverTimestamp() });
  }

  async quitarJurado(correo: string): Promise<void> {
    const lote = writeBatch(this.firestore);
    lote.delete(doc(this.firestore, `${COLECCION_JURADOS}/${claveCorreo(correo)}`));
    await lote.commit();
  }

  // Limpia el concurso completo (participantes, jurados con sus votos y el estado).
  async borrarTodo(): Promise<void> {
    const lote = writeBatch(this.firestore);
    for (const coleccion of [COLECCION_PARTICIPANTES, COLECCION_JURADOS, COLECCION_ESTADO]) {
      const snap = await getDocs(collection(this.firestore, coleccion));
      snap.docs.forEach(d => lote.delete(d.ref));
    }
    await lote.commit();
  }

  // La foto viaja dentro del documento (como texto): se achica antes para que
  // no pese demasiado en cada lectura del jurado.
  private async fotoComoTexto(archivo: File): Promise<string> {
    if (!archivo.type.startsWith('image/')) throw new Error('El archivo tiene que ser una imagen.');
    const comprimida = await this.imageCompression.compressImage(archivo, 700, 0.7);
    if (comprimida.size > MAX_BYTES_FOTO) throw new Error('La foto pesa demasiado: elige una más pequeña.');

    return new Promise<string>((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result));
      lector.onerror = () => reject(new Error('No se pudo leer la foto.'));
      lector.readAsDataURL(comprimida);
    });
  }
}
