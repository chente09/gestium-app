import type { GestionCoactivado } from '../gestionesCoactivado/gestiones-coactivado.service';

// Tope de destinatarios por aviso: lo exigen también las reglas de Firestore
// (mail_iess), así que cambiarlo acá obliga a cambiarlo allá.
export const MAX_DESTINATARIOS = 10;

// Toda gestión que registra un aviso enviado empieza así: de ahí se detecta
// si a un coactivado ya se le mandó el aviso antes (ver ultimoAvisoEnviado).
export const PREFIJO_GESTION_AVISO = 'Aviso pre-coactivo enviado';

export function esCorreoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo);
}

// El campo `correo` del coactivado es texto libre: el Excel del IESS trae
// varios correos juntos, separados por coma, punto y coma, "/" o saltos de
// línea. Devuelve cada uno una sola vez, en minúsculas y sin adornos, pero
// SIN descartar los que no parecen correos — la pantalla los muestra para que
// se corrijan en vez de perderlos en silencio.
export function separarCorreos(texto: string | undefined | null): string[] {
  if (!texto) return [];
  const vistos = new Set<string>();
  const resultado: string[] = [];

  for (const crudo of texto.split(/[\s,;/|]+/)) {
    const correo = crudo.replace(/[<>"'()]/g, '').replace(/\.+$/, '').toLowerCase();
    if (!correo || vistos.has(correo)) continue;
    vistos.add(correo);
    resultado.push(correo);
  }
  return resultado;
}

// Empresa = RUC de 13 dígitos cuyo tercer dígito es 9 (sociedad privada) o 6
// (entidad pública). Una persona natural, aunque tenga RUC (tercer dígito
// 0-5) o cédula (10 dígitos), no es empresa: ahí el aviso va a su nombre.
export function esEmpresa(ruc: string): boolean {
  return /^\d{2}[69]\d{10}$/.test(ruc);
}

// Números de título pegados a mano ("511372908; 511530720, 512133110"):
// separados por coma, punto y coma, espacios o saltos de línea. Los que no son
// solo dígitos se devuelven aparte para avisarlo, no se descartan callados.
export function separarNumerosTitulo(texto: string | undefined | null): { numeros: string[]; invalidos: string[] } {
  const numeros: string[] = [];
  const invalidos: string[] = [];
  const vistos = new Set<string>();

  for (const token of (texto ?? '').split(/[\s,;]+/)) {
    if (!token || vistos.has(token)) continue;
    vistos.add(token);
    (/^\d+$/.test(token) ? numeros : invalidos).push(token);
  }
  return { numeros, invalidos };
}

// Suma en centavos para no arrastrar errores de punto flotante (0.1 + 0.2).
export function sumarCapital(titulos: { capital: number }[]): number {
  const centavos = titulos.reduce((total, t) => total + Math.round(t.capital * 100), 0);
  return centavos / 100;
}

// Última vez que se registró un aviso enviado a este coactivado, o null.
export function ultimoAvisoEnviado(gestiones: GestionCoactivado[]): Date | null {
  let ultimo: Date | null = null;
  for (const g of gestiones) {
    if (g.tipo !== 'correo' || !g.descripcion.startsWith(PREFIJO_GESTION_AVISO)) continue;
    if (!ultimo || g.fecha.getTime() > ultimo.getTime()) ultimo = g.fecha;
  }
  return ultimo;
}
