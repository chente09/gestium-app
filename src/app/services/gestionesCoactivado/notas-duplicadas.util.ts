import type { GestionCoactivado } from './gestiones-coactivado.service';
import { normalizarClaveGestion } from '../titulosCredito/importador-titulos.util';

// Notas "Migrado del Excel" repetidas de un mismo coactivado. La gestión es
// del RUC, no de cada título: el Excel repite la nota en cada título con
// variaciones mínimas (la hora, por ejemplo) y el importador, que antes solo
// comparaba el texto exacto, las migró como notas distintas.

export interface GrupoNotasDuplicadas {
  coactivadoId: string;
  coactivadoNombre: string;
  conservar: GestionCoactivado;
  sobrantes: GestionCoactivado[];
}

// Lo que se compara es la clave con la que se migró la nota; las gestiones
// migradas antes de existir esa clave se comparan por su texto.
function claveDe(g: GestionCoactivado): string {
  const original = g.claveHistorica ?? `${g.coactivadoId}\u0000${g.descripcion}\u0000${g.observacionGeneral ?? ''}`;
  return normalizarClaveGestion(original);
}

// Una gestión que alguien editó a mano ya no es "la del Excel": nunca se
// propone borrarla, y si el grupo tiene una, es la que se conserva.
export function agruparNotasDuplicadas(gestiones: GestionCoactivado[]): GrupoNotasDuplicadas[] {
  const porClave = new Map<string, GestionCoactivado[]>();
  for (const g of gestiones) {
    if (g.tipo !== 'migrado') continue;
    const lista = porClave.get(claveDe(g)) ?? [];
    lista.push(g);
    porClave.set(claveDe(g), lista);
  }

  const grupos: GrupoNotasDuplicadas[] = [];
  for (const lista of porClave.values()) {
    if (lista.length < 2) continue;

    // Primero la editada (si hay), luego la más antigua; empate: el texto.
    const ordenadas = [...lista].sort((a, b) =>
      Number(!!b.editadoPor) - Number(!!a.editadoPor) ||
      a.fecha.getTime() - b.fecha.getTime() ||
      a.descripcion.localeCompare(b.descripcion)
    );
    const [conservar, ...resto] = ordenadas;
    const sobrantes = resto.filter(g => !g.editadoPor);
    if (sobrantes.length === 0) continue;

    grupos.push({
      coactivadoId: conservar.coactivadoId,
      coactivadoNombre: conservar.coactivadoNombre,
      conservar,
      sobrantes
    });
  }

  return grupos.sort((a, b) =>
    a.coactivadoNombre.localeCompare(b.coactivadoNombre) || a.coactivadoId.localeCompare(b.coactivadoId)
  );
}
