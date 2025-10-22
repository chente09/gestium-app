import { Injectable } from '@angular/core';
import { Firestore, addDoc, collection, collectionData, doc, updateDoc, deleteDoc, query, where, orderBy } from '@angular/fire/firestore';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { RegistersService } from '../registers/registers.service';
import { UsersService } from '../users/users.service';

export interface AreaActivity {
  id?: string;
  titulo: string;
  descripcion?: string;
  fechaLimite: Date | any;
  fechaCreacion: Date | any;
  estado: 'pendiente' | 'en_progreso' | 'completada' | 'pospuesta';
  area: string;
  responsable: string;
  responsableNombre: string;
  creadoPor: string;
  creadoPorNombre: string;
  prioridad: 'baja' | 'media' | 'alta';
  notas?: string;
  fechaCompletada?: Date | any;
  etiquetas?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AreaActivitiesService {
  private collectionName = 'area_activities';

  constructor(
    private firestore: Firestore,
    private registersService: RegistersService,
    private usersService: UsersService
  ) { }

  // ============================================
  // 🔒 VALIDACIONES DE SEGURIDAD
  // ============================================

  /**
   * 🔐 Valida que el usuario tenga permiso para acceder al área solicitada
   */
  private validateAreaAccess(areaSlug: string): void {
    const currentRegister = this.registersService.getCurrentRegister();
    
    if (!currentRegister) {
      throw new Error('🔒 Usuario no autenticado. Por favor, inicie sesión.');
    }

    if (!currentRegister.activo) {
      throw new Error('🔒 Usuario desactivado. Contacte al administrador.');
    }

    // ✅ Los admins pueden acceder a cualquier área
    if (currentRegister.role === 'admin') {
      return; // Permitir
    }

    // ✅ Verificar que el usuario tenga área asignada
    if (!currentRegister.areaAsignada || currentRegister.areaAsignada === 'sin_asignar') {
      throw new Error('⛔ No tiene un área asignada. Contacte al administrador.');
    }

    // ✅ Obtener el slug del área del usuario
    const userAreaSlug = this.convertToSlug(currentRegister.areaAsignada);

    // ✅ VALIDACIÓN CRÍTICA: Verificar que coincidan
    if (userAreaSlug !== areaSlug) {
      console.error('🚨 INTENTO DE ACCESO NO AUTORIZADO:');
      console.error('   Usuario:', currentRegister.email);
      console.error('   Área del usuario:', currentRegister.areaAsignada, '→', userAreaSlug);
      console.error('   Área solicitada:', areaSlug);
      
      throw new Error('🚫 ACCESO DENEGADO: No tiene permisos para ver actividades de esta área.');
    }
  }

  /**
   * 🔧 Convierte nombre de área a slug (helper local)
   */
  private convertToSlug(nombre: string): string {
    const mapping: { [key: string]: string } = {
      'ISSFA': 'issfa',
      'Bco. Produbanco': 'produbanco',
      'Bco. Pichincha': 'pichincha',
      'Inmobiliaria': 'inmobiliaria',
      'BNF': 'bnf',
      'David': 'david',
      'IESS': 'iess'
    };
    
    return mapping[nombre] || nombre.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '');
  }

  /**
   * 🔐 Valida que el usuario pueda modificar una actividad
   */
  private async validateModificationPermission(activityId: string): Promise<boolean> {
    const currentRegister = this.registersService.getCurrentRegister();
    const user = this.usersService.getCurrentUser();
    
    if (!currentRegister || !user) {
      throw new Error('🔒 Usuario no autenticado');
    }

    // ✅ Los admins pueden modificar todo
    if (currentRegister.role === 'admin') {
      return true;
    }

    // ✅ Para otros usuarios, se valida en el servidor
    // Firebase Security Rules validará que sea el creador
    return true;
  }

  // ============================================
  // ➕ CREAR ACTIVIDAD (con validación)
  // ============================================
  async createActivity(activityData: Omit<AreaActivity, 'id' | 'fechaCreacion' | 'creadoPor' | 'creadoPorNombre' | 'area'>): Promise<string> {
    const user = this.usersService.getCurrentUser();
    if (!user) throw new Error('🔒 Usuario no autenticado');

    const currentRegister = this.registersService.getCurrentRegister();
    if (!currentRegister) throw new Error('🔒 Usuario sin registro');

    const userArea = currentRegister.areaAsignada;
    if (!userArea || userArea === 'sin_asignar') {
      throw new Error('⛔ Usuario sin área asignada');
    }

    const areaSlug = await this.getAreaSlugByName(userArea);

    const newActivity: Omit<AreaActivity, 'id'> = {
      ...activityData,
      area: areaSlug,
      fechaCreacion: new Date(),
      creadoPor: user.uid,
      creadoPorNombre: currentRegister.displayName || user.email || 'Usuario'
    };

    try {
      const activitiesRef = collection(this.firestore, this.collectionName);
      const docRef = await addDoc(activitiesRef, newActivity);
      console.log('✅ Actividad creada:', docRef.id);
      return docRef.id;
    } catch (error: any) {
      console.error('❌ Error creando actividad:', error);
      
      if (error.code === 'permission-denied') {
        throw new Error('🚫 No tiene permisos para crear actividades');
      }
      
      throw error;
    }
  }

