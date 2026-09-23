import { Injectable } from '@angular/core';
import {
  DocumentReference,
  Firestore,
  collection,
  count,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  runTransaction,
  query,
  sum,
  where,
  limit
} from '@angular/fire/firestore';
import { RegistersService } from '../registers/registers.service';
import { UsersService } from '../users/users.service';
import { GestionesCoactivadoService } from '../gestionesCoactivado/gestiones-coactivado.service';
import { COLECCION_GESTIONES } from '../gestionesCoactivado/gestiones-coactivado.service';
import { TitulosCreditoService } from '../titulosCredito/titulos-credito.service';
import { COLECCION_TITULOS } from '../titulosCredito/titulos-credito.service';
import { TituloCredito } from '../titulosCredito/titulos-credito.util';
import { borrarEnLotes } from '../firestore-utils/batch-delete';
import {
  COLECCION_COACTIVADOS,
  esCedulaValida,
  normalizarBusqueda,
  normalizarCedula,
  normalizarNombre
} from './coactivados.util';

// Firestore 'in' admite hasta 30 valores por consulta.
const TAM_CHUNK_IN = 30;

function chunks<T>(arr: T[], tam: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += tam) out.push(arr.slice(i, i + tam));
  return out;
}

// Las normalizaciones viven en coactivados.util (puras); se re-exportan acá
// para no tocar a quien ya las importa desde este servicio.
export { esCedulaValida, normalizarBusqueda, normalizarCedula };

// La cédula (o RUC) es el ID del documento: así un mismo coactivado no se
// puede registrar dos veces, aunque dos personas lo creen a la vez.
export interface Coactivado {
  cedula: string;
  nombre: string;
  nombreBusqueda: string; // MAYÚSCULAS sin tildes, para buscar por prefijo
  cartera: string;
  creadoPor: { uid: string; nombre: string };
  fechaCreacion: Date | any;
}

export interface CoactivadoConEstado extends Coactivado {
  // Si ya tiene alguna gestión registrada (incluye las migradas del Excel).
  tieneGestion: boolean;
}

// Panel de carteras: para decidir por dónde seguir gestionando.
export interface ResumenCartera {
  cartera: string;
  coactivados: number;
  titulos: number;
  capital: number;
  // Coactivados sin ninguna gestión registrada todavía (ni siquiera migrada).
  pendientes: Coactivado[];
  // Todos los coactivados de la cartera, pendientes primero — para revisar
  // el resto de casos y decidir por cuál seguir o empezar.
  todos: CoactivadoConEstado[];
}

// Estadística de recuperación de cartera: cuántos títulos ya se cobraron
// (pago_total) o tienen abono, y cuánto dinero real representa.
export interface ResumenRecuperacion {
  cartera: string;
  titulosCancelados: number; // pago_total
  titulosConAbono: number;
  montoCancelado: number;
  honorarios: number; // total registrado (cobrado + por cobrar)
  honorariosCobrados: number; // el IESS ya le pagó a la oficina
  honorariosPorCobrar: number;
}

// Coactivado con títulos cancelados (del Excel o a mano) a los que todavía
// no se les registró el monto/honorario real del pago.
export interface CoactivadoPendienteDeRegistro {
  cedula: string;
  nombre: string;
  titulosSinMonto: number;
}

// Cuántos títulos están cancelados en total (vengan del Excel o de
// "Registrar pago") — separado de ResumenRecuperacion, que solo cuenta lo
// que ya tiene monto/honorario reales. Este resumen sirve para encontrar
// los que faltan por completar.
export interface ResumenCancelados {
  cartera: string;
  totalCancelados: number;
  conMontoRegistrado: number;
  sinMontoRegistrado: number;
  capitalCancelado: number;
  pendientesDeRegistro: CoactivadoPendienteDeRegistro[];
}

@Injectable({
  providedIn: 'root'
})
export class CoactivadosService {
  private collectionName = COLECCION_COACTIVADOS;

  constructor(
    private firestore: Firestore,
    private registersService: RegistersService,
    private usersService: UsersService,
    private gestionesService: GestionesCoactivadoService,
    private titulosService: TitulosCreditoService
  ) { }

