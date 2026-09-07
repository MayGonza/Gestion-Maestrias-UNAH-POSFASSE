# Sistema Administrativo y Control Escolar de Posgrados (POSFACE · UNAH)

![UNAH POSFACE](logo-unah.png)

> **Universidad Nacional Autónoma de Honduras (UNAH)**  
> **Facultad de Ciencias Económicas, Administrativas y Contables**  
> **Dirección del Sistema de Posgrados de la Facultad de Ciencias Económicas (POSFACE)**  
> *Ciudad Universitaria «José Trinidad Reyes» · Tegucigalpa, M.D.C., Honduras*

---

## 📋 Resumen Ejecutivo

Este sistema constituye la plataforma tecnológica institucional para la gestión, control escolar, matrícula y seguimiento administrativo de los programas de posgrado (Maestrías y Doctorados) adscritos a la **Dirección de Posgrados de la Facultad de Ciencias Económicas (POSFACE - UNAH)**.

La plataforma ha sido desarrollada con un estándar visual corporativo de alta gama, alineado a la identidad gráfica institucional de la UNAH (Azul Naval `#002855` y Dorado `#F0B323`), implementando control de acceso, cumplimiento normativo del Consejo de Educación Superior (CES) y preparación nativa para persistencia en **Google Firebase / Cloud Firestore**.

---

## 🏛️ Características Principales

### 1. Sistema de Autenticación Institucional (Login y Registro)
* **Control de Acceso Seguro**: Pantalla de autenticación institucional para personal administrativo, coordinadores de maestría y secretaría académica.
* **Módulo de Registro**: Creación de cuentas con asignación de roles institucionales (*Secretaría Académica*, *Coordinador de Posgrado*, *Dirección*, *Asistente Técnico*).
* **Arquitectura Híbrida**: Opera en **Modo Local** de inmediato (con usuario demo `secretaria.posface@unah.edu.hn`) y se enlaza automáticamente a **Firebase Authentication** al configurar las credenciales.
* **Cierre de Sesión Seguro**: Botón dedicado de Logout en el sidebar con limpieza de sesión y estado reactivo.

### 2. Panel General de Control (Dashboard Analítico)
* **Métricas en Tiempo Real**: Total de estudiantes matriculados, programas activos y diversidad de centros de egreso universitarios.
* **Índice Pregrado Promedio**: Indicador de rendimiento académico de ingreso conforme a la normativa UNAH ($\ge 70.00\%$).
* **Distribución por Programa**: Gráficos de distribución porcentual de alumnos matriculados por posgrado.
* **Distribución por Universidad de Procedencia**: Clasificación por centro universitario de origen (UNAH, UNITEC, CEUTEC, UTH, UPNFM, UNICAH, USAP, Internacionales).

### 3. Directorio de Estudiantes y Control Escolar
* **Listado Centralizado**: Visualización administrativa sin elementos superfluos, enfocada exclusivamente en el expediente del alumno.
* **Búsqueda Multicriterio**: Filtrado en tiempo real por número de cuenta UNAH, número de identidad (DNI), nombre completo o universidad de procedencia.
* **Filtros Avanzados**: Por programa de maestría, centro universitario de origen y estado académico.
* **Gestión de Estados**: Selector interactivo directo por fila con codificación de colores institucionales:
  * 🟢 **Activo**
  * 🟡 **En Tesis**
  * 🟠 **Egresado**
  * 🔵 **Graduado**
  * ⚪ **Inactivo / Retirado**

### 4. Expediente Académico y Constancia Oficial de Matrícula
* **Ficha del Alumno**: Datos personales, cuenta UNAH, DNI, correo institucional y antecedentes académicos de pregrado.
* **Línea de Tesis**: Registro y visualización del tema o proyecto de graduación y tutor metodológico asignado.
* **Impresión de Calidad Oficial**: Al presionar *"Imprimir Ficha Oficial"*, el sistema aísla exclusivamente la constancia con membrete institucional de la UNAH, sello de secretaría académica, firmas de conformidad y control de período activo, eliminando la interfaz web y la tabla de fondo.

