import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  query,
  orderBy,
  where
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

// Reglas de negocio confirmadas con Vicente y verificadas contra el Código
// del Trabajo de Ecuador (2026-08-05):
// - Pasante: $300 fijo, sin afiliación IESS, sin décimos ni fondos de reserva
//   (no está en relación de dependencia formal).
// - Afiliado: gana el SBU vigente + descuento IESS 9.45% + Décimo Tercero
//   (remuneración/12) + Décimo Cuarto (SBU/12) DESDE EL PRIMER MES — los
//   décimos son proporcionales al tiempo trabajado, NO requieren 1 año
//   (Código del Trabajo Art. 111 y 113). Fondos de Reserva (SBU/12) es el
//   único concepto que sí exige 1 año completo de afiliación continua
//   (Art. 196) — por eso tiene su propia bandera de elegibilidad, separada
//   de los décimos.
// - El SBU es un valor único que cambia una vez al año (enero), no se toca mes a mes.
// - Liquidación por salida a mitad de mes: fuera de alcance por ahora.

export interface PayrollEmployee {
  id?: string;
  uid?: string | null; // link opcional al Register, si la persona tiene cuenta en el sistema
  nombreCompleto: string;
  cedula: string;
  fechaIngreso: string; // YYYY-MM-DD
  fechaAfiliacionIESS: string | null; // YYYY-MM-DD, null = pasante sin afiliar
  empleadorNombre: string;
  empleadorRuc: string;
  activo: boolean;
  // Acumulado histórico de días de vacaciones disponibles: sube al aprobar
  // Vacaciones/permisos con descuento (ver SolicitudesPermisoService), no
  // está limitado a los 11 descontables de un solo año (se van sumando año
  // a año si no se usan) y puede quedar en negativo si la persona debe
  // días. Lo carga y ajusta el admin a mano; no hay migración de saldos
  // previos a la puesta en marcha del módulo de Permisos.
  saldoVacacionesDisponible?: number | null;
}

// Mismo shape para bonos (ingreso extra) y descuentos (ej. quirografario) —
// ambos son "concepto libre + monto" que David/admin agrega según el caso.
export interface ConceptoMonto {
  concepto: string;
  monto: number;
}

export type DescuentoVario = ConceptoMonto;
export type BonoVario = ConceptoMonto;

export interface LineaRolPago {
  payrollEmployeeId: string;
  nombre: string;
  cedula: string;
  diasTrabajados: string;
  remuneracion: number;
  elegibleDecimos: boolean; // afiliado — décimos son proporcionales desde el día 1
  decimoTercero: number;
  decimoCuarto: number;
  elegibleFondosReserva: boolean; // afiliado + 1 año completo (Art. 196)
  fondosReserva: number;
  bonosVarios: BonoVario[];
  descuentoIESS: number;
  descuentosVarios: DescuentoVario[];
  totalIngresos: number;
  totalDescuentos: number;
  liquidoARecibir: number;
}

export interface RolPago {
  id?: string;
  mes: number; // 1-12
  anio: number;
  estado: 'borrador' | 'emitido';
  generadoPor: string;
  fechaGeneracion: string; // ISO
  lineas: LineaRolPago[];
}

const IESS_PORCENTAJE = 0.0945;
const PASANTE_REMUNERACION = 300;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable({
  providedIn: 'root'
})
export class PayrollService {
  private employeesCollection = 'payrollEmployees';
  private sbuCollection = 'sbuConfig';
  private rolesCollection = 'rolesPago';

  constructor(private firestore: Firestore) { }

  // ============================================
  // 👤 Empleados de nómina
  // ============================================
  getPayrollEmployees(): Observable<PayrollEmployee[]> {
    const ref = collection(this.firestore, this.employeesCollection);
    return collectionData(ref, { idField: 'id' }) as Observable<PayrollEmployee[]>;
  }

  async getActivePayrollEmployeesOnce(): Promise<PayrollEmployee[]> {
    const ref = collection(this.firestore, this.employeesCollection);
    const q = query(ref, where('activo', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollEmployee));
  }