  async getByCedula(cedula: string): Promise<Coactivado | null> {
    const ref = doc(this.firestore, `${this.collectionName}/${cedula}`);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as Coactivado) : null;
  }

  // Prefijo sobre nombreBusqueda (los nombres van "APELLIDOS NOMBRES"): una
  // sola condición de rango + limit, sin índice compuesto y sin traer toda
  // la colección.
  async buscarPorNombre(termino: string): Promise<Coactivado[]> {
    const t = normalizarBusqueda(termino);
    if (!t) return [];

    const ref = collection(this.firestore, this.collectionName);
    const q = query(ref, where('nombreBusqueda', '>=', t), where('nombreBusqueda', '<=', t + ''), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Coactivado);
  }

  // Lanza Error('YA_EXISTE') si esa cédula ya está registrada.
  async crear(data: { cedula: string; nombre: string; cartera: string }): Promise<Coactivado> {
    const user = this.usersService.getCurrentUser();
    const register = this.registersService.getCurrentRegister();
    if (!user || !register) throw new Error('🔒 Usuario no autenticado');

    const cedula = normalizarCedula(data.cedula);
    const nombre = normalizarNombre(data.nombre);
    const coactivado: Coactivado = {
      cedula,
      nombre,
      nombreBusqueda: normalizarBusqueda(nombre),
      cartera: data.cartera,
      creadoPor: { uid: user.uid, nombre: register.displayName || user.email || 'Usuario' },
      fechaCreacion: new Date()
    };

    const ref = doc(this.firestore, `${this.collectionName}/${cedula}`);
    await runTransaction(this.firestore, async tx => {
      const snap = await tx.get(ref);
      if (snap.exists()) throw new Error('YA_EXISTE');
      tx.set(ref, coactivado);
    });

    return coactivado;
  }

  // Solo nombre y cartera son editables (las reglas de Firestore lo exigen).
  async actualizar(actual: Coactivado, cambios: { nombre: string; cartera: string }): Promise<Coactivado> {
    const nombre = normalizarNombre(cambios.nombre);
    const patch = { nombre, nombreBusqueda: normalizarBusqueda(nombre), cartera: cambios.cartera };

    const ref = doc(this.firestore, `${this.collectionName}/${actual.cedula}`);
    await updateDoc(ref, patch);
    return { ...actual, ...patch };
  }

  // Solo admin (las reglas de Firestore lo exigen). Primero borra lo que
  // cuelga del coactivado (gestiones, recordatorios y títulos de crédito) y
  // por último el coactivado: si algo falla a la mitad, la ficha sigue ahí y
  // se puede reintentar sin dejar registros huérfanos.
  async eliminar(cedula: string): Promise<void> {
    await this.gestionesService.eliminarPorCoactivado(cedula);
    await this.titulosService.eliminarPorCoactivado(cedula);
    await deleteDoc(doc(this.firestore, `${this.collectionName}/${cedula}`));
  }

  // ============================================
  // 🗑️ Vaciar una cartera completa (solo admin — lo exigen las reglas):
  // para empezar de cero con una carga de prueba, sin tocar otras carteras
  // ni el historial de importaciones (es auditoría permanente, no se borra).
  // ============================================
  private async cedulasDeCartera(cartera: string): Promise<string[]> {
    const ref = collection(this.firestore, this.collectionName);
    const snap = await getDocs(query(ref, where('cartera', '==', cartera)));
    return snap.docs.map(d => d.id);
  }

  // Los chunks se consultan en paralelo (no uno por uno) — con carteras de
  // varios cientos de coactivados, hacerlo secuencial se siente lento.
  private async refsPorCoactivados(coleccion: string, cedulas: string[]): Promise<DocumentReference[]> {
    const ref = collection(this.firestore, coleccion);
    const snaps = await Promise.all(
      chunks(cedulas, TAM_CHUNK_IN).map(grupo => getDocs(query(ref, where('coactivadoId', 'in', grupo))))
    );
    return snaps.flatMap(snap => snap.docs.map(d => d.ref));
  }

  async contarCartera(cartera: string): Promise<{ coactivados: number; titulos: number; gestiones: number }> {
    const cedulas = await this.cedulasDeCartera(cartera);
    if (cedulas.length === 0) return { coactivados: 0, titulos: 0, gestiones: 0 };
    const [titulos, gestiones] = await Promise.all([
      this.refsPorCoactivados(COLECCION_TITULOS, cedulas),
      this.refsPorCoactivados(COLECCION_GESTIONES, cedulas)
    ]);
    return { coactivados: cedulas.length, titulos: titulos.length, gestiones: gestiones.length };
  }

  async eliminarCartera(cartera: string): Promise<{ coactivados: number; titulos: number; gestiones: number }> {
    const cedulas = await this.cedulasDeCartera(cartera);
    if (cedulas.length === 0) return { coactivados: 0, titulos: 0, gestiones: 0 };

    const [refsTitulos, refsGestiones] = await Promise.all([
      this.refsPorCoactivados(COLECCION_TITULOS, cedulas),
      this.refsPorCoactivados(COLECCION_GESTIONES, cedulas)
    ]);

    // Gestiones y títulos primero (cuelgan del coactivado); los coactivados
    // al final — si algo falla a la mitad, no quedan huérfanos sin dueño.
    await borrarEnLotes(this.firestore, refsGestiones);
    await borrarEnLotes(this.firestore, refsTitulos);
    await borrarEnLotes(this.firestore, cedulas.map(c => doc(this.firestore, `${this.collectionName}/${c}`)));

    return { coactivados: cedulas.length, titulos: refsTitulos.length, gestiones: refsGestiones.length };
  }

  // ============================================
  // 📊 Panel de carteras: para decidir por dónde seguir gestionando. Usa
  // consultas agregadas (count/sum) para el capital — así no hay que
  // descargar cada título completo solo para sumarlo.
  // ============================================
  private async totalesTitulos(cedulas: string[]): Promise<{ titulos: number; capital: number }> {
    const ref = collection(this.firestore, COLECCION_TITULOS);
    const aggs = await Promise.all(
      chunks(cedulas, TAM_CHUNK_IN).map(grupo =>
        getAggregateFromServer(query(ref, where('coactivadoId', 'in', grupo)), { titulos: count(), capital: sum('capital') })
      )
    );
    return aggs.reduce(
      (acc, agg) => ({ titulos: acc.titulos + agg.data().titulos, capital: acc.capital + agg.data().capital }),
      { titulos: 0, capital: 0 }
    );
  }

  // Cédulas que ya tienen al menos una gestión (incluye las migradas del
  // Excel: también cuentan como contacto/historial ya documentado).
  private async cedulasConGestion(cedulas: string[]): Promise<Set<string>> {
    const ref = collection(this.firestore, COLECCION_GESTIONES);
    const snaps = await Promise.all(
      chunks(cedulas, TAM_CHUNK_IN).map(grupo => getDocs(query(ref, where('coactivadoId', 'in', grupo))))
    );
    const resultado = new Set<string>();
    snaps.forEach(snap => snap.forEach(d => resultado.add((d.data() as { coactivadoId: string }).coactivadoId)));
    return resultado;
  }

  async getResumenCartera(cartera: string): Promise<ResumenCartera> {
    const ref = collection(this.firestore, this.collectionName);
    const snap = await getDocs(query(ref, where('cartera', '==', cartera)));
    const coactivados = snap.docs.map(d => d.data() as Coactivado);
    if (coactivados.length === 0) return { cartera, coactivados: 0, titulos: 0, capital: 0, pendientes: [], todos: [] };

    const cedulas = coactivados.map(c => c.cedula);
    const [totales, conGestion] = await Promise.all([
      this.totalesTitulos(cedulas),
      this.cedulasConGestion(cedulas)
    ]);

    // Pendientes primero, y alfabético dentro de cada grupo — así "ver todos"
    // también sirve para elegir por dónde arrancar.
    const todos = coactivados
      .map(c => ({ ...c, tieneGestion: conGestion.has(c.cedula) }))
      .sort((a, b) => Number(a.tieneGestion) - Number(b.tieneGestion) || a.nombre.localeCompare(b.nombre));

    const pendientes = todos.filter(c => !c.tieneGestion);

    return { cartera, coactivados: coactivados.length, titulos: totales.titulos, capital: totales.capital, pendientes, todos };
  }

  // ============================================
  // 💰 Estadística de recuperación: cuánto se ha cobrado por cartera. Los
  // pago_total se leen completos (son pocos frente al total de títulos) y
  // se suman en el cliente — así no hace falta un índice de agregación por
  // cada campo (monto y honorario).
  // ============================================
  async getResumenRecuperacion(cartera: string): Promise<ResumenRecuperacion> {
    const cedulas = await this.cedulasDeCartera(cartera);
    if (cedulas.length === 0) {
      return { cartera, titulosCancelados: 0, titulosConAbono: 0, montoCancelado: 0, honorarios: 0, honorariosCobrados: 0, honorariosPorCobrar: 0 };
    }

    const ref = collection(this.firestore, COLECCION_TITULOS);
    const porChunk = await Promise.all(
      chunks(cedulas, TAM_CHUNK_IN).map(grupo =>
        Promise.all([
          getDocs(query(ref, where('coactivadoId', 'in', grupo), where('tipoCancelacion', '==', 'pago_total'))),
          getAggregateFromServer(query(ref, where('coactivadoId', 'in', grupo), where('tipoCancelacion', '==', 'abono')), { n: count() })
        ])
      )
    );

    let titulosCancelados = 0, montoCancelado = 0, honorarios = 0, honorariosCobrados = 0, titulosConAbono = 0;
    for (const [snapPagoTotal, aggAbono] of porChunk) {
      snapPagoTotal.forEach(d => {
        const data = d.data() as TituloCredito;
        titulosCancelados++;
        montoCancelado += data.montoCancelado ?? 0;
        honorarios += data.honorario ?? 0;
        if (data.honorarioCobrado) honorariosCobrados += data.honorario ?? 0;
      });
      titulosConAbono += aggAbono.data().n;
    }

    return {
      cartera, titulosCancelados, titulosConAbono, montoCancelado, honorarios,
      honorariosCobrados,
      honorariosPorCobrar: Math.round((honorarios - honorariosCobrados) * 100) / 100
    };
  }

  // ============================================
  // 🚩 Cancelados en conjunto: incluye los que trae el Excel (solo tienen
  // estadoIess='CANCELADO', sin monto real) además de los registrados a
  // mano — para poder ubicarlos y completarles el monto/honorario.
  //
  // NOTA: busca por igualdad exacta estadoIess=='CANCELADO'. Hoy es
  // correcto porque es el único valor que se genera (de la observación del
  // Excel o de "Registrar pago"). Si en el futuro se importa una matriz de
  // seguimiento con su propia columna de ESTADO IESS (texto libre del
  // IESS, ej. "CANCELADO TRAMITE DE COACTIVA"), este filtro no la va a
  // encontrar — habría que normalizar ese campo al importar.
  // ============================================
  async getResumenCancelados(cartera: string): Promise<ResumenCancelados> {
    const refCoact = collection(this.firestore, this.collectionName);
    const snapCoact = await getDocs(query(refCoact, where('cartera', '==', cartera)));
    const coactivados = snapCoact.docs.map(d => d.data() as Coactivado);
    if (coactivados.length === 0) {
      return { cartera, totalCancelados: 0, conMontoRegistrado: 0, sinMontoRegistrado: 0, capitalCancelado: 0, pendientesDeRegistro: [] };
    }

    const porCedula = new Map(coactivados.map(c => [c.cedula, c]));
    const cedulas = coactivados.map(c => c.cedula);
    const refTit = collection(this.firestore, COLECCION_TITULOS);

    const snaps = await Promise.all(
      chunks(cedulas, TAM_CHUNK_IN).map(grupo =>
        getDocs(query(refTit, where('coactivadoId', 'in', grupo), where('estadoIess', '==', 'CANCELADO')))
      )
    );

    let totalCancelados = 0, conMontoRegistrado = 0, capitalCancelado = 0;
    const sinMontoPorCoactivado = new Map<string, number>();

    snaps.forEach(snap => snap.forEach(d => {
      const t = d.data() as TituloCredito;
      totalCancelados++;
      capitalCancelado += t.capital;
      if (t.tipoCancelacion === 'pago_total') {
        conMontoRegistrado++;
      } else {
        sinMontoPorCoactivado.set(t.coactivadoId, (sinMontoPorCoactivado.get(t.coactivadoId) ?? 0) + 1);
      }
    }));

    const pendientesDeRegistro = [...sinMontoPorCoactivado.entries()]
      .map(([cedula, titulosSinMonto]) => ({ cedula, nombre: porCedula.get(cedula)?.nombre ?? cedula, titulosSinMonto }))
      .sort((a, b) => b.titulosSinMonto - a.titulosSinMonto);

    return {
      cartera,
      totalCancelados,
      conMontoRegistrado,
      sinMontoRegistrado: totalCancelados - conMontoRegistrado,
      capitalCancelado: Math.round(capitalCancelado * 100) / 100,
      pendientesDeRegistro
    };
  }
}