### 5. Matrícula y Admisión Normativa
* Formulario completo de nuevo aspirante que valida:
  * Número de cuenta UNAH único.
  * DNI / Identidad oficial de Honduras.
  * Universidad de procedencia (Pregrado) y carrera previa.
  * Índice académico de graduación previa (validación normativa $\ge 70\%$).
  * Proyecto preliminar de tesis y tutor asignado.

### 6. Control del Período Académico Activo
* Selector interactivo en la barra superior (*topbar*) para conmutar entre períodos (*I PAC, II PAC, III PAC*).
* Botón para ingresar períodos personalizados con persistencia inmediata y sincronización en constancias impresas.

### 7. Exportación de Reportes Administrativos (CSV / Excel)
* Descarga inmediata de la matrícula general en formato compatible con Microsoft Excel y hojas de cálculo, con codificación UTF-8 con BOM para caracteres en español.

---

## 📁 Estructura del Directorio

```text
Gestion-Maestrias-UNAH-POSFASSE/
├── index.html                  # Estructura semántica HTML5 modular del sistema
├── README.md                   # Documentación técnica y manual de administración
├── logo-unah.png               # Escudo e identidad gráfica oficial UNAH
├── serve.js                    # Servidor local de desarrollo HTTP (Node.js)
├── css/
│   └── styles.css              # Sistema de diseño, tokens, componentes y reglas de impresión
├── js/
│   ├── firebase-config.js      # Configuración de credenciales de Google Firebase
│   ├── firebase-service.js     # Capa de servicios para Firebase Auth y Cloud Firestore
│   ├── mock-data.js            # Catálogo oficial de maestrías POSFACE y datos base
│   └── app.js                  # Lógica del controlador, reactividad y eventos del DOM
└── assets/
    └── logo-unah.png           # Respaldo de recursos estáticos institucionales
```

---

## ⚙️ Conexión a Base de Datos (Google Firebase / Firestore)

El proyecto incluye una arquitectura híbrida desacoplada. Para activar la persistencia en la nube:

1. **Crear Proyecto**: Ingresa a [console.firebase.google.com](https://console.firebase.google.com/) y crea un nuevo proyecto (ej. `posface-unah`).
2. **Registrar App Web**: Haz clic en el ícono `</>` para registrar una aplicación Web.
3. **Copiar Credenciales**: Abre el archivo `js/firebase-config.js` y pega tus credenciales:
   ```javascript
   window.FIREBASE_CONFIG = {
     apiKey: "AIzaSyD-TU_API_KEY_REAL",
     authDomain: "posface-unah.firebaseapp.com",
     projectId: "posface-unah",
     storageBucket: "posface-unah.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef123456"
   };
   ```
4. **Habilitar Servicios en Firebase Console**:
   * **Authentication**: En *Sign-in method*, habilita el proveedor **Correo electrónico / Contraseña**.
   * **Cloud Firestore**: Ve a *Firestore Database* y haz clic en **Crear base de datos** (modo producción o prueba).
5. **Listo**: Al recargar la aplicación, el badge de estado mostrará:
   `🟢 Conectado a Firebase Cloud Database`.

---

## 🚀 Despliegue y Ejecución Local

### Opción A: Servidor Node.js Integrado (Recomendado)
```bash
# Iniciar servidor local en el puerto 3000
node serve.js
```
Accede desde tu navegador a: **`http://localhost:3000`**

### Opción B: Ejecución Directa en Navegador
Haz doble clic en `index.html` para abrirlo directamente en Google Chrome, Microsoft Edge o Mozilla Firefox.

---

## 📜 Normativa Institucional Aplicada

* **Reglamento de Posgrados de la UNAH**:
  * Índice académico mínimo de admisión a maestrías y doctorados: **70.00%**.
  * Requisito de formulación de trabajo de graduación / tesis y asesor metodológico asignado.
* **Consejo de Educación Superior (CES)**:
  * Oferta de 10 programas oficiales de posgrado evaluados y reconocidos en el catálogo oficial de la UNAH.

---

*Desarrollado para la Secretaría Académica de Posgrados · POSFACE UNAH.*
