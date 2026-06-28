# Guía de Configuración — S.O.S. Carabineros

Guía paso a paso para preparar el entorno de desarrollo desde cero en VS Code.

---

## 1. Requisitos Previos

| Herramienta | Versión Mínima | Verificación |
|---|---|---|
| Node.js | 20 LTS o superior | `node -v` |
| npm | 10+ | `npm -v` |
| Docker / Docker Compose | Última estable | `docker compose version` |
| Expo CLI | 54.x | `npx expo --version` |
| Expo Go app | Última de Play/App Store | Instalada en tu celular |

### Instalación rápida

**Node.js:** https://nodejs.org (versión LTS 20.x) — marcar "Add to PATH".

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

### Frontend

```bash
# Navegación
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context

# Seguridad y estado local
npx expo install expo-secure-store @react-native-async-storage/async-storage

# Socket.IO (tiempo real + señalización WebRTC)
npm install socket.io-client

# Ubicación GPS
npx expo install expo-location

# SDK de videollamada (elegir UNO)
npx expo install @zegocloud/zego-uikit-prebuilt-call-rn @zegocloud/zego-uikit-rn
# o
npx expo install react-native-agora
```

### Backend

```bash
cd api
npm install
```

---

## 5. Configurar Backend

### 5.1 Variables de entorno

Copia el archivo de ejemplo y edita los valores:

```bash
cd api
cp .env.example .env
```

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/soslense?schema=public"
JWT_SECRET="cambia_esto_por_un_secreto_largo_y_aleatorio"
JWT_REFRESH_SECRET="otro_secreto_largo_y_aleatorio"
PORT=3000
```

### 5.2 Levantar PostgreSQL + PostGIS

```bash
docker compose up -d db
```

### 5.3 Aplicar migraciones y sembrar admin

```bash
npm run db:migrate
npm run db:seed
```

El seed crea un usuario administrador:
- Email: `admin@sos-lense.local`
- Contraseña: `Admin1234!`

### 5.4 Iniciar API

```bash
npm run start:dev
```

La API quedará disponible en `http://localhost:3000`.

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
├── api/                            # Backend NestJS + PostgreSQL + PostGIS
│   ├── src/
│   │   ├── auth/
│   │   ├── incidents/
│   │   ├── messages/
│   │   ├── realtime/
│   │   ├── signaling/
│   │   └── prisma/
│   └── prisma/migrations/
└── src/
    ├── constants/
    │   └── roles.js                # Enumeraciones (ROLES, STATUS, TYPES)
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
    │       ├── DispatchPanelScreen.js      # Panel de incidentes activos
    │       ├── IncidentManagementScreen.js # Gestión + videollamada
    │       └── CloseIncidentScreen.js      # Cierre con observaciones
    └── services/
        ├── apiClient.js            # Axios + refresco automático de token
        ├── authService.js          # Login, registro, tokens
        ├── incidentService.js      # REST para incidentes/mensajes
        ├── signalingService.js     # Socket.IO /signaling
        └── realtimeService.js      # Socket.IO /realtime
```

---

## 7. Ejecutar la App

Asegúrate de que el backend esté corriendo (`npm run start:dev` en `api/`) y ejecuta:

```bash
npx expo start
```

1. Escanea el código QR con **Expo Go** en tu celular.
2. La app carga automáticamente.
3. **Regístrate** con un correo cualquiera → rol ciudadano por defecto.
4. Para probar rol oficial, inicia sesión como administrador en la API y crea un usuario con rol `OFFICER`, o usa el endpoint de registro con un rol forzado desde el panel de administración.

### Solución de problemas

| Problema | Solución |
|---|---|
| "Project is incompatible with this version of Expo Go" | El proyecto usa SDK 56+. Recrea con SDK 54. |
| Error de conexión al backend | Verifica que `API_URL` en `src/services/apiClient.js` apunte al host correcto y que el backend esté corriendo. |
| GPS no funciona | Acepta permisos de ubicación en el celular |
| Error `Connection refused` al backend en Android | Usa la IP local de tu máquina en lugar de `localhost` en `API_URL`. |

---

## 8. Estructura de Datos en PostgreSQL

### Tabla `User`
```
id (UUID, PK)
├── email: string (unique)
├── passwordHash: string
├── role: "CITIZEN" | "OFFICER" | "ADMIN"
├── alias: string
├── rut: string (nullable)
├── createdAt: timestamp
└── updatedAt: timestamp
```

### Tabla `Incident`
```
id (UUID, PK)
├── citizenId -> User.id
├── officerId -> User.id (nullable)
├── status: "NO_CLASIFICADO" | "ACTIVO" | "EN_CURSO" | "CERRADO" | "ANULADO"
├── type: string
├── latitude: decimal
├── longitude: decimal
├── location: geography(Point) (PostGIS)
├── address: string (nullable)
├── quickRequests: text[]
├── observations: text
├── closedReason: string (nullable)
├── createdAt: timestamp
└── updatedAt: timestamp
```

### Tabla `Message`
```
id (UUID, PK)
├── incidentId -> Incident.id
├── senderId -> User.id
├── senderRole: "CITIZEN" | "OFFICER"
├── text: string
├── readBy: text[]
├── createdAt: timestamp
└── updatedAt: timestamp
```
