import { Injectable } from '@angular/core';
import { Firestore, addDoc, collection, collectionData, doc, deleteDoc, updateDoc, getDoc, runTransaction, setDoc } from '@angular/fire/firestore';
import { Storage, ref, uploadBytesResumable, getDownloadURL, deleteObject, uploadBytes } from '@angular/fire/storage';
import { map, Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

export interface Itinerario {
  id: string;
  juzgado: string;
  piso: string;
  tramite: string;
  solicita: string;
  fechaSolicitud: string;
  fechaTermino: string;
  estado: boolean;
  observaciones?: string;
  imagen?: string; //Guardar la URL de la imagen
  pdf?: string; //Guardar la URL del PDF
  area: string;
  fechaCompletado?: string;
  horaCompletado?: string;
  obsCompletado?: string;
  imgcompletado?: string; //Guardar la URL de la imagen
}

@Injectable({
  providedIn: 'root'
})
export class ItinerarioService {
  private collectionName = 'itinerarios';

  constructor(private firestore: Firestore, private storage: Storage) { }

  // 📌 Crear un nuevo itinerario con imagen y PDF opcionales
  async createItinerario(itinerario: Omit<Itinerario, 'id'>, imageFile?: File, pdfFile?: File, selectedImage2?: File): Promise<string> {
    const itinerarioRef = collection(this.firestore, this.collectionName);
    const id = uuidv4(); // Genera un ID único
  
    try {
      let imageUrl = '';
      let pdfUrl = '';
      let image2Url = '';
  
      // 📂 Subir imagen si existe y obtener URL
      if (imageFile) {
        const imagePath = `itinerarios/images/${id}.jpg`;
        const imageRef = ref(this.storage, imagePath);
        await uploadBytes(imageRef, imageFile);
        imageUrl = await getDownloadURL(imageRef); // 🔹 Obtener la URL completa
      }
  
      // 📂 Subir PDF si existe y obtener URL
      if (pdfFile) {
        const pdfPath = `itinerarios/pdfs/${id}.pdf`;
        const pdfRef = ref(this.storage, pdfPath);
        await uploadBytes(pdfRef, pdfFile);
        pdfUrl = await getDownloadURL(pdfRef); // 🔹 Obtener la URL completa
      }
  
      // 📂 Subir imagen 2 si existe y obtener URL
      if (selectedImage2) {
        const image2Path = `itinerarios/imagesComplete/${id}.jpg`;
        const image2Ref = ref(this.storage, image2Path);
        await uploadBytes(image2Ref, selectedImage2);
        image2Url = await getDownloadURL(image2Ref); // 🔹 Obtener la URL completa
      }
  
      // 📄 Guardar en Firestore con las URL de los archivos
      const newDoc = await addDoc(itinerarioRef, { 
        ...itinerario, 
        ...(imageUrl ? { imagen: imageUrl } : {}),
        ...(pdfUrl ? { pdf: pdfUrl } : {}),
        ...(image2Url ? { imgcompletado: image2Url } : {})
      });
  
      return newDoc.id;
    } catch (error: any) {
      throw new Error(`Error al crear el itinerario: ${error.message}`);
    }
  }
  

  // 📌 Obtener todos los itinerarios como Observable
  getItinerarios(): Observable<Itinerario[]> {
    const itinerariosRef = collection(this.firestore, this.collectionName);
    return collectionData(itinerariosRef, { idField: 'id' }).pipe(
      map((data: any[]) =>
        data.map(doc => ({
          id: doc.id,
          juzgado: doc.juzgado || '',
          piso: doc.piso || '',
          tramite: doc.tramite || '',
          solicita: doc.solicita || '',
          fechaSolicitud: doc.fechaSolicitud || '',
          fechaTermino: doc.fechaTermino || '',
          estado: doc.estado ?? false, // Si `estado` es boolean, usa `?? false`
          observaciones: doc.observaciones || '',
          imagen: doc.imagen || '',
          pdf: doc.pdf || '',
          area: doc.area || '',
          fechaCompletado: doc.fechaCompletado || '',
          horaCompletado: doc.horaCompletado || '',
          obsCompletado: doc.obsCompletado || '',
          imgcompletado: doc.imgcompletado || ''
        }))
      )
    ) as Observable<Itinerario[]>;
  }
  

  // 📌 Obtener un itinerario por ID
  async getItinerarioById(id: string): Promise<Itinerario | undefined> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id, ...docSnap.data() } as Itinerario;
    } else {
      throw new Error(`Itinerario con ID ${id} no encontrado.`);
    }
  }

  // 📌 Actualizar un itinerario con nuevas imágenes o PDFs opcionales
  async updateItinerario(id: string, itinerario: Partial<Itinerario>, newImageFile?: File, newPdfFile?: File): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);

    try {
      let updatedData: Partial<Itinerario> = { ...itinerario };

      // 📂 Subir nueva imagen si se proporciona
      if (newImageFile) {
        const imagePath = `itinerarios/images/${id}.jpg`;
        const imageRef = ref(this.storage, imagePath);

        // 🗑️ Eliminar imagen anterior si existe
        if (itinerario.imagen) {
          const oldImageRef = ref(this.storage, itinerario.imagen);
          await deleteObject(oldImageRef).catch(() => console.warn('No se pudo eliminar la imagen anterior.'));
        }

        await uploadBytes(imageRef, newImageFile);
        updatedData.imagen = imagePath;
      }

      // 📂 Subir nuevo PDF si se proporciona
      if (newPdfFile) {
        const pdfPath = `itinerarios/pdfs/${id}.pdf`;
        const pdfRef = ref(this.storage, pdfPath);

        // 🗑️ Eliminar PDF anterior si existe
        if (itinerario.pdf) {
          const oldPdfRef = ref(this.storage, itinerario.pdf);
          await deleteObject(oldPdfRef).catch(() => console.warn('No se pudo eliminar el PDF anterior.'));
        }

        await uploadBytes(pdfRef, newPdfFile);
        updatedData.pdf = pdfPath;
      }

      // 📄 Actualizar en Firestore
      await updateDoc(docRef, updatedData);
    } catch (error: any) {
      throw new Error(`Error al actualizar el itinerario ${id}: ${error.message}`);
    }
  }

  // 📌 Eliminar un itinerario y sus archivos asociados
  async deleteItinerario(id: string): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);

    try {
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error(`El itinerario con ID ${id} no existe.`);
      }

      const itinerarioData = docSnap.data() as Itinerario;

      // 🗑️ Eliminar imagen si existe
      if (itinerarioData.imagen) {
        const imageRef = ref(this.storage, itinerarioData.imagen);
        await deleteObject(imageRef).catch(() => console.warn('No se pudo eliminar la imagen.'));
      }

      // 🗑️ Eliminar PDF si existe
      if (itinerarioData.pdf) {
        const pdfRef = ref(this.storage, itinerarioData.pdf);
        await deleteObject(pdfRef).catch(() => console.warn('No se pudo eliminar el PDF.'));
      }

      // 🗑️ Eliminar documento en Firestore
      await deleteDoc(docRef);
    } catch (error: any) {
      throw new Error(`Error al eliminar el itinerario ${id}: ${error.message}`);
    }
  }


}
