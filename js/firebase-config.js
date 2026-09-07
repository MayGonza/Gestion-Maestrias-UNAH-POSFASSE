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
  apiKey: "AIzaSyBH2TWUVZ-7dheOQYjE8pn4O8WEL5dtlCs",
  authDomain: "maestrias-unah-posfasse.firebaseapp.com",
  projectId: "maestrias-unah-posfasse",
  storageBucket: "maestrias-unah-posfasse.firebasestorage.app",
  messagingSenderId: "796291112561",
  appId: "1:796291112561:web:5250c320c7529af52045d0",
  measurementId: "G-VB2YYV4XEG"
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
