import { Injectable } from '@angular/core';
import { 
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
  deleteUser,
  authState,
  setPersistence, 
  browserSessionPersistence, 
  browserLocalPersistence,
  sendEmailVerification,
  sendPasswordResetEmail
} from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { getFunctions, httpsCallable } from '@angular/fire/functions';

export interface LoginInfo {
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  // Observable para el estado de autenticación
  user$: Observable<User | null>;

  constructor(private auth: Auth) {
    this.user$ = authState(this.auth);
  }

  // Métodos de registro y autenticación
  register({email, password}: LoginInfo): Promise<any> {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  login({email, password}: LoginInfo): Promise<any> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  loginWithGoogle(): Promise<any> {
    return signInWithPopup(this.auth, new GoogleAuthProvider());
  }    

  logout(): Promise<void> { 
    return signOut(this.auth);
  }

  // Gestión de persistencia
  setSessionPersistence(): Promise<void> {
    return setPersistence(this.auth, browserSessionPersistence);
  }

  setLocalPersistence(): Promise<void> {
    return setPersistence(this.auth, browserLocalPersistence);
  }

  // Información de usuario
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  async getIdToken(): Promise<string | null> {
    const user = this.auth.currentUser;
    if (user) {
      return user.getIdToken();
    }
    return null;
  }

  // Verificación de email
  sendVerificationEmail(): Promise<void> {
    const user = this.auth.currentUser;
    if (user) {
      return sendEmailVerification(user);
    }
    return Promise.reject('No hay usuario autenticado');
  }

  isEmailVerified(): boolean {
    return this.auth.currentUser?.emailVerified || false;
  }

  // Restablecimiento de contraseña
  resetPassword(email: string): Promise<void> {
    return sendPasswordResetEmail(this.auth, email);
  }

  // Eliminación de usuarios. isCallerAdmin lo decide el llamador
  // (RegistersService, a partir de Register.role — la fuente de verdad
  // real de roles) en vez de leerlo acá de una colección propia.
  async deleteRegister(uid: string, isCallerAdmin: boolean): Promise<any> {
    const currentUser = this.auth.currentUser;

    // Solo permite eliminar si es el mismo usuario o es un admin
    if (currentUser?.uid === uid || isCallerAdmin) {
      if (currentUser?.uid === uid) {
        // Si es el propio usuario
        return deleteUser(currentUser);
      } else {
        // Si es admin eliminando a otro usuario, utiliza una Cloud Function
        // Esta función debe estar implementada en Firebase Functions
        const functions = getFunctions();
        const deleteUserFunc = httpsCallable(functions, 'deleteUser');
        await deleteUserFunc({ uid });
        return Promise.resolve();
      }
    }

    return Promise.reject('No autorizado para eliminar este usuario');
  }
}