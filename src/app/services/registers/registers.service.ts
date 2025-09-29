import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  setDoc,
  getDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { UsersService, LoginInfo } from '../users/users.service';
import { UserCredential } from '@angular/fire/auth';

// ✅ Interface unificada con roles y áreas
export interface Register {
  uid: string;
  email: string;
  displayName: string; // Renombrado de "nickname" para mayor claridad
  photoURL?: string;
  phoneNumber?: string;
  role: 'admin' | 'coordinador' | 'empleado';
  areaAsignada: string; // Nombre del área o 'sin_asignar'
  fechaCreacion: Date;
  fechaAsignacion?: Date; // Fecha cuando se asignó área/rol específico
  activo: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RegistersService {
  currentRegister?: Register;
  private collectionName = 'registers';

  constructor(
    private firestore: Firestore,
    private usersService: UsersService
  ) { }

  // 🔐 Login con email/password
  async login(loginInfo: LoginInfo): Promise<Register | null> {
    try {
      const userCredential: UserCredential = await this.usersService.login(loginInfo);
      const uid = userCredential.user.uid;

      const register = await this.getRegisterByUid(uid);
      if (register) {
        this.currentRegister = register;
        return register;
      }

      return null;
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  }

  // 🔐 Login con Google
  async loginWithGoogle(): Promise<Register | null> {
    try {
      const userCredential: UserCredential = await this.usersService.loginWithGoogle();
      const uid = userCredential.user.uid;

      // Validar dominio @gestium
      const email = userCredential.user.email || '';
      if (!email.includes('gestium')) {
        await this.usersService.logout();
        throw new Error('Solo correos con dominio @gestium pueden acceder');
      }

      // Verificar si existe, si no existe lo crea automáticamente
      let register = await this.getRegisterByUid(uid);

      if (!register) {
        // Auto-registro para nuevos usuarios de Google
        register = await this.createRegisterFromFirebaseUser(userCredential.user);
      }

      // ⚠️ CRÍTICO: Asignar a currentRegister ANTES de retornar
      this.currentRegister = register;
      console.log('✅ currentRegister asignado:', this.currentRegister);

      return register;

    } catch (error) {
      console.error('Error en login con Google:', error);
      throw error;
    }
  }

  // 🚪 Logout
  async logout(): Promise<void> {
    try {
      await this.usersService.logout();
      this.currentRegister = undefined;
      console.log('Sesión cerrada exitosamente');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  }

  // 📋 Obtener todos los registros
  getRegisters(): Observable<Register[]> {
    const registersRef = collection(this.firestore, this.collectionName);
    return collectionData(registersRef, { idField: 'uid' }) as Observable<Register[]>;
  }

  // 🔍 Obtener registro por UID (método mejorado)
  async getRegisterByUid(uid: string): Promise<Register | null> {
    try {
      const docRef = doc(this.firestore, `${this.collectionName}/${uid}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as Register;
      }

      return null;
    } catch (error) {
      console.error('Error obteniendo registro:', error);
      return null;
    }
  }

  // 📝 Crear registro manual (email/password)
  async createRegister(
    loginInfo: LoginInfo,
    userInfo: Partial<Omit<Register, 'uid' | 'fechaCreacion' | 'activo'>>
  ): Promise<Register> {
    try {
      const userCredential: UserCredential = await this.usersService.register(loginInfo);
      const uid = userCredential.user.uid;

      // Crear registro con valores por defecto
      const newRegister: Register = {
        uid,
        email: loginInfo.email,
        displayName: userInfo.displayName || 'Usuario Nuevo',
        photoURL: userInfo.photoURL || '',
        phoneNumber: userInfo.phoneNumber || '',
        role: 'empleado', // Por defecto
        areaAsignada: 'sin_asignar', // Por defecto
        fechaCreacion: new Date(),
        activo: true
      };

      const docRef = doc(this.firestore, `${this.collectionName}/${uid}`);
      await setDoc(docRef, newRegister);

      this.currentRegister = newRegister;
      console.log('✅ Usuario registrado:', newRegister);

      return newRegister;

    } catch (error) {
      console.error('❌ Error creando registro:', error);
      throw error;
    }
  }

  // 🆕 Auto-registro desde Firebase Auth (para Google Sign-In)
  private async createRegisterFromFirebaseUser(firebaseUser: any): Promise<Register> {
    try {
      const newRegister: Register = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || 'Usuario Gestium',
        photoURL: firebaseUser.photoURL || '',
        phoneNumber: firebaseUser.phoneNumber || '',
        role: 'empleado', // Por defecto
        areaAsignada: 'sin_asignar', // Por defecto
        fechaCreacion: new Date(),
        activo: true
      };

      const docRef = doc(this.firestore, `${this.collectionName}/${firebaseUser.uid}`);
      await setDoc(docRef, newRegister);

      console.log('✅ Usuario auto-registrado desde Google:', newRegister);

      return newRegister;

    } catch (error) {
      console.error('❌ Error en auto-registro:', error);
      throw error;
    }
  }

  // ✏️ Actualizar registro completo
  async updateRegister(register: Partial<Register> & { uid: string }): Promise<void> {
    try {
      const docRef = doc(this.firestore, `${this.collectionName}/${register.uid}`);

      // Si se está asignando área/rol, actualizar fecha
      if (register.role || register.areaAsignada) {
        register.fechaAsignacion = new Date();
      }

      await updateDoc(docRef, { ...register });
      console.log('✅ Registro actualizado:', register.uid);

    } catch (error) {
      console.error('❌ Error actualizando registro:', error);
      throw error;
    }
  }

  // 🎯 Asignar área y rol (método específico para admin)
  async assignAreaAndRole(
    uid: string,
    areaAsignada: string,
    role: 'admin' | 'coordinador' | 'empleado'
  ): Promise<void> {
    try {
      const docRef = doc(this.firestore, `${this.collectionName}/${uid}`);

      await updateDoc(docRef, {
        areaAsignada,
        role,
        fechaAsignacion: new Date()
      });

      console.log(`✅ Área "${areaAsignada}" y rol "${role}" asignados a ${uid}`);

    } catch (error) {
      console.error('❌ Error asignando área/rol:', error);
      throw error;
    }
  }

  // 🔄 Cambiar estado activo/inactivo
  async toggleUserStatus(uid: string, activo: boolean): Promise<void> {
    try {
      const docRef = doc(this.firestore, `${this.collectionName}/${uid}`);
      await updateDoc(docRef, { activo });

      console.log(`✅ Usuario ${uid} ${activo ? 'activado' : 'desactivado'}`);

    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      throw error;
    }
  }

  // 🗑️ Eliminar registro (y usuario de Auth)
  async deleteRegister(register: Register): Promise<void> {
    try {
      // Primero eliminar de Firebase Auth
      await this.usersService.deleteRegister(register.uid);

      // Luego eliminar de Firestore
      const docRef = doc(this.firestore, `${this.collectionName}/${register.uid}`);
      await deleteDoc(docRef);

      console.log('✅ Usuario eliminado completamente:', register.uid);

    } catch (error) {
      console.error('❌ Error eliminando registro:', error);
      throw error;
    }
  }

  // 🔍 Obtener usuarios por área
  async getUsersByArea(area: string): Promise<Register[]> {
    try {
      const registersRef = collection(this.firestore, this.collectionName);
      const q = query(registersRef, where('areaAsignada', '==', area));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => doc.data() as Register);

    } catch (error) {
      console.error('❌ Error obteniendo usuarios por área:', error);
      return [];
    }
  }

  // 🔍 Obtener usuarios por rol
  async getUsersByRole(role: 'admin' | 'coordinador' | 'empleado'): Promise<Register[]> {
    try {
      const registersRef = collection(this.firestore, this.collectionName);
      const q = query(registersRef, where('role', '==', role));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => doc.data() as Register);

    } catch (error) {
      console.error('❌ Error obteniendo usuarios por rol:', error);
      return [];
    }
  }

  // 👤 Obtener registro actual del usuario logueado
  getCurrentRegister(): Register | undefined {
    return this.currentRegister;
  }

  // 🔐 Verificar si usuario actual es admin
  isCurrentUserAdmin(): boolean {
    return this.currentRegister?.role === 'admin';
  }

  // 🔐 Verificar si usuario actual tiene acceso a un área
  canAccessArea(area: string): boolean {
    if (!this.currentRegister) return false;

    // Admins tienen acceso a todo
    if (this.currentRegister.role === 'admin') return true;

    // Usuarios solo acceden a su área asignada
    return this.currentRegister.areaAsignada === area;
  }
}