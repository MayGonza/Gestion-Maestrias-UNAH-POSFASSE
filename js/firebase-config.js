// =============================================================================
// CONFIGURACIÓN DE CONEXIÓN CON FIREBASE / FIRESTORE - POSFACE UNAH
// Facultad de Ciencias Económicas, Administrativas y Contables
// =============================================================================
//
// INSTRUCCIONES PARA CONECTAR TU BASE DE DATOS DE FIREBASE:
// 1. Ingresa a la consola de Firebase: https://console.firebase.google.com/
// 2. Crea un proyecto nuevo (ej. "posface-unah-db").
// 3. En la configuración de tu proyecto, haz clic en "+ Agregar app" y selecciona Web (</>).
// 4. Copia los valores de tu objeto "firebaseConfig" y pégalos aquí abajo:
// 5. En el panel izquierdo de Firebase activa:
//    - "Authentication" -> Método de inicio de sesión -> Habilitar "Correo electrónico/contraseña".
//    - "Firestore Database" -> Crear base de datos (en modo de producción o prueba).
// =============================================================================

window.FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "posface-unah.firebaseapp.com",
  projectId: "posface-unah",
  storageBucket: "posface-unah.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};

// Función para comprobar si se han ingresado credenciales reales de Firebase
window.isFirebaseConfigured = function () {
  return (
    window.FIREBASE_CONFIG &&
    window.FIREBASE_CONFIG.apiKey &&
    window.FIREBASE_CONFIG.apiKey !== "TU_API_KEY_AQUI" &&
    !window.FIREBASE_CONFIG.apiKey.startsWith("TU_")
  );
};