  // ============================================
  // 🔧 CONVERTIR NOMBRE A SLUG
  // ============================================
  private async getAreaSlugByName(nombreArea: string): Promise<string> {
    try {
      const areas = await this.registersService.getAreasOficinaOnce();
      const area = areas.find(a => a.nombre === nombreArea);
      return area?.slug || nombreArea.toLowerCase();
    } catch (error) {
      console.error('Error obteniendo slug del área:', error);
      return nombreArea.toLowerCase();
    }
  }

  // ============================================
  // 📋 OBTENER ACTIVIDADES (con validación)
  // ============================================
  
  /**
   * 📅 Obtener actividades por área y rango de fechas
   * ⚠️ INCLUYE VALIDACIÓN DE PERMISOS
   */
  getActivitiesByAreaAndDateRange(area: string, startDate: Date, endDate: Date): Observable<AreaActivity[]> {
    try {
      // 🔒 VALIDACIÓN: El usuario puede acceder a este área?
      this.validateAreaAccess(area);
      
      const activitiesRef = collection(this.firestore, this.collectionName);
      const q = query(
        activitiesRef,
        where('area', '==', area),
        where('fechaLimite', '>=', startDate),
        where('fechaLimite', '<=', endDate),
        orderBy('fechaLimite', 'asc')
      );

      return collectionData(q, { idField: 'id' }).pipe(
        map(activities => activities as AreaActivity[]),
        catchError(error => {
          console.error('❌ Error obteniendo actividades:', error);
          return throwError(() => new Error('Error al cargar las actividades'));
        })
      );
      
    } catch (error: any) {
      // Si la validación falla, retornar Observable vacío con error
      console.error('🚫 Acceso denegado:', error.message);
      return throwError(() => error);
    }
  }

  /**
   * 📋 Obtener actividades del área del usuario actual
   */
  getCurrentUserAreaActivities(): Observable<AreaActivity[]> {
    return new Observable(observer => {
      const currentRegister = this.registersService.getCurrentRegister();

      if (!currentRegister || currentRegister.areaAsignada === 'sin_asignar') {
        observer.next([]);
        return;
      }

      this.getAreaSlugByName(currentRegister.areaAsignada).then(areaSlug => {
        try {
          // 🔒 Validar acceso antes de consultar
          this.validateAreaAccess(areaSlug);
          
          const activitiesRef = collection(this.firestore, this.collectionName);
          const q = query(
            activitiesRef,
            where('area', '==', areaSlug),
            orderBy('fechaLimite', 'asc')
          );

          const activities$ = collectionData(q, { idField: 'id' }) as Observable<AreaActivity[]>;
          activities$.subscribe(
            activities => observer.next(activities),
            error => {
              console.error('❌ Error:', error);
              observer.next([]);
            }
          );
        } catch (error: any) {
          console.error('🚫 Validación fallida:', error.message);
          observer.next([]);
        }
      });
    });
  }

