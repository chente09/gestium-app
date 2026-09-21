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
