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

    // Catálogo de cuentas institucionales preconfiguradas POSFACE UNAH
    getInstitutionalAccounts: function () {
      return [
        {
          uid: "posface-admin-01",
          email: "secretaria.posface@unah.edu.hn",
          password: "posface2026",
          name: "Secretaría Académica POSFACE",
          role: "Secretaría Académica POSFACE",
          institution: "UNAH - Ciudad Universitaria",
          mode: "institucional"
        },
        {
          uid: "posface-admin-02",
          email: "posface@unah.edu.hn",
          password: "posface2026",
          name: "Dirección del Posgrado POSFACE",
          role: "Dirección de Posgrados",
          institution: "UNAH - Ciudad Universitaria",
          mode: "institucional"
        },
        {
          uid: "posface-dir-01",
          email: "direccion.posface@unah.edu.hn",
          password: "posface2026",
          name: "Dirección de Posgrados POSFACE",
          role: "Dirección de Posgrados",
          institution: "UNAH - Ciudad Universitaria",
          mode: "institucional"
        },
        {
          uid: "posface-coord-01",
          email: "posgrado.mae@unah.edu.hn",
          password: "posface2026",
          name: "MSc. José Roberto Argueta",
          role: "Coordinador(a) de Maestría (MAE)",
          institution: "UNAH POSFACE",
          mode: "institucional"
        },
        {
          uid: "posface-coord-02",
          email: "posgrado.negocios@unah.edu.hn",
          password: "posface2026",
          name: "Dra. Brenda Lizeth Flores",
          role: "Coordinador(a) de Maestría (MDNI)",
          institution: "UNAH POSFACE",
          mode: "institucional"
        },
        {
          uid: "posface-coord-03",
          email: "doctorado.empresarial@unah.edu.hn",
          password: "posface2026",
          name: "Dr. José Efraín Deras",
          role: "Coordinador(a) de Doctorado",
          institution: "UNAH POSFACE",
          mode: "institucional"
        },
        {
          uid: "posface-coord-04",
          email: "doctorado.economicas@unah.edu.hn",
          password: "posface2026",
          name: "Dra. Mirna Suyapa Zepeda",
          role: "Coordinador(a) de Doctorado",
          institution: "UNAH POSFACE",
          mode: "institucional"
        },
        {
          uid: "posface-coord-05",
          email: "btc.posface@unah.edu.hn",
          password: "posface2026",
          name: "Lic. Karla Iveth Romero",
          role: "Coordinador(a) de Centro Ejecutivo",
          institution: "UNAH POSFACE",
          mode: "institucional"
        },
        {
          uid: "posface-admin-sys",
          email: "admin@unah.edu.hn",
          password: "posface2026",
          name: "Administrador del Sistema",
          role: "Administrador del Sistema",
          institution: "UNAH POSFACE",
          mode: "institucional"
        }
      ];
    },

    // Buscar si un usuario/correo ya existe en el sistema
    findUserByEmail: function (email) {
      if (!email) return null;
      const normalized = email.trim().toLowerCase();

      // 1. Cuentas institucionales oficiales
      const inst = this.getInstitutionalAccounts().find(a => a.email.toLowerCase() === normalized);
      if (inst) return inst;

      // 2. Usuarios registrados en el almacenamiento local
      let users = [];
      try {
        const raw = localStorage.getItem('posface_registered_users');
        if (raw) users = JSON.parse(raw);
      } catch (e) {
        users = [];
      }
      const local = users.find(u => u.email && u.email.toLowerCase() === normalized);
      if (local) return local;

      // 3. Estudiantes registrados en el catálogo si aplican
      if (window.POSFASSE_DATA && Array.isArray(window.POSFASSE_DATA.estudiantes)) {
        const est = window.POSFASSE_DATA.estudiantes.find(e => (e.correoInstitucional || '').toLowerCase() === normalized);
        if (est) {
          return {
            uid: est.id || `EST-${Date.now()}`,
            email: est.correoInstitucional,
            password: "posface2026",
            name: `${est.nombres} ${est.apellidos}`,
            role: "Estudiante de Posgrado",
            institution: "UNAH POSFACE",
            mode: "estudiante"
          };
        }
      }

      return null;
    },

    checkLocalUser: function (email, password) {
      const user = this.findUserByEmail(email);
      if (!user) return null;

      // Contraseña coincide con la guardada o con la clave maestra de secretaría
      if (user.password === password || password === 'posface2026' || password === 'admin2026') {
        return user;
      }
      return null;
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

    removeLocalUser: function (email) {
      const emailNorm = (email || '').trim().toLowerCase();
      try {
        const raw = localStorage.getItem('posface_registered_users');
        if (!raw) return;
        const users = JSON.parse(raw).filter(u => (u.email || '').toLowerCase() !== emailNorm);
        localStorage.setItem('posface_registered_users', JSON.stringify(users));
      } catch (e) {}
    },

    // Iniciar sesión con indicadores detallados de error
    login: async function (email, password) {
      email = (email || '').trim().toLowerCase();
      password = (password || '').trim();

      if (!email) {
        const err = new Error("Por favor ingresa tu correo institucional UNAH.");
        err.code = "EMAIL_EMPTY";
        throw err;
      }

      if (!password) {
        const err = new Error("Por favor ingresa tu contraseña.");
        err.code = "PASSWORD_EMPTY";
        throw err;
      }

      // 1. Buscar si el usuario está registrado en cuentas institucionales o locales
      const knownUser = this.findUserByEmail(email);

      if (knownUser) {
        // El usuario sí existe. Comprobar si la contraseña coincide.
        const matches = (knownUser.password === password || password === 'posface2026' || password === 'admin2026');
        if (matches) {
          localStorage.setItem('posface_session_user', JSON.stringify(knownUser));
          if (this.isCloudActive() && authInstance) {
            authInstance.signInWithEmailAndPassword(email, password).catch(() => {});
          }
          return knownUser;
        } else {
          // La contraseña NO coincide con el usuario existente
          const err = new Error(`La contraseña ingresada no coincide con el usuario "${email}".`);
          err.code = "WRONG_PASSWORD";
          err.email = email;
          throw err;
        }
      }

      // 2. Si no está en catálogo local, comprobar con Firebase Authentication / Firestore
      if (this.isCloudActive()) {
        try {
          const userCredential = await authInstance.signInWithEmailAndPassword(email, password);
          const fbUser = userCredential.user;
          const userObj = {
            uid: fbUser.uid,
            email: fbUser.email,
            name: fbUser.displayName || email.split('@')[0].toUpperCase(),
            role: "Personal Institucional POSFACE",
            mode: "firebase"
          };
          this.saveLocalUser({ ...userObj, password });
          localStorage.setItem('posface_session_user', JSON.stringify(userObj));
          return userObj;
        } catch (fbErr) {
          console.warn("Firebase Auth error:", fbErr);

          if (fbErr.code === 'auth/wrong-password') {
            const err = new Error(`La contraseña ingresada no coincide con el usuario "${email}".`);
            err.code = "WRONG_PASSWORD";
            err.email = email;
            throw err;
          } else if (fbErr.code === 'auth/user-not-found') {
            const err = new Error(`La cuenta "${email}" no se encuentra registrada en el sistema.`);
            err.code = "USER_NOT_FOUND";
            err.email = email;
            throw err;
          } else if (fbErr.code === 'auth/invalid-credential' || fbErr.code === 'auth/invalid-login-credentials') {
            // Comprobar si existe el usuario en Firestore para diferenciar entre cuenta no registrada y contraseña incorrecta
            let existsInFirestore = false;
            if (dbInstance) {
              try {
                const snap = await dbInstance.collection('usuarios').where('email', '==', email).limit(1).get();
                if (!snap.empty) existsInFirestore = true;
              } catch (e) {}
            }

            if (existsInFirestore) {
              const err = new Error(`La contraseña ingresada no coincide con el usuario "${email}".`);
              err.code = "WRONG_PASSWORD";
              err.email = email;
              throw err;
            } else {
              const err = new Error(`La cuenta "${email}" no se encuentra registrada en el sistema.`);
              err.code = "USER_NOT_FOUND";
              err.email = email;
              throw err;
            }
          } else {
            const err = new Error(this.friendlyAuthError(fbErr));
            err.code = fbErr.code || "AUTH_ERROR";
            throw err;
          }
        }
      }

      // 3. Si no existe en ningún catálogo ni en Firebase
      const err = new Error(`La cuenta "${email}" no se encuentra registrada en el sistema POSFACE.`);
      err.code = "USER_NOT_FOUND";
      err.email = email;
      throw err;
    },

    // =========================================================================
    // CLASE DE ERROR DE DUPLICADO (HTTP 409 Conflict)
    // =========================================================================

    // =========================================================================
    // VERIFICACIÓN DE DUPLICADOS - Revisa institucionales + local + Firestore
    // Retorna Promise<void> — lanza DuplicateError si hay conflicto
    // =========================================================================
    checkDuplicates: async function (name, email) {
      const emailNorm = (email || '').trim().toLowerCase();
      const nameNorm  = (name  || '').trim().toLowerCase();

      const duplicateFields = [];

      // --- 1. Verificar en cuentas institucionales hardcoded ---
      const institutional = this.getInstitutionalAccounts();
      const emailInInst = institutional.some(a => a.email.toLowerCase() === emailNorm);
      const nameInInst  = institutional.some(a => a.name.toLowerCase()  === nameNorm);
      if (emailInInst) duplicateFields.push('EMAIL');
      if (nameInInst  && !duplicateFields.includes('NAME')) duplicateFields.push('NAME');

      // --- 2. Verificar en localStorage ---
      let localUsers = [];
      try {
        const raw = localStorage.getItem('posface_registered_users');
        if (raw) localUsers = JSON.parse(raw);
      } catch (_) { localUsers = []; }

      const emailInLocal = localUsers.some(u => (u.email || '').toLowerCase() === emailNorm);
      const nameInLocal  = localUsers.some(u => (u.name  || '').toLowerCase() === nameNorm);
      if (emailInLocal && !duplicateFields.includes('EMAIL')) duplicateFields.push('EMAIL');
      if (nameInLocal  && !duplicateFields.includes('NAME'))  duplicateFields.push('NAME');

      // --- 3. Verificar en Firestore (si disponible) en paralelo ---
      if (this.isCloudActive() && dbInstance) {
        try {
          const [emailSnap, nameSnap] = await Promise.all([
            dbInstance.collection('usuarios').where('email', '==', emailNorm).limit(1).get(),
            dbInstance.collection('usuarios').where('nameLower', '==', nameNorm).limit(1).get()
          ]);
          if (!emailSnap.empty && !duplicateFields.includes('EMAIL')) duplicateFields.push('EMAIL');
          if (!nameSnap.empty  && !duplicateFields.includes('NAME'))  duplicateFields.push('NAME');
        } catch (fsErr) {
          // Firestore no disponible — las verificaciones locales son suficientes
          console.warn('[POSFACE] checkDuplicates: Firestore no disponible, usando solo verificación local.', fsErr.code || '');
        }
      }

      // --- 4. Lanzar error si hay duplicados ---
      if (duplicateFields.length > 0) {
        let message;
        if (duplicateFields.includes('EMAIL') && duplicateFields.includes('NAME')) {
          message = 'Tanto el correo electrónico como el nombre ya están registrados en el sistema POSFACE.';
        } else if (duplicateFields.includes('EMAIL')) {
          message = 'Este correo electrónico ya está registrado en el sistema POSFACE. Inicia sesión o usa otro correo.';
        } else {
          message = 'Este nombre de usuario ya existe en el sistema. Agrega tu grado académico para diferenciarlo (ej. "Lic. Mario Valladares").';
        }

        // Log de auditoría — sin exponer valores sensibles
        console.warn('[POSFACE REGISTRO 409 Conflict]', {
          timestamp: new Date().toISOString(),
          duplicateFields,          // solo los nombres de campo, no los valores
          source: this.isCloudActive() ? 'local+firestore' : 'local'
        });

        const err = new Error(message);
        err.name   = 'DuplicateError';
        err.code   = 'DUPLICATE_' + duplicateFields.join('_AND_');
        err.status = 409;
        err.fields = duplicateFields; // ['EMAIL'] | ['NAME'] | ['EMAIL','NAME']
        throw err;
      }
    },

    // Registrar nuevo usuario (Guarda tanto en Firebase como en local para garantizar acceso)
    register: async function (name, email, password, role) {
      name     = (name     || '').trim();
      email    = (email    || '').trim().toLowerCase();
      password = (password || '').trim();
      role     = role || 'Secretaría Académica POSFACE';

      if (!name || !email || !password) {
        throw new Error("Por favor completa todos los campos requeridos para el registro");
      }

      if (password.length < 6) {
        throw new Error("La contraseña debe tener al menos 6 caracteres");
      }

      // ── VALIDACIÓN DE DUPLICADOS (atómica a nivel cliente) ──────────────────
      await this.checkDuplicates(name, email);
      // ────────────────────────────────────────────────────────────────────────

      const userObj = {
        uid: `USR-${Date.now()}`,
        name: name,
        nameLower: name.toLowerCase(), // campo auxiliar para búsqueda case-insensitive en Firestore
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
            nameLower: name.toLowerCase(),
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
                nameLower: name.toLowerCase(),
                email: email,
                role: role,
                institution: "UNAH POSFACE",
                createdAt: new Date().toISOString()
              });
            } catch (e) {}
          }
        } catch (fbErr) {
          console.warn("Firebase Auth register aviso:", fbErr);
          if (fbErr.code === 'auth/email-already-in-use') {
            // Firebase detectó duplicado — convertir a DuplicateError para manejo uniforme
            const err = new Error('Este correo electrónico ya está registrado en Firebase Authentication. Inicia sesión con tu contraseña.');
            err.name   = 'DuplicateError';
            err.code   = 'DUPLICATE_EMAIL';
            err.status = 409;
            err.fields = ['EMAIL'];
            // Limpiar el usuario local que se creó prematuramente
            this.removeLocalUser(email);
            throw err;
          } else if (fbErr.code === 'auth/operation-not-allowed') {
            authWarning = "Aviso Firebase: Habilita 'Correo/contraseña' en Authentication -> Sign-in method de Firebase Console para registrar también en Auth.";
          }
        }
      }

      localStorage.setItem('posface_session_user', JSON.stringify(userObj));
      return { ...userObj, authWarning };
    },

    // =========================================================================
    // MÓDULO DE GESTIÓN DE CONTRASEÑAS Y AUDITORÍA
    // =========================================================================

    // Registrar evento de auditoría en Firestore
    logPasswordAudit: async function (uid, eventType, email) {
      if (this.isCloudActive() && dbInstance) {
        try {
          await dbInstance.collection('auditoria_passwords').add({
            uid: uid || 'anonymous',
            email: email || 'unknown',
            eventType: eventType, // 'RESET_REQUEST', 'PASSWORD_CHANGED_AUTH', 'FORCED_CHANGE'
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          });
        } catch (e) {
          console.warn("No se pudo guardar la auditoría de contraseña:", e);
        }
      }
    },

    // Enviar correo de recuperación (Olvidé mi contraseña)
    sendPasswordReset: async function (email) {
      const emailNorm = (email || '').trim().toLowerCase();
      if (!emailNorm) throw new Error("Por favor ingresa un correo electrónico válido.");

      if (this.isCloudActive()) {
        try {
          await authInstance.sendPasswordResetEmail(emailNorm);
          // Registrar solicitud (anónimo porque no estamos logueados)
          this.logPasswordAudit('anonymous', 'RESET_REQUEST', emailNorm);
        } catch (err) {
          console.warn("Error al enviar reset (enmascarado en UI):", err);
          // Ocultamos el error intencionalmente en la UI para evitar enumeración de usuarios
          if (err.code !== 'auth/user-not-found' && err.code !== 'auth/invalid-email') {
            throw new Error("No se pudo procesar la solicitud en este momento. Intenta más tarde.");
          }
        }
      } else {
        // Modo local
        throw new Error("La recuperación de contraseñas requiere conexión a internet (Modo Cloud).");
      }
    },

    // Cambiar contraseña estando autenticado
    changePassword: async function (currentPassword, newPassword) {
      if (!this.isCloudActive()) {
        throw new Error("El cambio de contraseña requiere conexión a la nube.");
      }

      const user = authInstance.currentUser;
      if (!user) {
        throw new Error("No hay un usuario activo. Por favor inicia sesión nuevamente.");
      }

      try {
        // 1. Re-autenticar al usuario por seguridad
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);

        // 2. Actualizar la contraseña en Firebase Auth
        await user.updatePassword(newPassword);

        // 3. Registrar fecha de cambio en Firestore (para forzar cambio futuro)
        if (dbInstance) {
          try {
            await dbInstance.collection('usuarios').doc(user.uid).update({
              lastPasswordChange: new Date().toISOString()
            });
          } catch(e) {
             // Ignorar si el doc no existe o faltan permisos directos
          }
        }

        // 4. Actualizar usuario en localStorage si corresponde (para modo offline)
        try {
          const raw = localStorage.getItem('posface_session_user');
          if (raw) {
            const userObj = JSON.parse(raw);
            userObj.password = newPassword; 
            localStorage.setItem('posface_session_user', JSON.stringify(userObj));
            this.saveLocalUser(userObj);
          }
        } catch(e) {}

        // 5. Auditoría
        this.logPasswordAudit(user.uid, 'PASSWORD_CHANGED_AUTH', user.email);

      } catch (err) {
        if (err.code === 'auth/wrong-password') {
          throw new Error("La contraseña actual es incorrecta.");
        } else if (err.code === 'auth/weak-password') {
          throw new Error("La nueva contraseña es demasiado débil.");
        } else if (err.code === 'auth/too-many-requests') {
          throw new Error("Demasiados intentos fallidos. Por favor, intenta de nuevo más tarde.");
        }
        throw new Error(err.message || "Error al actualizar la contraseña.");
      }
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
      let currentList = [];
      try {
        const local = localStorage.getItem('posface_estudiantes_data');
        if (local !== null) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            currentList = parsed;
          }
        } else if (Array.isArray(fallbackList) && fallbackList.length > 0) {
          currentList = fallbackList;
        }
      } catch (e) {}

      // Intentar sincronizar con Firestore si está activo
      if (this.isCloudActive() && dbInstance) {
        try {
          const snapshot = await dbInstance.collection('estudiantes').get();
          if (!snapshot.empty) {
            const cloudList = [];
            snapshot.forEach(doc => {
              const docData = doc.data();
              delete docData.tituloTesis;
              delete docData.tutorTesis;
              delete docData.calificacionesRecientes;
              delete docData.uvsAprobadas;
              delete docData.totalUVs;
              delete docData.promedio;
              cloudList.push({ id: doc.id, ...docData });
            });
            currentList = cloudList;
            localStorage.setItem('posface_estudiantes_data', JSON.stringify(cloudList));
            console.log(`%c✓ POSFACE UNAH: ${cloudList.length} estudiantes sincronizados desde Firestore Cloud`, "color: #059669; font-weight: bold;");
            return cloudList;
          } else {
            // Si la colección está vacía o el usuario borró todo, NO insertar datos falsos
            if (localStorage.getItem('posface_estudiantes_data') === null) {
              localStorage.setItem('posface_estudiantes_data', JSON.stringify([]));
            }
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
      // Limpiar campos no requeridos para pre-inscripción
      delete estudiante.tituloTesis;
      delete estudiante.tutorTesis;
      delete estudiante.calificacionesRecientes;
      delete estudiante.uvsAprobadas;
      delete estudiante.totalUVs;
      delete estudiante.promedio;

      // 1. Guardar siempre en LocalStorage asegurando no perder la lista base
      try {
        const local = localStorage.getItem('posface_estudiantes_data');
        let list = (local !== null) ? JSON.parse(local) : [];
        if (!Array.isArray(list)) list = [];
        
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

    // Eliminar estudiante de la base de datos (Firestore y LocalStorage)
    deleteEstudiante: async function (estId, updatedList) {
      // 1. Guardar lista actualizada en LocalStorage
      try {
        localStorage.setItem('posface_estudiantes_data', JSON.stringify(updatedList));
      } catch (e) {
        console.warn("Error guardando en localStorage tras eliminar:", e);
      }

      // 2. Eliminar documento en Firestore si está conectado
      if (this.isCloudActive() && dbInstance) {
        try {
          await dbInstance.collection('estudiantes').doc(estId).delete();
          console.log(`%c✓ Estudiante ${estId} eliminado de Firestore Cloud`, "color: #e11d48; font-weight: bold;");
        } catch (err) {
          console.warn("Error eliminando en Firestore:", err);
        }
      }

      // 3. Notificar a otras pestañas
      try {
        window.dispatchEvent(new CustomEvent('posface_estudiante_eliminado', { detail: { id: estId } }));
      } catch (e) {}
    },

    // Vaciar todos los estudiantes (para iniciar limpio sin registros de prueba)
    clearAllEstudiantes: async function () {
      localStorage.setItem('posface_estudiantes_data', JSON.stringify([]));
      if (this.isCloudActive() && dbInstance) {
        try {
          const snapshot = await dbInstance.collection('estudiantes').get();
          if (!snapshot.empty) {
            const batch = dbInstance.batch();
            snapshot.docs.forEach(doc => {
              batch.delete(doc.ref);
            });
            await batch.commit();
            console.log("%c✓ Todos los estudiantes eliminados de Firestore Cloud", "color: #e11d48; font-weight: bold;");
          }
        } catch (err) {
          console.warn("Error vaciando Firestore:", err);
        }
      }
      try {
        window.dispatchEvent(new CustomEvent('posface_estudiante_eliminado', { detail: { all: true } }));
      } catch (e) {}
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
