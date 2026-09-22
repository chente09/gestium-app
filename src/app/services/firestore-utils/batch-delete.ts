import { DocumentReference, Firestore, writeBatch } from '@angular/fire/firestore';

// Firestore admite 500 operaciones por batch; se deja margen.
const MAX_POR_LOTE = 400;

export async function borrarEnLotes(firestore: Firestore, refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += MAX_POR_LOTE) {
    const batch = writeBatch(firestore);
    refs.slice(i, i + MAX_POR_LOTE).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

// Para cargas grandes (ej. importar miles de títulos de crédito): 'set'
// reemplaza el documento entero (alta), 'update' solo los campos dados
// (ej. transición no_entregado → entregado sin tocar el resto).
export interface EscrituraLote {
  ref: DocumentReference;
  // any (no unknown): así coincide con el UpdateData laxo que espera el SDK
  // de Firestore para batch.update en una referencia sin tipar.
  data: Record<string, any>;
  tipo: 'set' | 'update';
}

export async function escribirEnLotes(firestore: Firestore, escrituras: EscrituraLote[]): Promise<void> {
  for (let i = 0; i < escrituras.length; i += MAX_POR_LOTE) {
    const batch = writeBatch(firestore);
    escrituras.slice(i, i + MAX_POR_LOTE).forEach(e => {
      if (e.tipo === 'set') batch.set(e.ref, e.data);
      else batch.update(e.ref, e.data);
    });
    await batch.commit();
  }
}
