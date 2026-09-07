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
  apiKey: "AIzaSyDxaYLAKSmvldlyv03lrvTH78giPmVFUxQ",
  authDomain: "gestion-maestrias-unah.firebaseapp.com",
  projectId: "gestion-maestrias-unah",
  storageBucket: "gestion-maestrias-unah.firebasestorage.app",
  messagingSenderId: "416623257007",
  appId: "1:416623257007:web:face0abc8f3765dac13b5a",
  measurementId: "G-NWJ6Y1TC8Z"
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
