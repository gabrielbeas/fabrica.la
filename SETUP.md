# 🔐 Setup - Sistema de Autenticación Firebase

## ✅ Pasos para configurar

### 1️⃣ Obtener credenciales de Firebase

1. Ve a https://console.firebase.google.com/project/fabrica-399f2/settings/general
2. Baja hasta la sección **"Your apps"**
3. Haz click en el icono de **Web** (`</>`)
4. Si no hay una app web, crea una con el nombre "fabrica-web"
5. Copia la configuración que aparece

### 2️⃣ Completar firebase-config.js

Abre el archivo `/firebase-config.js` y reemplaza:

```javascript
export const firebaseConfig = {
  apiKey: "PEGA_TU_API_KEY_AQUI",
  authDomain: "fabrica-399f2.firebaseapp.com",
  projectId: "fabrica-399f2",
  storageBucket: "fabrica-399f2.appspot.com",
  messagingSenderId: "PEGA_TU_MESSAGING_SENDER_ID",
  appId: "PEGA_TU_APP_ID"
};
```

### 3️⃣ Crear usuarios en Firebase

#### Opción A: Crear un Admin desde Firebase Console

1. Ve a https://console.firebase.google.com/project/fabrica-399f2/authentication/users
2. Haz click en **"Add user"**
3. Email: `admin@fabrica.la`
4. Password: una contraseña segura (no la escribas en este repositorio, es público)
5. Crea el usuario

#### Opción B: Crear usuarios programáticamente

Usa el archivo `/tools/create-users.js`:

```bash
node tools/create-users.js
```

### 4️⃣ Crear documentos de usuarios en Firestore

Necesitas crear colección "users" en Firestore con documentos como este:

**Colección:** `users`
**Documento ID:** `{UID del usuario de Auth}`

```json
{
  "email": "admin@fabrica.la",
  "nombre": "Administrador",
  "rol": "admin",
  "permisos": ["*"],
  "createdAt": "2026-09-29",
  "activo": true
}
```

### 5️⃣ Acceder al panel

1. Ve a `https://fabrica.la/login.html`
2. Usa las credenciales de prueba:
   - **Email:** `admin@fabrica.la`
   - **Contraseña:** la definida en Firebase Authentication

---

## 📁 Estructura de archivos

```
fabrica.la/
├── firebase-config.js          ← Configuración de Firebase (llenar datos)
├── login.html                  ← Página de login
├── js/
│   ├── auth.js                 ← Sistema de autenticación
│   └── navbar.js               ← Navbar dinámico
├── admin/
│   ├── public/
│   │   ├── index.html          ← Dashboard principal
│   │   └── ...otros archivos
└── tools/
    └── create-users.js         ← Script para crear usuarios (próximamente)
```

---

## 🔑 Roles y Permisos

### Admin
- Acceso a todas las secciones
- Gestión de usuarios
- Configuración del sistema

### Operario
- Ver y crear lecturas de agua
- Ver dashboard
- No puede acceder a configuración

---

## 🚀 Próximos pasos

1. ✅ Configurar Firebase (este paso)
2. ⏳ Crear página de gestión de usuarios
3. ⏳ Migrar datos de Google Sheets a Firestore
4. ⏳ Conectar componentes existentes con Firestore
5. ⏳ Agregar calendarios

---

## 🐛 Troubleshooting

### "Error: firebaseConfig is not defined"
- Asegúrate de haber llenado correctamente `firebase-config.js`
- Verifica que los valores no estén vacíos

### "Usuario no encontrado en Firestore"
- Crea el documento en la colección "users" con el mismo UID

### "Permiso denegado"
- Verifica las reglas de seguridad en Firestore
- En desarrollo, puedes usar modo test (ya está configurado)

---

## 📞 Contacto

Si tienes dudas, revisa los comentarios en:
- `login.html` - Lógica de login
- `js/auth.js` - Sistema de autenticación
- `js/navbar.js` - Interfaz de navegación
