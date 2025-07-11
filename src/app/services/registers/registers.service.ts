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
  setDoc // ✅ AGREGAR SETDOC
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { UsersService, LoginInfo } from '../users/users.service';
import { UserCredential } from '@angular/fire/auth';

export interface Register {
  uid: string;
  email: string;
  nickname: string;
  photoURL: string;
  phoneNumber: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class RegistersService {
  currentRegister?: Register;

  constructor(private firestore: Firestore, private usersService: UsersService) { }

  async login(loginInfo: LoginInfo): Promise<any> {
    let userCredential: UserCredential = await this.usersService.login(loginInfo)
      .then((response) => {
        return response;
      })
      .catch(error => {
        console.log(error);
        return error;
      });
    const uid = userCredential.user.uid;
    this.getRegister(uid).then(query => {
      query.forEach(element => this.currentRegister = element.data() as Register);
    });
    return this.currentRegister;
  }

  async loginWithGoogle(): Promise<any> {
    let userCredential: UserCredential = await this.usersService.loginWithGoogle()
      .then((response) => {
        return response;
      })
      .catch(error => {
        console.log(error);
        return error;
      });
    const uid = userCredential.user.uid;
    this.getRegister(uid).then(query => {
      query.forEach(element => this.currentRegister = element.data() as Register);
    });

    return this.currentRegister;
  }

  async logout(): Promise<void> {
    try {
      await this.usersService.logout();
      this.currentRegister = undefined; // 🔹 Limpia la sesión local
      console.log("Sesión cerrada exitosamente");
    } catch (error) {
      console.log("Error al cerrar sesión:", error);
    }
  }

  getRegisters(): Observable<Register[]> {
    const registersRef = collection(this.firestore, 'registers');
    return collectionData(registersRef, { idField: 'uid' }) as Observable<Register[]>;
  }

  getRegister(uid: string) {
    const registersRef = collection(this.firestore, 'registers');
    const q = query(registersRef, where('uid', '==', uid));
    return getDocs(q);
  }

  async createRegister(loginInfo: LoginInfo, userInfo: Omit<Register, 'uid'>): Promise<any> {
    let userCredential: UserCredential = await this.usersService.register(loginInfo)
      .then(response => response)
      .catch(error => {
        console.log(error);
        throw error; // Propagar error correctamente
      });

    const uid = userCredential.user.uid;
    this.currentRegister = { ...userInfo, uid }; // Agregar el uid al objeto

    const registersRef = collection(this.firestore, 'registers');
    return addDoc(registersRef, this.currentRegister);
  }

  // ✅ NUEVO: Método para auto-registrar usuarios desde Firebase Auth
  async createRegisterFromFirebaseUser(uid: string, userInfo: Omit<Register, 'uid'>): Promise<void> {
    try {
      const newRegister: Register = { ...userInfo, uid };

      // Usar setDoc con el UID como ID del documento para evitar duplicados
      const docRef = doc(this.firestore, `registers/${uid}`);
      await setDoc(docRef, newRegister);

      // Actualizar el registro actual
      this.currentRegister = newRegister;

      console.log("✅ Usuario registrado en Firestore:", newRegister);

    } catch (error) {
      console.error("❌ Error creando registro desde Firebase User:", error);
      throw error;
    }
  }

  // ✅ NUEVO: Método para verificar y auto-registrar si es necesario
  async ensureUserIsRegistered(firebaseUser: any): Promise<Register> {
    try {
      // Verificar si ya existe
      const existingQuery = await this.getRegister(firebaseUser.uid);

      if (!existingQuery.empty) {
        // Usuario ya existe, retornar datos existentes
        const existingData = existingQuery.docs[0].data() as Register;
        this.currentRegister = existingData;
        return existingData;
      }

      // Usuario no existe, crear nuevo registro
      const userData = {
        email: firebaseUser.email,
        nickname: firebaseUser.displayName || 'Usuario Gestium',
        photoURL: firebaseUser.photoURL || '',
        phoneNumber: firebaseUser.phoneNumber || '',
        role: 'Empleado'
      };

      await this.createRegisterFromFirebaseUser(firebaseUser.uid, userData);
      return this.currentRegister!;

    } catch (error) {
      console.error("❌ Error asegurando registro de usuario:", error);
      throw error;
    }
  }

  async createRegisterWithGoogle(): Promise<any> {
    let userCredential: UserCredential = await this.usersService.loginWithGoogle()
      .then((response) => {
        return response;
      })
      .catch(error => {
        console.log(error);
        return error;
      });
    const uid = userCredential.user.uid;
    const email = userCredential.user.email!;
    const nickname = userCredential.user.displayName!;
    const photoURL = userCredential.user.photoURL!;
    const phoneNumber = userCredential.user.phoneNumber!;
    const role = 'Empleado';
    this.currentRegister = { email, uid, nickname, photoURL, phoneNumber, role };
    const registersRef = collection(this.firestore, 'registers');
    return addDoc(registersRef, { uid, email, nickname, photoURL, phoneNumber, role });
  }

  updateRegister({ uid, nickname, photoURL, phoneNumber, role }: Register): Promise<any> {
    const docRef = doc(this.firestore, `registers/${uid}`);
    return updateDoc(docRef, { uid, nickname, photoURL, phoneNumber, role });
  }

  async deleteRegister(register: Register): Promise<any> {
    await this.usersService.deleteRegister(register.uid);
    const docRef = doc(this.firestore, `registers/${register.uid}`);
    return deleteDoc(docRef);
  }
}