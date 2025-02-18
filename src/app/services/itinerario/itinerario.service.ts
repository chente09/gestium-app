import { Injectable } from '@angular/core';
import { Firestore, addDoc, collection, collectionData, doc, deleteDoc, updateDoc, getDoc, runTransaction } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { Observable } from 'rxjs';

// Interfaz para los datos del itinerario
export interface Itinerario {
  id: string;
  juzgado: string;
  piso: string;
  tramite: string;
  solicita: string;
  fechaSolicitud: string; // Formato: YYYY-MM-DD
  fechaTermino: string;
  estado: boolean;
  observaciones?: string;
  imagen?: string; // URL de la imagen en Firebase Storage
  pdf?: string;    // URL del PDF en Firebase Storage
  area: string;
  fechaCompletado?: string;
  horaCompletado?: string;
  obsCompletado?: string;
  imgcompletado?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ItinerarioService {
  
  private collectionName = 'itinerarios';

  constructor(private firestore: Firestore, private storage: Storage) { }

  // Método para subir un archivo a Firebase Storage
  async uploadFile(file: File, type: 'imagen' | 'pdf'): Promise<string> {
    const filePath = `${this.collectionName}/${type}/${file.name}`;
    const fileRef = ref(this.storage, filePath);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  }

  // Método para guardar un itinerario en Firestore
  async saveItinerario(itinerarioData: Itinerario): Promise<void> {
    const itinerariosRef = collection(this.firestore, this.collectionName);
    try {
      await addDoc(itinerariosRef, itinerarioData);
      console.log('Itinerario guardado correctamente en Firestore:', itinerarioData);
    } catch (error) {
      console.error('Error al guardar itinerario en Firestore:', error);
      throw error;
    }
  }

  // Método para obtener todos los itinerarios almacenados en Firestore
  getItinerarios(): Observable<Itinerario[]> {
    const itinerariosRef = collection(this.firestore, this.collectionName);
    return collectionData(itinerariosRef, { idField: 'id' }) as Observable<Itinerario[]>;
  }

  // Método para obtener un itinerario por su ID
  async getItinerarioById(itinerarioId: string): Promise<Itinerario | undefined> {
    const itinerarioDocRef = doc(this.firestore, `${this.collectionName}/${itinerarioId}`);
    const docSnap = await getDoc(itinerarioDocRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Itinerario : undefined;
  }

  // Método para actualizar un itinerario en Firestore
  async updateItinerario(itinerarioId: string, updatedData: Partial<Itinerario>) {
    const itinerarioDocRef = doc(this.firestore, `${this.collectionName}/${itinerarioId}`);
  
    await runTransaction(this.firestore, async (transaction) => {
      const docSnap = await transaction.get(itinerarioDocRef);
      
      if (!docSnap.exists()) {
        throw new Error('El itinerario no existe');
      }
      
      transaction.update(itinerarioDocRef, updatedData);
    });
  }

  async addItinerario(itinerarioData: Itinerario, imageFile?: File, pdfFile?: File): Promise<void> {
    const itinerariosRef = collection(this.firestore, this.collectionName);
  
    try {
      // Subir imagen si se proporciona
      if (imageFile) {
        const imageUrl = await this.uploadFile(imageFile, 'imagen');
        itinerarioData.imagen = imageUrl;
      }
  
      // Subir PDF si se proporciona
      if (pdfFile) {
        const pdfUrl = await this.uploadFile(pdfFile, 'pdf');
        itinerarioData.pdf = pdfUrl;
      }
  
      // Guardar en Firestore
      await addDoc(itinerariosRef, itinerarioData);
      console.log('Itinerario guardado correctamente en Firestore:', itinerarioData);
    } catch (error) {
      console.error('Error al guardar itinerario en Firestore:', error);
      throw error;
    }
  }
  

  // Método para eliminar un itinerario de Firestore
  async deleteItinerario(itinerarioId: string): Promise<void> {
    const itinerarioDocRef = doc(this.firestore, `${this.collectionName}/${itinerarioId}`);
    await deleteDoc(itinerarioDocRef);
  }
}