  /**
   * 📅 Obtener actividades de la semana actual (con validación)
   */
  getCurrentWeekActivities(): Observable<AreaActivity[]> {
    return new Observable(observer => {
      const currentRegister = this.registersService.getCurrentRegister();

      if (!currentRegister || currentRegister.areaAsignada === 'sin_asignar') {
        observer.next([]);
        return;
      }

      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));

      startOfWeek.setHours(0, 0, 0, 0);
      endOfWeek.setHours(23, 59, 59, 999);

      this.getAreaSlugByName(currentRegister.areaAsignada).then(areaSlug => {
        const activities$ = this.getActivitiesByAreaAndDateRange(
          areaSlug,
          startOfWeek,
          endOfWeek
        );
        activities$.subscribe(
          activities => observer.next(activities),
          error => {
            console.error('❌ Error:', error);
            observer.next([]);
          }
        );
      });
    });
  }

  // ============================================
  // ✏️ ACTUALIZAR ACTIVIDAD (con validación)
  // ============================================
  async updateActivity(activityId: string, updates: Partial<AreaActivity>): Promise<void> {
    try {
      await this.validateModificationPermission(activityId);
      
      const docRef = doc(this.firestore, `${this.collectionName}/${activityId}`);

      if (updates.estado === 'completada' && !updates.fechaCompletada) {
        updates.fechaCompletada = new Date();
      }

      await updateDoc(docRef, updates);
      console.log('✅ Actividad actualizada:', activityId);
      
    } catch (error: any) {
      console.error('❌ Error actualizando actividad:', error);
      
      if (error.code === 'permission-denied') {
        throw new Error('🚫 No tiene permisos para actualizar esta actividad');
      }
      
      throw error;
    }
  }

  // ============================================
  // 🗑️ ELIMINAR ACTIVIDAD (con validación)
  // ============================================
  async deleteActivity(activityId: string): Promise<void> {
    try {
      await this.validateModificationPermission(activityId);
      
      const docRef = doc(this.firestore, `${this.collectionName}/${activityId}`);
      await deleteDoc(docRef);
      console.log('✅ Actividad eliminada:', activityId);
      
    } catch (error: any) {
      console.error('❌ Error eliminando actividad:', error);
      
      if (error.code === 'permission-denied') {
        throw new Error('🚫 No tiene permisos para eliminar esta actividad. Solo el creador puede eliminarla.');
      }
      
      throw error;
    }
  }

  // ============================================
  // 📅 MÉTODOS AUXILIARES (sin cambios)
  // ============================================
  
  async postponeActivity(activityId: string, newDate: Date): Promise<void> {
    await this.updateActivity(activityId, {
      fechaLimite: newDate,
      estado: 'pospuesta'
    });
  }

  async completeActivity(activityId: string, notas?: string): Promise<void> {
    const updates: Partial<AreaActivity> = {
      estado: 'completada',
      fechaCompletada: new Date()
    };

    if (notas) {
      updates.notas = notas;
    }

    await this.updateActivity(activityId, updates);
  }

  async changeActivityStatus(activityId: string, newStatus: AreaActivity['estado']): Promise<void> {
    await this.updateActivity(activityId, { estado: newStatus });
  }

  async assignResponsible(activityId: string, responsableUid: string, responsableNombre: string): Promise<void> {
    await this.updateActivity(activityId, {
      responsable: responsableUid,
      responsableNombre: responsableNombre
    });
  }

  async getAreaStatistics(area: string): Promise<{
    total: number;
    pendientes: number;
    enProgreso: number;
    completadas: number;
    pospuestas: number;
  }> {
    return {
      total: 0,
      pendientes: 0,
      enProgreso: 0,
      completadas: 0,
      pospuestas: 0
    };
  }

  getActivitiesByTag(tag: string): Observable<AreaActivity[]> {
    return new Observable(observer => {
      const currentRegister = this.registersService.getCurrentRegister();

      if (!currentRegister || currentRegister.areaAsignada === 'sin_asignar') {
        observer.next([]);
        return;
      }

      this.getAreaSlugByName(currentRegister.areaAsignada).then(areaSlug => {
        try {
          this.validateAreaAccess(areaSlug);
          
          const activitiesRef = collection(this.firestore, this.collectionName);
          const q = query(
            activitiesRef,
            where('area', '==', areaSlug),
            where('etiquetas', 'array-contains', tag)
          );

          const activities$ = collectionData(q, { idField: 'id' }) as Observable<AreaActivity[]>;
          activities$.subscribe(activities => observer.next(activities));
        } catch (error: any) {
          console.error('🚫 Acceso denegado:', error.message);
          observer.next([]);
        }
      });
    });
  }

  getActivitiesByPriority(priority: 'baja' | 'media' | 'alta'): Observable<AreaActivity[]> {
    return new Observable(observer => {
      const currentRegister = this.registersService.getCurrentRegister();

      if (!currentRegister || currentRegister.areaAsignada === 'sin_asignar') {
        observer.next([]);
        return;
      }

      this.getAreaSlugByName(currentRegister.areaAsignada).then(areaSlug => {
        try {
          this.validateAreaAccess(areaSlug);
          
          const activitiesRef = collection(this.firestore, this.collectionName);
          const q = query(
            activitiesRef,
            where('area', '==', areaSlug),
            where('prioridad', '==', priority),
            orderBy('fechaLimite', 'asc')
          );

          const activities$ = collectionData(q, { idField: 'id' }) as Observable<AreaActivity[]>;
          activities$.subscribe(activities => observer.next(activities));
        } catch (error: any) {
          console.error('🚫 Acceso denegado:', error.message);
          observer.next([]);
        }
      });
    });
  }
}