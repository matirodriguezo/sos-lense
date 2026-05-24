# Guía de Configuración — S.O.S. Carabineros

Guía paso a paso para preparar el entorno de desarrollo desde cero en VS Code.

---

## 1. Requisitos Previos

| Herramienta | Versión Mínima | Verificación |
|---|---|---|
| Node.js | 18 LTS o superior | `node -v` |
| npm | 9+ | `npm -v` |
| Expo CLI | 54.x | `npx expo --version` |
| Expo Go app | Última de Play/App Store | Instalada en tu celular |

### Instalación rápida

**Node.js:** https://nodejs.org (versión LTS 18.x o 20.x) — marcar "Add to PATH".

**Expo Go:** Google Play o App Store en tu celular físico.

---

## 2. Abrir Proyecto en VS Code

1. VS Code → `Ctrl+K Ctrl+O` → seleccionar la carpeta del proyecto.
2. Terminal integrada: `` Ctrl+` ``.
3. Verificar: `node -v && npm -v`.

---

## 3. Inicializar Proyecto Expo

```bash
npx create-expo-app@latest . --template blank
```

Si pide permiso para sobrescribir archivos existentes, responde que **no** y usa `npx create-expo-app@latest sos-app --template blank` en una carpeta nueva, o vacía el directorio primero.

> **Importante:** Usa la opción **"For learning with Expo Go (SDK 54)"** cuando te pregunte. SDK 56+ aún no es compatible con Expo Go en todos los dispositivos.

---

## 4. Instalar Dependencias

```bash
# Navegación
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context

# Firebase (Auth + Firestore)
npx expo install firebase

# Ubicación GPS
npx expo install expo-location

# SDK de videollamada (elegir UNO)
npx expo install @zegocloud/zego-uikit-prebuilt-call-rn @zegocloud/zego-uikit-rn
# o
npx expo install react-native-agora
```

---

## 5. Configurar Firebase

### 5.1 Crear proyecto en Firebase Console

1. Ve a https://console.firebase.google.com → **Crear proyecto**.
2. Nombre: `sos-carabineros` → Desactivar Analytics → **Crear**.

### 5.2 Obtener credenciales Web

1. En la vista general del proyecto, haz clic en el ícono **Web** (`</>`).
2. Sobrenombre: `sos-carabineros-web` → **Registrar app**.
3. **Copia el objeto `firebaseConfig`** que aparece en pantalla.

### 5.3 Pegar credenciales en el proyecto

Abre `src/firebase/firebaseConfig.js` y reemplaza todo el objeto `firebaseConfig` con el que copiaste.

### 5.4 Activar Authentication

Firebase Console → **Authentication** → **Sign-in method** → Habilitar **Correo electrónico/contraseña** → Guardar.

### 5.5 Crear Firestore

Firebase Console → **Firestore Database** → **Crear base de datos** → **Modo de prueba** → Elegir ubicación `southamerica-east1` (o `us-central1`) → **Activar**.

---

## 6. Estructura del Proyecto

```
Proyecto_Carabineros/
├── App.js                          # Entry point con NavigationContainer
├── SETUP_GUIDE.md                  # Esta guía
├── app.json                        # Config Expo
├── package.json
├── assets/
│   ├── icon.png
│   ├── splash-icon.png
│   └── adaptive-icon.png
└── src/
    ├── constants/
    │   └── roles.js                # Enumeraciones (ROLES, STATUS, TYPES)
    ├── firebase/
    │   └── firebaseConfig.js       # Inicialización Firebase Auth + Firestore
    ├── navigation/
    │   ├── AppNavigator.js         # Ruteo condicional por rol
    │   ├── AuthStack.js            # Stack de Login
    │   ├── CitizenStack.js         # Stack del ciudadano
    │   └── OfficerStack.js         # Stack del operador
    ├── screens/
    │   ├── auth/
    │   │   └── LoginScreen.js      # Login / Registro
    │   ├── citizen/
    │   │   ├── HomeScreen.js       # Botón S.O.S con GPS
    │   │   ├── ClassificationScreen.js  # Grilla de tipos
    │   │   └── VideoCallScreen.js  # Videollamada + chat + respuestas rápidas
    │   └── officer/
    │       ├── DispatchPanelScreen.js      # onSnapshot incidentes activos
    │       ├── IncidentManagementScreen.js # Gestión + videollamada
    │       └── CloseIncidentScreen.js      # Cierre con observaciones
    └── services/
        └── incidentService.js      # triggerSOS, listenActiveIncidents, etc.
```

---

## 7. Ejecutar la App

```bash
npx expo start
```

1. Escanea el código QR con **Expo Go** en tu celular.
2. La app carga automáticamente.
3. **Regístrate** con un correo cualquiera → rol ciudadano por defecto.
4. Para probar rol oficial, ve a Firebase → Firestore → colección `users` → crea documento con el UID del usuario y campo `role: "OFFICER"`.

### Solución de problemas

| Problema | Solución |
|---|---|
| "Project is incompatible with this version of Expo Go" | El proyecto usa SDK 56+. Recrea con SDK 54. |
| Error de conexión Firebase | Verifica credenciales en `firebaseConfig.js` |
| GPS no funciona | Acepta permisos de ubicación en el celular |

---

## 8. Estructura de Datos en Firestore

### Colección `users`
```
uid (String, Auth ID)
├── email: "user@mail.com"
├── role: "CITIZEN" | "OFFICER"
└── rut: "12.345.678-9" (opcional)
```

### Colección `incidents`
```
id (auto-generado)
├── citizenId: "uid_del_ciudadano"
├── officerId: "uid_del_operador" | null
├── status: "NO_CLASIFICADO" | "ACTIVO" | "EN_CURSO" | "CERRADO"
├── type: "Por definir" | "ROBO" | "VIOLENCIA" | "ACCIDENTE" | "OTRO"
├── location: GeoPoint(lat, lng)
├── latitude: number
├── longitude: number
├── quick_requests: string
├── observations: string
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

### Subcolección `incidents/{id}/messages`
```
id (auto-generado)
├── text: string
├── senderId: string
├── senderRole: "CITIZEN" | "OFFICER"
└── createdAt: Timestamp
```
