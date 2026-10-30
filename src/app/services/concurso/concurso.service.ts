import { Injectable } from '@angular/core';
import {
  Firestore,
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

import {
  COLECCION_ESTADO,
  COLECCION_FOTOS,
  COLECCION_PARTICIPANTES,
  COLECCION_VOTOS,
  DOC_ESTADO,
  LADO_COMPLETA,
  LADO_MINIATURA,
  MAX_CHARS_COMPLETA,
  MAX_CHARS_MINIATURA,
  Participante,
  Voto,
  claveNombre,
  escalar,
  validarVoto
} from './concurso.util';

// Concurso de disfraces. Lo de la votación (leer participantes, votar) se usa
// SIN sesión desde la página pública del jurado; lo demás es solo del admin y
// lo exigen las reglas de Firestore, no esta clase.
@Injectable({
  providedIn: 'root'
})
export class ConcursoService {
  // Las fotos completas ya leídas: abrir la misma foto otra vez no vuelve a la base.
  private fotosCompletas = new Map<string, string>();

  constructor(private firestore: Firestore) { }

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

  // La foto en alta calidad, que se lee solo al ampliarla. Los participantes
  // creados antes de que existiera no la tienen: se usa la miniatura.
  async fotoCompleta(participante: Participante): Promise<string> {
    const id = participante.id;
    if (!id) return participante.foto;
    const guardada = this.fotosCompletas.get(id);
    if (guardada) return guardada;

    try {
      const snap = await getDoc(doc(this.firestore, `${COLECCION_FOTOS}/${id}`));
      const foto = snap.exists() ? String(snap.data()['foto']) : participante.foto;
      this.fotosCompletas.set(id, foto);
      return foto;
    } catch (e) {
      console.error('Error leyendo la foto completa:', e);
      return participante.foto;
    }
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

    const { miniatura, completa } = await this.prepararFotos(datos.foto);
    // Los dos documentos se crean juntos: nunca queda un participante sin su foto completa.
    const participante = doc(collection(this.firestore, COLECCION_PARTICIPANTES));
    const lote = writeBatch(this.firestore);
    lote.set(participante, { nombre, mensaje, foto: miniatura, orden: Date.now(), creado: serverTimestamp() });
    lote.set(doc(this.firestore, `${COLECCION_FOTOS}/${participante.id}`), { foto: completa });
    await lote.commit();
  }

  async eliminarParticipante(id: string): Promise<void> {
    const lote = writeBatch(this.firestore);
    lote.delete(doc(this.firestore, `${COLECCION_PARTICIPANTES}/${id}`));
    lote.delete(doc(this.firestore, `${COLECCION_FOTOS}/${id}`));
    await lote.commit();
    this.fotosCompletas.delete(id);
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
    for (const coleccion of [COLECCION_PARTICIPANTES, COLECCION_FOTOS, COLECCION_VOTOS, COLECCION_ESTADO]) {
      const snap = await getDocs(collection(this.firestore, coleccion));
      snap.docs.forEach(d => lote.delete(d.ref));
    }
    await lote.commit();
    this.fotosCompletas.clear();
  }

  // ============================================
  // 🖼️ Fotos
  // ============================================
  // Miniatura para las tarjetas y completa para ampliar. La completa se guarda
  // con la mejor calidad que quepa en un documento de Firestore: se prueba de
  // la mayor calidad y tamaño a la menor, y se usa la primera que entra.
  private async prepararFotos(archivo: File): Promise<{ miniatura: string; completa: string }> {
    const imagen = await this.cargarImagen(archivo);
    return {
      miniatura: this.reducir(imagen, LADO_MINIATURA, [0.82, 0.72], MAX_CHARS_MINIATURA),
      completa: this.reducir(imagen, LADO_COMPLETA, [0.92, 0.86, 0.8, 0.72], MAX_CHARS_COMPLETA)
    };
  }

  private cargarImagen(archivo: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(archivo);
      const imagen = new Image();
      imagen.onload = () => { URL.revokeObjectURL(url); resolve(imagen); };
      imagen.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo leer la foto. Usa una imagen JPG, PNG o WebP.'));
      };
      imagen.src = url;
    });
  }

  private reducir(imagen: HTMLImageElement, ladoMax: number, calidades: number[], maxChars: number): string {
    // Si ni a la menor calidad entra, se prueba con la foto un poco más chica.
    for (const lado of [ladoMax, Math.round(ladoMax * 0.85), Math.round(ladoMax * 0.7)]) {
      const { ancho, alto } = escalar(imagen.naturalWidth, imagen.naturalHeight, lado);
      const lienzo = document.createElement('canvas');
      lienzo.width = ancho;
      lienzo.height = alto;
      const ctx = lienzo.getContext('2d');
      if (!ctx) throw new Error('No se pudo procesar la foto.');
      // Fondo blanco: un PNG con transparencia saldría negro en JPEG.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, ancho, alto);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imagen, 0, 0, ancho, alto);

      for (const calidad of calidades) {
        const texto = lienzo.toDataURL('image/jpeg', calidad);
        if (texto.length <= maxChars) return texto;
      }
    }
    throw new Error('La foto pesa demasiado incluso reducida. Elige otra.');
  }
}
