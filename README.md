# 🚨 S.O.S. Lense

Aplicación móvil desarrollada con **React Native + Expo** orientada a la gestión y reporte de emergencias. Permite a los ciudadanos generar alertas de manera rápida, mientras que los operadores pueden administrar incidentes en tiempo real mediante una interfaz dedicada.

---

## 📱 Características

- 🚨 Creación de alertas de emergencia.
- 📍 Obtención de la ubicación GPS del usuario.
- 👤 Autenticación de usuarios mediante Firebase.
- 📡 Gestión de incidentes en tiempo real.
- 🔔 Sistema de notificaciones dentro de la aplicación.
- 🎨 Soporte para temas mediante Context API.
- 🧭 Navegación entre pantallas con React Navigation.
- 🌐 Integración con WebView para contenido externo.
- 📱 Compatible con Android, iOS y Web mediante Expo.

---

## 🛠 Tecnologías utilizadas

- React Native
- Expo SDK 54
- React Navigation
- Firebase
- Expo Location
- Expo File System
- Expo SMS
- Async Storage
- Context API

---

## 📂 Estructura del proyecto

```
sos-lense-main/
│
├── assets/                 # Imágenes, íconos y GIFs
├── src/
│   ├── components/         # Componentes reutilizables
│   ├── context/            # Contextos globales
│   ├── navigation/         # Configuración de navegación
│   ├── screens/            # Pantallas de la aplicación
│   ├── services/           # Servicios e integración con Firebase
│   └── utils/              # Funciones auxiliares
│
├── App.js                  # Punto de entrada
├── app.json                # Configuración de Expo
├── package.json            # Dependencias del proyecto
└── SETUP_GUIDE.md          # Guía de instalación
```

---

## ⚙️ Requisitos

- Node.js 18 o superior
- npm 9 o superior
- Expo CLI
- Expo Go (para pruebas en dispositivos móviles)

---

## 🚀 Instalación

Clonar el repositorio:

```bash
git clone <URL_DEL_REPOSITORIO>
```

Entrar al proyecto:

```bash
cd sos-lense-main
```

Instalar las dependencias:

```bash
npm install
```

Iniciar el servidor de desarrollo:

```bash
npm start
```

O utilizar:

```bash
npm run android
```

```bash
npm run ios
```

```bash
npm run web
```

---

## 🔥 Configuración de Firebase

1. Crear un proyecto en Firebase.
2. Habilitar **Authentication**.
3. Crear una base de datos **Cloud Firestore**.
4. Configurar las credenciales del proyecto.
5. Agregar el archivo de configuración correspondiente.

Consulta el archivo **SETUP_GUIDE.md** para obtener instrucciones detalladas.

---

## 📦 Dependencias principales

- expo
- react-native
- firebase
- @react-navigation/native
- @react-navigation/native-stack
- @react-navigation/bottom-tabs
- expo-location
- expo-sms
- expo-file-system
- react-native-webview
- @react-native-async-storage/async-storage

---

## 📱 Funcionalidades principales

### Ciudadano

- Inicio de sesión.
- Reporte de emergencias.
- Envío de ubicación GPS.
- Visualización de categorías de emergencia.
- Comunicación con operadores.

### Operador

- Recepción de incidentes.
- Gestión de emergencias.
- Seguimiento de casos.
- Cierre de incidentes.

---

## 📄 Scripts disponibles

```bash
npm start
```

Inicia Expo.

```bash
npm run android
```

Ejecuta la aplicación en Android.

```bash
npm run ios
```

Ejecuta la aplicación en iOS.

```bash
npm run web
```

Ejecuta la aplicación en el navegador.

---

## 👨‍💻 Autores

Proyecto desarrollado como aplicación de gestión de emergencias utilizando React Native, Expo y Firebase.

---

## 📄 Licencia

Este proyecto fue desarrollado con fines académicos y/o de investigación. Puede modificarse y adaptarse según las necesidades del proyecto.
