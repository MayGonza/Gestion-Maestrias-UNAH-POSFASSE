// =============================================================================
// SERVICIO DE FIREBASE Y ALMACENAMIENTO HÍBRIDO RESILIENTE - POSFACE UNAH
// Maneja Autenticación (Auth) y Base de Datos (Firestore) con respaldo local continuo
// =============================================================================

(function () {
  let isFirebaseReady = false;
  let authInstance = null;
  let dbInstance = null;

  // 1. Inicialización de Firebase (si las credenciales son válidas y la librería está cargada)
  try {
    if (typeof firebase !== 'undefined' && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      if (!firebase.apps.length) {
        firebase.initializeApp(window.FIREBASE_CONFIG);
      }
      authInstance = firebase.auth();
      dbInstance = firebase.firestore();
      isFirebaseReady = true;
      console.log("%c✓ POSFACE UNAH: Conectado a Firebase Cloud (" + window.FIREBASE_CONFIG.projectId + ")", "color: #059669; font-weight: bold;");
    } else {
      console.log("%cℹ POSFACE UNAH: Ejecutando en Modo Local Administrativo (Listo para enlazar Firebase)", "color: #0284c7; font-weight: bold;");
    }
  } catch (err) {
    console.warn("No se pudo inicializar Firebase Cloud, usando respaldo local continuo:", err);
    isFirebaseReady = false;
  }

  // ===========================================================================
  // MÓDULO DE AUTENTICACIÓN RESILIENTE (PosfaceAuth)
  // ===========================================================================
  const PosfaceAuth = {
    isCloudActive: function () {
      return isFirebaseReady && authInstance !== null;
    },

    friendlyAuthError: function (err) {
      if (!err || !err.code) return err?.message || "Error al autenticar con el sistema.";
      switch (err.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-login-credentials':
          return "Correo o contraseña incorrectos. Verifica tus datos o crea una cuenta en 'Crear cuenta nueva'.";
        case 'auth/email-already-in-use':
          return "Este correo ya está registrado en Firebase. Inicia sesión con tu contraseña.";
        case 'auth/weak-password':
          return "La contraseña debe tener al menos 6 caracteres.";
        case 'auth/invalid-email':
          return "El formato de correo electrónico institucional no es válido.";
        case 'auth/operation-not-allowed':
          return "Aviso: En la consola de Firebase habilita 'Correo/contraseña' en Authentication -> Sign-in method.";
        default:
          return err.message || "Error de autenticación.";
      }
    },

    checkLocalUser: function (email, password) {
      let users = [];
      try {
        const raw = localStorage.getItem('posface_registered_users');
        if (raw) users = JSON.parse(raw);
      } catch (e) {
        users = [];
      }

      // Cuenta demo oficial de la secretaría
      if ((email === 'secretaria.posface@unah.edu.hn' || email === 'posface@unah.edu.hn') && (password === 'posface2026' || password === 'admin2026')) {
        return {
          uid: "posface-admin-01",
          email: email,
          name: "Secretaría Académica POSFACE",
          role: "Secretaría Académica POSFACE",
          institution: "UNAH - Ciudad Universitaria",
          mode: "demo"
        };
      }

      const match = users.find(u => u.email.toLowerCase() === email.toLowerCase() && (!u.password || u.password === password));
      return match || null;
    },

    saveLocalUser: function (user) {
      let users = [];
      try {
        const raw = localStorage.getItem('posface_registered_users');
        if (raw) users = JSON.parse(raw);
      } catch (e) {
        users = [];
      }
      const existingIdx = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
      if (existingIdx >= 0) {
        users[existingIdx] = user;
      } else {
        users.push(user);
      }
      try {
        localStorage.setItem('posface_registered_users', JSON.stringify(users));
      } catch (e) {}
    },

    // Iniciar sesión (Firebase Auth con fallback local transparente)
    login: async function (email, password) {
      email = (email || '').trim().toLowerCase();
      password = (password || '').trim();

      if (!email || !password) {
        throw new Error("Por favor ingresa tu correo y contraseña institucional");
      }

      // 1. Acceso con cuenta de Demostración o Secretaría
      if ((email === 'secretaria.posface@unah.edu.hn' || email === 'posface@unah.edu.hn') && (password === 'posface2026' || password === 'admin2026')) {
        const demoUser = {
          uid: "posface-admin-01",
          email: email,
          name: "Secretaría Académica POSFACE",
          role: "Secretaría Académica POSFACE",
          institution: "UNAH - Ciudad Universitaria",
          mode: "demo"
        };
        localStorage.setItem('posface_session_user', JSON.stringify(demoUser));
        return demoUser;
      }

      // 2. Verificar primero si es un usuario registrado en el sistema local
      const localMatch = this.checkLocalUser(email, password);
      if (localMatch) {
        localStorage.setItem('posface_session_user', JSON.stringify(localMatch));
        if (this.isCloudActive()) {
          authInstance.signInWithEmailAndPassword(email, password).catch(() => {});
        }
        return localMatch;
      }

      // 3. Intentar autenticar con Firebase Authentication si está disponible
      if (this.isCloudActive()) {
        try {
          const userCredential = await authInstance.signInWithEmailAndPassword(email, password);
          const fbUser = userCredential.user;
          const userObj = {
            uid: fbUser.uid,
            email: fbUser.email,
            name: fbUser.displayName || email.split('@')[0].toUpperCase(),
            role: "Secretaría Académica POSFACE",
            mode: "firebase"
          };
          this.saveLocalUser({ ...userObj, password });
          localStorage.setItem('posface_session_user', JSON.stringify(userObj));
          return userObj;
        } catch (fbErr) {
          console.warn("Firebase Auth error:", fbErr);
          throw new Error(this.friendlyAuthError(fbErr));
        }
      }

      // 3. Modo Local: buscar en los usuarios registrados localmente
      const found = this.checkLocalUser(email, password);
      if (found) {
        localStorage.setItem('posface_session_user', JSON.stringify(found));
        return found;
      }

      throw new Error("Credenciales inválidas. Verifica tu correo y contraseña, o regístrate en 'Crear cuenta nueva'.");
    },

    // Registrar nuevo usuario (Guarda tanto en Firebase como en local para garantizar acceso)
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

      const userObj = {
        uid: `USR-${Date.now()}`,
        name: name,
        email: email,
        password: password, // Guardado de respaldo local
        role: role,
        institution: "UNAH - Posgrados FCE",
        createdAt: new Date().toISOString(),
        mode: "local"
      };

      // 1. Guardar de inmediato en local para garantizar que nunca se quede bloqueado
      this.saveLocalUser(userObj);

      // 2. Guardar SIEMPRE en Firestore colección 'usuarios'
      if (this.isCloudActive() && dbInstance) {
        try {
          await dbInstance.collection('usuarios').doc(userObj.uid).set({
            uid: userObj.uid,
            name: name,
            email: email,
            role: role,
            institution: "UNAH POSFACE",
            createdAt: new Date().toISOString()
          });
          console.log("%c✓ POSFACE UNAH: Usuario guardado en Firestore (colección 'usuarios'): " + userObj.uid, "color: #059669; font-weight: bold;");
        } catch (dbErr) {
          console.warn("Firestore usuarios set error:", dbErr);
        }
      }

      // 3. Intentar registrar en Firebase Authentication
      let authWarning = null;
      if (this.isCloudActive() && authInstance) {
        try {
          const userCredential = await authInstance.createUserWithEmailAndPassword(email, password);
          const fbUser = userCredential.user;

          if (fbUser && fbUser.updateProfile) {
            await fbUser.updateProfile({ displayName: name });
          }

          userObj.uid = fbUser.uid;
          userObj.mode = "firebase";
          this.saveLocalUser(userObj);

          if (dbInstance) {
            try {
              await dbInstance.collection('usuarios').doc(fbUser.uid).set({
                uid: fbUser.uid,
                name: name,
                email: email,
                role: role,
                institution: "UNAH POSFACE",
                createdAt: new Date().toISOString()
              });
            } catch (e) {}
          }
        } catch (fbErr) {
          console.warn("Firebase Auth register aviso:", fbErr);
          if (fbErr.code === 'auth/operation-not-allowed') {
            authWarning = "Aviso Firebase: Habilita 'Correo/contraseña' en Authentication -> Sign-in method de Firebase Console para registrar también en Auth.";
          }
        }
      }

      localStorage.setItem('posface_session_user', JSON.stringify(userObj));
      return { ...userObj, authWarning };
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
  // MÓDULO DE BASE DE DATOS FIRESTORE RESILIENTE (PosfaceDB)
  // ===========================================================================
  const PosfaceDB = {
    isCloudActive: function () {
      return isFirebaseReady && dbInstance !== null;
    },

    // Obtener lista completa de estudiantes
    fetchEstudiantes: async function (fallbackList) {
      let currentList = fallbackList || [];
      try {
        const local = localStorage.getItem('posface_estudiantes_data');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentList = parsed;
          }
        }
      } catch (e) {}

      // Intentar sincronizar con Firestore y crear colección si no existe
      if (this.isCloudActive() && dbInstance) {
        try {
          const snapshot = await dbInstance.collection('estudiantes').get();
          if (!snapshot.empty) {
            const cloudList = [];
            snapshot.forEach(doc => {
              cloudList.push({ id: doc.id, ...doc.data() });
            });
            currentList = cloudList;
            localStorage.setItem('posface_estudiantes_data', JSON.stringify(cloudList));
            console.log(`%c✓ POSFACE UNAH: ${cloudList.length} estudiantes sincronizados desde Firestore Cloud`, "color: #059669; font-weight: bold;");
            return cloudList;
          } else {
            console.log("%c✓ POSFACE UNAH: Creando e inicializando colección 'estudiantes' en Firestore...", "color: #0284c7; font-weight: bold;");
            // Guardar estudiantes en Firestore para que la colección quede creada visiblemente
            for (const est of currentList) {
              try {
                await dbInstance.collection('estudiantes').doc(est.id).set(est);
              } catch (err) {}
            }
            console.log("%c✓ Colección 'estudiantes' creada exitosamente en Firestore Cloud", "color: #059669; font-weight: bold;");
            return currentList;
          }
        } catch (dbErr) {
          console.warn("Firestore error al sincronizar estudiantes:", dbErr);
        }
      }

      return currentList;
    },

    // Guardar nuevo estudiante / aspirante
    addEstudiante: async function (estudiante) {
      // 1. Guardar siempre en LocalStorage asegurando no perder la lista base
      try {
        const local = localStorage.getItem('posface_estudiantes_data');
        let list = local ? JSON.parse(local) : (window.POSFASSE_DATA ? [...window.POSFASSE_DATA.estudiantes] : []);
        
        // Evitar duplicados por id
        const idx = list.findIndex(e => e.id === estudiante.id);
        if (idx >= 0) {
          list[idx] = estudiante;
        } else {
          list.unshift(estudiante);
        }
        localStorage.setItem('posface_estudiantes_data', JSON.stringify(list));
      } catch (e) {
        console.warn("Error en respaldo local:", e);
      }

      // 2. Guardar en Firestore Cloud colección 'estudiantes'
      if (this.isCloudActive() && dbInstance) {
        try {
          await dbInstance.collection('estudiantes').doc(estudiante.id).set(estudiante);
          console.log("%c✓ Estudiante guardado en Firestore Cloud (colección 'estudiantes'): " + estudiante.id, "color: #059669; font-weight: bold;");
        } catch (err) {
          console.error("Firestore error al guardar estudiante en la nube:", err);
        }
      }

      // Notificar a otras ventanas o pestañas
      try {
        window.dispatchEvent(new CustomEvent('posface_estudiante_agregado', { detail: estudiante }));
      } catch (e) {}

      return estudiante;
    },

    // Actualizar estado de estudiante
    updateEstadoEstudiante: async function (estId, nuevoEstado, updatedList) {
      // Guardar en LocalStorage
      try {
        localStorage.setItem('posface_estudiantes_data', JSON.stringify(updatedList));
      } catch (e) {
        console.warn("Error guardando en localStorage:", e);
      }

      // Actualizar en Firestore
      if (this.isCloudActive()) {
        try {
          await dbInstance.collection('estudiantes').doc(estId).update({
            estado: nuevoEstado,
            fechaActualizacionEstado: new Date().toISOString()
          });
          console.log(`✓ Estado de ${estId} actualizado en Firestore a: ${nuevoEstado}`);
        } catch (err) {
          console.warn("Error actualizando en Firestore:", err);
        }
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
