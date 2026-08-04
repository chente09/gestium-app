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
