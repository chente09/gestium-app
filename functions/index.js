const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

initializeApp();

// Borra la cuenta de Auth de otro usuario. Solo lo puede llamar un admin
// (verificado acá, server-side, contra registers/{uid}.role — no se
// puede falsificar desde el cliente). El borrado del propio doc en
// Firestore ya lo maneja el cliente directo, vía las reglas de
// Firestore (allow delete: if isAdmin()).
exports.deleteUser = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'Debes estar autenticado.');
  }

  const { uid } = request.data || {};
  if (!uid || typeof uid !== 'string') {
    throw new HttpsError('invalid-argument', 'Falta el uid del usuario a eliminar.');
  }

  const callerDoc = await getFirestore().doc(`registers/${callerUid}`).get();
  if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un admin puede eliminar otros usuarios.');
  }

  await getAuth().deleteUser(uid);
  return { success: true };
});

function toIso(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  return value || null;
}

function serializeProceso(id, data) {
  return {
    id,
    ...data,
    fechaCreacion: toIso(data.fechaCreacion),
    etapas: (data.etapas || []).map((e) => ({ ...e, fechaRegistro: toIso(e.fechaRegistro) })),
  };
}

// Búsqueda pública de procesos (pantalla /consultas, sin login). Antes el
// cliente descargaba TODA la colección 'procesos' (nombres, cédulas,
// documentos de cada caso) y filtraba en el navegador — cualquier visitante
// recibía la base completa aunque no buscara nada. Acá el filtrado ocurre
// server-side con Admin SDK y solo se devuelven los resultados que
// realmente calzan con la búsqueda.
exports.buscarProceso = onCall(async (request) => {
  const { tipo, valor } = request.data || {};
  if (!tipo || !valor || typeof valor !== 'string') {
    throw new HttpsError('invalid-argument', 'Faltan parámetros de búsqueda.');
  }

  const db = getFirestore();

  if (tipo === 'cedula') {
    if (!/^[0-9]{10}$/.test(valor)) {
      throw new HttpsError('invalid-argument', 'Cédula inválida.');
    }
    const snap = await db.collection('procesos').where('cedula', '==', valor).get();
    return { resultados: snap.docs.map((d) => serializeProceso(d.id, d.data())) };
  }

  if (tipo === 'nombre') {
    if (valor.trim().length < 3) {
      throw new HttpsError('invalid-argument', 'Ingresa al menos 3 caracteres.');
    }
    const valorLower = valor.toLowerCase();
    const snap = await db.collection('procesos').get();
    const resultados = snap.docs
      .map((d) => serializeProceso(d.id, d.data()))
      .filter((p) => (p.nombre || '').toLowerCase().includes(valorLower));
    return { resultados };
  }

  throw new HttpsError('invalid-argument', 'Tipo de búsqueda inválido.');
});
