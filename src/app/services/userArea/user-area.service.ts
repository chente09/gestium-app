import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, collection, collectionData, updateDoc } from '@angular/fire/firestore';
import { UsersService } from '../users/users.service';
import { Observable, from } from 'rxjs';

export interface UserArea {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  areaAsignada: string; // ✅ Área específica del usuario
  role: 'admin' | 'coordinador' | 'empleado';
  fechaAsignacion: Date;
  activo: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserAreaService {
  private collectionName = 'users_areas';

  constructor(
    private firestore: Firestore,
    private usersService: UsersService
  ) {}

  // 📝 Crear/Actualizar usuario con área
  async assignUserToArea(userId: string, area: string, role: 'admin' | 'coordinador' | 'empleado' = 'empleado'): Promise<void> {
    const user = this.usersService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const userAreaData: UserArea = {
      uid: userId,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      areaAsignada: area,
      role,
      fechaAsignacion: new Date(),
      activo: true
    };

    const docRef = doc(this.firestore, `${this.collectionName}/${userId}`);
    await setDoc(docRef, userAreaData, { merge: true });
  }

  // 🔍 Obtener área del usuario actual
  async getCurrentUserArea(): Promise<string | null> {
    const user = this.usersService.getCurrentUser();
    if (!user) return null;

    try {
      const docRef = doc(this.firestore, `${this.collectionName}/${user.uid}`);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const userData = docSnap.data() as UserArea;
        return userData.areaAsignada;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener área del usuario:', error);
      return null;
    }
  }

  // 👥 Obtener todos los usuarios de un área específica
  getUsersByArea(area: string): Observable<UserArea[]> {
    const usersRef = collection(this.firestore, this.collectionName);
    return collectionData(usersRef, { idField: 'uid' }) as Observable<UserArea[]>;
  }

  // 📊 Obtener información completa del usuario
  async getUserAreaInfo(userId: string): Promise<UserArea | null> {
    try {
      const docRef = doc(this.firestore, `${this.collectionName}/${userId}`);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as UserArea;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener información del usuario:', error);
      return null;
    }
  }

  // ✏️ Actualizar área de usuario
  async updateUserArea(userId: string, newArea: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, `${this.collectionName}/${userId}`);
      await updateDoc(docRef, { 
        areaAsignada: newArea,
        fechaAsignacion: new Date()
      });
    } catch (error) {
      console.error('Error al actualizar área del usuario:', error);
      throw error;
    }
  }

  // 🔒 Verificar si usuario tiene acceso a área específica
  async hasAccessToArea(area: string): Promise<boolean> {
    const userArea = await this.getCurrentUserArea();
    return userArea === area || userArea === 'admin'; // Admin tiene acceso a todas las áreas
  }

  // 📋 Obtener todos los usuarios para administración
  getAllUsersAreas(): Observable<UserArea[]> {
    const usersRef = collection(this.firestore, this.collectionName);
    return collectionData(usersRef, { idField: 'uid' }) as Observable<UserArea[]>;
  }

  // 🔄 Activar/Desactivar usuario
  async toggleUserStatus(userId: string, activo: boolean): Promise<void> {
    try {
      const docRef = doc(this.firestore, `${this.collectionName}/${userId}`);
      await updateDoc(docRef, { activo });
    } catch (error) {
      console.error('Error al cambiar estado del usuario:', error);
      throw error;
    }
  }

  // 🎯 Método de utilidad para inicializar usuario si no existe
  async initializeUserIfNotExists(): Promise<void> {
    const user = this.usersService.getCurrentUser();
    if (!user) return;

    const userInfo = await this.getUserAreaInfo(user.uid);
    if (!userInfo) {
      // Usuario nuevo, asignar área por defecto o requerir asignación
      await this.assignUserToArea(user.uid, 'sin_asignar', 'empleado');
    }
  }
}