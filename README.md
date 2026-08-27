# 🐴 Kiosco Manuel

Aplicación web de **gestión de stock y ventas** para el Kiosco Manuel, desarrollada con **React + Vite + Tailwind CSS + Firebase**.

Diseño **mobile-first** con aspecto de app de teléfono, ideal para usar desde el celular en el mostrador.

## ✨ Módulos (hoja de ruta)

| Sección | Estado |
| --- | --- |
| 🔐 Login (Google + Email/Contraseña) | ✅ Implementado |
| 🛒 Caja | 🚧 Pendiente |
| 📦 Stock / Inventario | 🚧 Pendiente |
| 📖 Fiados | 🚧 Pendiente |
| 🚚 Proveedores | 🚧 Pendiente |

Los módulos de negocio se construirán sobre **Firestore** (la conexión `db` ya está configurada).

## 🚀 Requisitos

- Node.js 18+ (recomendado)
- Una cuenta y proyecto en [Firebase Console](https://console.firebase.google.com/)

## 🛠️ Instalación

```bash
# 1) Instalar dependencias
npm install

# 2) Configurar Firebase
cp .env.example .env
# Abrir .env y pegar las credenciales de tu Web App de Firebase

# 3) Levantar el servidor de desarrollo
npm run dev
```

## 🔥 Configuración de Firebase

1. En [Firebase Console](https://console.firebase.google.com/) creá un proyecto (o usá uno existente).
2. Registrá una **Web App** y copiá el objeto `firebaseConfig` que te muestra.
3. Completá las variables del archivo **`.env`**:

```env
VITE_FIREBASE_API_KEY=TU_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=TU_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=TU_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=TU_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=TU_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=TU_APP_ID
```

> ⚠️ El archivo `.env` **nunca se sube a GitHub** (está en `.gitignore`). En los deploy (Netlify, Vercel, etc.) configurá estas mismas variables en la sección *Environment Variables*.

4. En **Firebase Auth** → *Sign-in method*, habilitá:
   - **Email/Password**
   - **Google** (agregá el dominio de tu app en *Authorized domains*)

## 📦 Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Previsualizar el build |

## 🧱 Stack

- [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/)
- [Tailwind CSS 3](https://tailwindcss.com/)
- [Firebase 10](https://firebase.google.com/docs/web/setup) (Auth + Firestore)
- [lucide-react](https://lucide.dev/) (íconos)
