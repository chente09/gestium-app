// Normalizaciones de coactivados (sin Angular ni Firestore): las usan tanto
// CoactivadosService como el importador de títulos de crédito, que no puede
// depender del servicio sin crear una dependencia circular.

export const COLECCION_COACTIVADOS = 'coactivados';

export function normalizarCedula(valor: string): string {
  return valor.replace(/[\s.-]/g, '');
}

export function esCedulaValida(valor: string): boolean {
  return /^(\d{10}|\d{13})$/.test(valor);
}

export function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ').toUpperCase();
}

// MAYÚSCULAS sin tildes, para buscar por prefijo.
export function normalizarBusqueda(texto: string): string {
  return normalizarNombre(texto).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Palabras sueltas del nombre (MAYÚSCULAS sin tildes, sin repetidas) — para
// poder buscar por una palabra intermedia (ej. "ANA" en "JIJON PINTO ANA
// LUISA"), no solo por el prefijo del nombre completo.
export function palabrasBusqueda(nombre: string): string[] {
  return [...new Set(normalizarBusqueda(nombre).split(' ').filter(Boolean))];
}