  async getPayrollEmployeeById(id: string): Promise<PayrollEmployee | null> {
    const ref = doc(this.firestore, `${this.employeesCollection}/${id}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as PayrollEmployee;
  }

  // Para que un empleado encuentre su propio registro de nómina desde su
  // perfil (ej. módulo de Permisos y Vacaciones) — requiere que admin lo
  // haya vinculado antes desde Empleados de Nómina (campo uid).
  async getPayrollEmployeeByUid(uid: string): Promise<PayrollEmployee | null> {
    const ref = collection(this.firestore, this.employeesCollection);
    const q = query(ref, where('uid', '==', uid));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as PayrollEmployee;
  }

  async createPayrollEmployee(employee: Omit<PayrollEmployee, 'id'>): Promise<string> {
    const ref = collection(this.firestore, this.employeesCollection);
    const docRef = await addDoc(ref, employee);
    return docRef.id;
  }

  async updatePayrollEmployee(id: string, updates: Partial<PayrollEmployee>): Promise<void> {
    const ref = doc(this.firestore, `${this.employeesCollection}/${id}`);
    await updateDoc(ref, { ...updates });
  }

  // ============================================
  // 💰 SBU vigente (un documento por año)
  // ============================================
  async getSbuVigente(anio: number): Promise<number | null> {
    const ref = doc(this.firestore, `${this.sbuCollection}/${anio}`);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data()['valor'] as number) : null;
  }

  async setSbu(anio: number, valor: number): Promise<void> {
    const ref = doc(this.firestore, `${this.sbuCollection}/${anio}`);
    await setDoc(ref, { anio, valor });
  }

  // Vacaciones (Art. 69) exigen, igual que Fondos de Reserva (Art. 196),
  // 1 año completo de afiliación continua — a diferencia de los décimos,
  // que son proporcionales desde el día 1. Pasantes (sin fechaAfiliacionIESS)
  // no tienen acceso, solo a permisos.
  esElegibleVacaciones(employee: PayrollEmployee, fecha: Date = new Date()): boolean {
    if (!employee.fechaAfiliacionIESS) return false;
    const [y, m, d] = employee.fechaAfiliacionIESS.split('-').map(Number);
    const unAnioDespues = new Date(y + 1, m - 1, d);
    return fecha >= unAnioDespues;
  }

  // ============================================
  // 🧮 Cálculo de una línea de rol
  // ============================================
  private calcularLinea(
    employee: PayrollEmployee,
    sbu: number,
    fechaCorte: Date,
    diasTrabajados: string,
    bonosVarios: BonoVario[],
    descuentosVarios: DescuentoVario[]
  ): LineaRolPago {
    const esPasante = !employee.fechaAfiliacionIESS;
    const remuneracion = esPasante ? PASANTE_REMUNERACION : sbu;

    // Décimos: proporcionales desde el primer mes de afiliación, sin espera de 1 año.
    const elegibleDecimos = !esPasante;

    // Fondos de reserva: sí exige 1 año completo de afiliación continua
    // (misma regla que Vacaciones, Art. 196 y Art. 69 respectivamente).
    const elegibleFondosReserva = this.esElegibleVacaciones(employee, fechaCorte);

    const decimoTercero = elegibleDecimos ? round2(remuneracion / 12) : 0;
    const decimoCuarto = elegibleDecimos ? round2(sbu / 12) : 0;
    const fondosReserva = elegibleFondosReserva ? round2(sbu / 12) : 0;
    const descuentoIESS = esPasante ? 0 : round2(remuneracion * IESS_PORCENTAJE);

    const totalBonosVarios = bonosVarios.reduce((sum, b) => sum + b.monto, 0);
    const totalDescuentosVarios = descuentosVarios.reduce((sum, dv) => sum + dv.monto, 0);
    const totalIngresos = round2(remuneracion + decimoTercero + decimoCuarto + fondosReserva + totalBonosVarios);
    const totalDescuentos = round2(descuentoIESS + totalDescuentosVarios);
    const liquidoARecibir = round2(totalIngresos - totalDescuentos);

    return {
      payrollEmployeeId: employee.id!,
      nombre: employee.nombreCompleto,
      cedula: employee.cedula,
      diasTrabajados,
      remuneracion,
      elegibleDecimos,
      decimoTercero,
      decimoCuarto,
      elegibleFondosReserva,
      fondosReserva,
      bonosVarios,
      descuentoIESS,
      descuentosVarios,
      totalIngresos,
      totalDescuentos,
      liquidoARecibir
    };
  }

  // Recalcula los totales de una línea ya existente (ej. al editar bonos/descuentos)
  recalcularLinea(linea: LineaRolPago): LineaRolPago {
    const totalBonosVarios = linea.bonosVarios.reduce((sum, b) => sum + b.monto, 0);
    const totalDescuentosVarios = linea.descuentosVarios.reduce((sum, dv) => sum + dv.monto, 0);
    const totalIngresos = round2(linea.remuneracion + linea.decimoTercero + linea.decimoCuarto + linea.fondosReserva + totalBonosVarios);
    const totalDescuentos = round2(linea.descuentoIESS + totalDescuentosVarios);
    const liquidoARecibir = round2(totalIngresos - totalDescuentos);
    return { ...linea, totalIngresos, totalDescuentos, liquidoARecibir };
  }

  // ============================================
  // 📋 Roles de pago mensuales
  // ============================================
  private async calcularLineasFrescas(mes: number, anio: number): Promise<LineaRolPago[]> {
    const sbu = await this.getSbuVigente(anio);
    if (!sbu) {
      throw new Error(`No hay SBU configurado para el año ${anio}. Configuralo antes de generar el rol.`);
    }

    const empleados = await this.getActivePayrollEmployeesOnce();
    const fechaCorte = new Date(anio, mes - 1, 1);

    return empleados.map(emp => this.calcularLinea(emp, sbu, fechaCorte, 'TODOS', [], []));
  }

  async generarRolPago(mes: number, anio: number, generadoPor: string): Promise<string> {
    const lineas = await this.calcularLineasFrescas(mes, anio);

    const rol: Omit<RolPago, 'id'> = {
      mes,
      anio,
      estado: 'borrador',
      generadoPor,
      fechaGeneracion: new Date().toISOString(),
      lineas
    };

    const ref = collection(this.firestore, this.rolesCollection);
    const docRef = await addDoc(ref, rol);
    return docRef.id;
  }

  // Recalcula un rol en borrador desde cero (nuevos empleados, SBU vigente,
  // reglas de cálculo actuales). Descarta días trabajados y bonos/descuentos
  // que se hubieran cargado a mano — solo tiene sentido mientras es borrador.
  async regenerarRolPago(rolId: string): Promise<void> {
    const rol = await this.getRolPago(rolId);
    if (!rol) throw new Error('Rol no encontrado');
    if (rol.estado !== 'borrador') throw new Error('Solo se puede regenerar un rol en borrador');

    const lineas = await this.calcularLineasFrescas(rol.mes, rol.anio);
    const ref = doc(this.firestore, `${this.rolesCollection}/${rolId}`);
    await updateDoc(ref, { lineas });
  }

  // Agrega al borrador solo los empleados activos que todavía no tienen
  // línea (ej. se dieron de alta después de generar el rol) — sin tocar
  // días trabajados ni bonos/descuentos ya cargados en el resto. Devuelve
  // cuántos se agregaron.
  async agregarEmpleadosFaltantes(rolId: string): Promise<number> {
    const rol = await this.getRolPago(rolId);
    if (!rol) throw new Error('Rol no encontrado');
    if (rol.estado !== 'borrador') throw new Error('Solo se puede modificar un rol en borrador');

    const sbu = await this.getSbuVigente(rol.anio);
    if (!sbu) throw new Error(`No hay SBU configurado para el año ${rol.anio}`);

    const empleadosActivos = await this.getActivePayrollEmployeesOnce();
    const idsExistentes = new Set(rol.lineas.map(l => l.payrollEmployeeId));
    const faltantes = empleadosActivos.filter(e => e.id && !idsExistentes.has(e.id));

    if (faltantes.length === 0) return 0;

    const fechaCorte = new Date(rol.anio, rol.mes - 1, 1);
    const nuevasLineas = faltantes.map(emp => this.calcularLinea(emp, sbu, fechaCorte, 'TODOS', [], []));
    const lineas = [...rol.lineas, ...nuevasLineas];

    const ref = doc(this.firestore, `${this.rolesCollection}/${rolId}`);
    await updateDoc(ref, { lineas });

    return faltantes.length;
  }

  async eliminarRolPago(rolId: string): Promise<void> {
    const ref = doc(this.firestore, `${this.rolesCollection}/${rolId}`);
    await deleteDoc(ref);
  }

  getRolesPago(): Observable<RolPago[]> {
    const ref = collection(this.firestore, this.rolesCollection);
    const q = query(ref, orderBy('anio', 'desc'), orderBy('mes', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<RolPago[]>;
  }

  async getRolPago(id: string): Promise<RolPago | null> {
    const ref = doc(this.firestore, `${this.rolesCollection}/${id}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as RolPago;
  }

  async actualizarLineasRolPago(rolId: string, lineas: LineaRolPago[]): Promise<void> {
    const ref = doc(this.firestore, `${this.rolesCollection}/${rolId}`);
    await updateDoc(ref, { lineas });
  }

  async emitirRolPago(rolId: string): Promise<void> {
    const ref = doc(this.firestore, `${this.rolesCollection}/${rolId}`);
    await updateDoc(ref, { estado: 'emitido' });
  }
}
