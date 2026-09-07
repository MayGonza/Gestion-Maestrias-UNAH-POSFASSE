// =============================================================================
// SERVICIO DE FIREBASE Y ALMACENAMIENTO HÍBRIDO - POSFACE UNAH
// Maneja Autenticación (Auth) y Base de Datos (Firestore) con respaldo local
// =============================================================================

(function () {
  let isFirebaseReady = false;
  let authInstance = null;
  let dbInstance = null;

  // 1. Inicialización de Firebase (si las credenciales son válidas y la librería está cargada)
  try {
    if (typeof firebase !== 'undefined' && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      authInstance = firebase.auth();
      dbInstance = firebase.firestore();
      isFirebaseReady = true;
      console.log("%c✓ POSFACE UNAH: Conectado exitosamente a Firebase Cloud", "color: #059669; font-weight: bold;");
    } else {
      console.log("%cℹ POSFACE UNAH: Ejecutando en Modo Local Administrativo (Listo para enlazar Firebase)", "color: #0284c7; font-weight: bold;");
    }
  } catch (err) {
    console.warn("No se pudo inicializar Firebase Cloud, usando respaldo local:", err);
    isFirebaseReady = false;
  }

  // ===========================================================================
  // MÓDULO DE AUTENTICACIÓN (PosfaceAuth)
  // ===========================================================================
  const PosfaceAuth = {
    isCloudActive: function () {
      return isFirebaseReady && authInstance !== null;
    },

    // Iniciar sesión (Firebase Auth o Modo Local)
    login: async function (email, password) {
      email = (email || '').trim().toLowerCase();
      password = (password || '').trim();

      if (!email || !password) {
        throw new Error("Por favor ingresa tu correo y contraseña institucional");
      }

      // Si Firebase está configurado, autenticar contra Firebase Authentication
      if (this.isCloudActive()) {
        try {
          const userCredential = await authInstance.signInWithEmailAndPassword(email, password);
          const fbUser = userCredential.user;
          const userObj = {
            uid: fbUser.uid,
            email: fbUser.email,
            name: fbUser.displayName || email.split('@')[0].toUpperCase(),
            role: "Secretaría Académica",
            mode: "firebase"
          };
          localStorage.setItem('posface_session_user', JSON.stringify(userObj));
          return userObj;
        } catch (fbErr) {
          console.error("Error Firebase Auth:", fbErr);
          throw new Error(fbErr.message || "Error al autenticar con Firebase");
        }
      }

      // MODO LOCAL / DEMO INSTITUCIONAL (cuando aún no se conectan las credenciales)
      let storedUsers = [];
      try {
        const rawUsers = localStorage.getItem('posface_registered_users');
        if (rawUsers) storedUsers = JSON.parse(rawUsers);
      } catch (e) {}

      const found = storedUsers.find(u => u.email === email);
      const sessionUser = found || {
        uid: "local-user-admin",
        email: email,
        name: email.includes('@') ? email.split('@')[0].replace('.', ' ').toUpperCase() : "SECRETARÍA POSFACE",
        role: "Secretaría Académica POSFACE",
        institution: "UNAH - Ciudad Universitaria",
        mode: "local"
      };

      localStorage.setItem('posface_session_user', JSON.stringify(sessionUser));
      return sessionUser;
    },

    // Registrar nuevo usuario (Firebase Auth o Modo Local)
    register: async function (name, email, password, role) {
      name = (name || '').trim();
      email = (email || '').trim().toLowerCase();
      password = (password || '').trim();
      role = role || 'Secretaría Académica POSFACE';

      if (!name || !email || !password) {
        throw new Error("Por favor completa todos los campos requeridos para el registro");
      }

      if (password.length < 6) {
        throw new Error("La contraseña debe tener al menos 6 caracteres");
      }

      // Si Firebase está configurado, registrar en Firebase Authentication
      if (this.isCloudActive()) {
        try {
          const userCredential = await authInstance.createUserWithEmailAndPassword(email, password);
          const fbUser = userCredential.user;

          if (fbUser.updateProfile) {
            await fbUser.updateProfile({ displayName: name });
          }

          if (dbInstance) {
            await dbInstance.collection('usuarios').doc(fbUser.uid).set({
              uid: fbUser.uid,
              name: name,
              email: email,
              role: role,
              institution: "UNAH POSFACE",
              createdAt: new Date().toISOString()
            });
          }

          const userObj = {
            uid: fbUser.uid,
            email: email,
            name: name,
            role: role,
            mode: "firebase"
          };
          localStorage.setItem('posface_session_user', JSON.stringify(userObj));
          return userObj;
        } catch (fbErr) {
          console.error("Error Firebase Register:", fbErr);
          throw new Error(fbErr.message || "Error al crear la cuenta en Firebase");
        }
      }

      // MODO LOCAL: Guardar en lista de usuarios locales
      let usersList = [];
      try {
        const stored = localStorage.getItem('posface_registered_users');
        usersList = stored ? JSON.parse(stored) : [];
      } catch (e) {
        usersList = [];
      }

      if (usersList.some(u => u.email === email)) {
        throw new Error("Este correo institucional ya cuenta con un registro en el sistema");
      }

      const newUser = {
        uid: `USR-${Date.now()}`,
        name: name,
        email: email,
        role: role,
        institution: "UNAH - Ciudad Universitaria",
        createdAt: new Date().toISOString(),
        mode: "local"
      };

      usersList.push(newUser);
      try {
        localStorage.setItem('posface_registered_users', JSON.stringify(usersList));
      } catch (e) {}

      localStorage.setItem('posface_session_user', JSON.stringify(newUser));
      return newUser;
    },

    // Cerrar sesión
    logout: async function () {
      if (this.isCloudActive()) {
        try {
          await authInstance.signOut();
        } catch (e) {
          console.warn("Error cerrando sesión en Firebase:", e);
        }
      }
      localStorage.removeItem('posface_session_user');
      return true;
    },

    // Obtener usuario actualmente conectado
    getCurrentUser: function () {
      try {
        const raw = localStorage.getItem('posface_session_user');
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    // Saber si hay sesión activa
    isAuthenticated: function () {
      return this.getCurrentUser() !== null;
    }
  };

  // ===========================================================================
  // MÓDULO DE BASE DE DATOS FIRESTORE (PosfaceDB)
  // ===========================================================================
  const PosfaceDB = {
    isCloudActive: function () {
      return isFirebaseReady && dbInstance !== null;
    },

    // Obtener o sincronizar lista de estudiantes
    fetchEstudiantes: async function (fallbackList) {
      if (this.isCloudActive()) {
        try {
          const snapshot = await dbInstance.collection('estudiantes').get();
          if (!snapshot.empty) {
            const list = [];
            snapshot.forEach(doc => {
              list.push({ id: doc.id, ...doc.data() });
            });
            return list;
          } else {
            // Si la colección de Firestore está vacía, sincronizar los datos iniciales
            console.log("Inicializando colección 'estudiantes' en Firestore con los datos base...");
            const batch = dbInstance.batch();
            fallbackList.forEach(est => {
              const docRef = dbInstance.collection('estudiantes').doc(est.id || `EST-${Math.random()}`);
              batch.set(docRef, est);
            });
            await batch.commit();
            return fallbackList;
          }
        } catch (dbErr) {
          console.warn("Error leyendo Firestore, usando almacenamiento local:", dbErr);
        }
      }

      // Respaldo en LocalStorage
      try {
        const local = localStorage.getItem('posface_estudiantes_data');
        return local ? JSON.parse(local) : fallbackList;
      } catch (e) {
        return fallbackList;
      }
    },

    // Guardar nuevo estudiante
    addEstudiante: async function (estudiante) {
      if (this.isCloudActive()) {
        try {
          const docRef = dbInstance.collection('estudiantes').doc(estudiante.id);
          await docRef.set(estudiante);
          console.log("Estudiante guardado en Firestore:", estudiante.id);
        } catch (err) {
          console.warn("Error guardando en Firestore:", err);
        }
      }
      // Siempre guardar copia local de seguridad
      try {
        const local = localStorage.getItem('posface_estudiantes_data');
        const list = local ? JSON.parse(local) : [];
        list.unshift(estudiante);
        localStorage.setItem('posface_estudiantes_data', JSON.stringify(list));
      } catch (e) {
        console.warn("Error en respaldo local:", e);
      }
    },

    // Actualizar estado de estudiante
    updateEstadoEstudiante: async function (estId, nuevoEstado, updatedList) {
      if (this.isCloudActive()) {
        try {
          await dbInstance.collection('estudiantes').doc(estId).update({
            estado: nuevoEstado,
            fechaActualizacionEstado: new Date().toISOString()
          });
          console.log(`Estado de ${estId} actualizado en Firestore a: ${nuevoEstado}`);
        } catch (err) {
          console.warn("Error actualizando en Firestore:", err);
        }
      }

      // Guardar en LocalStorage
      try {
        localStorage.setItem('posface_estudiantes_data', JSON.stringify(updatedList));
      } catch (e) {
        console.warn("Error guardando en localStorage:", e);
      }
    },

    // Guardar período académico activo
    savePeriodoActivo: async function (periodo) {
      localStorage.setItem('posface_periodo_activo', periodo);
      if (this.isCloudActive()) {
        try {
          await dbInstance.collection('configuracion').doc('academico').set({
            periodoActual: periodo,
            actualizadoEn: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.warn("Error guardando período en Firestore:", e);
        }
      }
    }
  };

  // Exponer globalmente
  window.PosfaceAuth = PosfaceAuth;
  window.PosfaceDB = PosfaceDB;
})();
