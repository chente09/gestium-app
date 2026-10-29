import { Injectable } from '@angular/core';

import { Coactivado, CoactivadosService } from '../coactivados/coactivados.service';
import { RegistersService } from '../registers/registers.service';
import { SharedDataService } from '../sharedData/shared-data.service';
import { ConvenioPago } from '../titulosCredito/convenios-pago.util';
import { normalizarBusqueda } from '../coactivados/coactivados.util';

const CLAVE_CARTERA = 'iess.cartera';

// Lo que comparten las pantallas del área IESS para pasar de una a otra sin
// volver al inicio: la cartera (abogado) con la que se está trabajando y las
// listas ya leídas (casos sin gestión, convenios de pago), para no volver a
// leerlas cada vez que se cambia de pantalla. Viven mientras la app esté
// abierta; las pantallas de reporte tienen su propio "Actualizar".
@Injectable({
  providedIn: 'root'
})
export class IessNavegacionService {
  private carteraActual: string | null = null;
  private sinGestionPorCartera = new Map<string, Coactivado[]>();
  private conveniosPorCartera = new Map<string, ConvenioPago[]>();

  constructor(
    private coactivadosService: CoactivadosService,
    private registersService: RegistersService,
    private sharedData: SharedDataService
  ) {
    this.carteraActual = this.leerCarteraGuardada();
  }

  get carteras(): string[] {
    return this.sharedData.getCarterasIess();
  }

  // La que se recordó; si no hay, la propia (cuando el nombre del usuario es
  // el de una cartera) o la primera de la lista.
  get cartera(): string {
    if (this.carteraActual && this.carteras.includes(this.carteraActual)) return this.carteraActual;
    const nombre = normalizarBusqueda(this.registersService.getCurrentRegister()?.displayName ?? '');
    return this.carteras.find(c => normalizarBusqueda(c) === nombre) ?? this.carteras[0] ?? '';
  }

  recordarCartera(cartera: string | null | undefined): void {
    if (!cartera || !this.carteras.includes(cartera) || cartera === this.carteraActual) return;
    this.carteraActual = cartera;
    try { localStorage.setItem(CLAVE_CARTERA, cartera); } catch { /* sin almacenamiento: solo se pierde el recuerdo */ }
  }

  private leerCarteraGuardada(): string | null {
    try { return localStorage.getItem(CLAVE_CARTERA); } catch { return null; }
  }

  // ----- Casos sin ninguna gestión
  // `leerCoactivados` solo se usa si hace falta leer: así quien ya tiene la
  // lista de la cartera la reutiliza, y quien no, no la pide de más.
  async sinGestion(cartera: string, leerCoactivados?: () => Promise<Coactivado[]>): Promise<Coactivado[]> {
    const guardada = this.sinGestionPorCartera.get(cartera);
    if (guardada) return guardada;
    const coactivados = leerCoactivados ? await leerCoactivados() : undefined;
    const lista = await this.coactivadosService.getSinGestion(cartera, coactivados);
    this.sinGestionPorCartera.set(cartera, lista);
    return lista;
  }

  publicarSinGestion(cartera: string, lista: Coactivado[]): void {
    this.sinGestionPorCartera.set(cartera, [...lista]);
  }

  // Al registrar su primera gestión el caso deja de estar sin gestión.
  marcarConGestion(cartera: string, cedula: string): void {
    const lista = this.sinGestionPorCartera.get(cartera);
    if (lista) this.sinGestionPorCartera.set(cartera, lista.filter(c => c.cedula !== cedula));
  }

  // Si la cartera cambió (alta, baja o cambio de abogado de un coactivado), lo guardado ya no sirve.
  olvidar(cartera: string): void {
    this.sinGestionPorCartera.delete(cartera);
    this.conveniosPorCartera.delete(cartera);
  }

  // ----- Convenios de pago
  async convenios(cartera: string): Promise<ConvenioPago[]> {
    const guardados = this.conveniosPorCartera.get(cartera);
    if (guardados) return guardados;
    const lista = await this.coactivadosService.getConveniosDePago(cartera);
    this.conveniosPorCartera.set(cartera, lista);
    return lista;
  }

  publicarConvenios(cartera: string, lista: ConvenioPago[]): void {
    this.conveniosPorCartera.set(cartera, lista);
  }
}
