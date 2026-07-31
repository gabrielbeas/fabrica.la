# 🏗️ Admin Panel - La Fábrica de Chocolate

Panel de administración para gestionar contratos, locales y operaciones de La Fábrica de Chocolate.

## 🚀 Características

- Dashboard con estadísticas generales
- Gestión de 12 locales/contratos
- Ficha maestra del edificio completo
- Sistema de autenticación con JWT
- Búsqueda y filtrado de contratos
- Interfaz responsive y moderna
- API REST para operaciones CRUD

## 📋 Requisitos

- Node.js >= 16.0.0
- npm o yarn

## 🛠️ Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/yourusername/admin-fabrica.git
cd admin-fabrica
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
```

Edita `.env` con tus variables:
```
PORT=3000
JWT_SECRET=tu_secret_key_segura
ADMIN_EMAIL=admin@fabrica.la
ADMIN_PASSWORD=tu_contraseña
```

## 🚀 Ejecutar en desarrollo

```bash
npm run dev
```

El panel estará disponible en: `http://localhost:3000`

## 📦 Ejecutar en producción

```bash
npm start
```

## 📁 Estructura del Proyecto

```
admin-fabrica/
├── public/                 # Frontend estático
│   ├── index.html
│   ├── css/
│   │   ├── styles.css
│   │   └── responsive.css
│   └── js/
│       ├── app.js
│       ├── api.js
│       └── utils.js
├── src/                    # Backend
│   ├── server.js           # Entrada principal
│   ├── config/
│   │   └── config.js
│   ├── api/
│   │   ├── routes.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── contractsController.js
│   │   │   └── buildingController.js
│   │   └── middleware/
│   │       └── auth.js
│   └── data/
│       ├── contracts.json
│       └── building.json
├── uploads/                # Archivos subidos
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 🔐 Autenticación

El panel utiliza JWT (JSON Web Tokens) para autenticación. Las credenciales se configuran en `.env`.

### Login
```bash
POST /api/auth/login
Body: {
  "email": "admin@fabrica.la",
  "password": "tu_contraseña"
}
```

### Response
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "email": "admin@fabrica.la"
  }
}
```

## 📡 API Endpoints

### Autenticación
- `POST /api/auth/login` - Login

### Contratos
- `GET /api/contracts` - Obtener todos los contratos
- `GET /api/contracts/:id` - Obtener contrato específico
- `POST /api/contracts` - Crear nuevo contrato
- `PUT /api/contracts/:id` - Actualizar contrato
- `DELETE /api/contracts/:id` - Eliminar contrato

### Edificio
- `GET /api/building` - Obtener información del edificio
- `PUT /api/building` - Actualizar información del edificio

## 🌐 Deploy

### En Vercel
```bash
npm i -g vercel
vercel
```

### En Render
1. Conecta tu repo de GitHub
2. Configura las variables de entorno
3. Deploy automático

### En tu servidor
```bash
# Instalar dependencies
npm install

# Ejecutar con PM2 (recomendado)
npm i -g pm2
pm2 start src/server.js --name "admin-fabrica"
pm2 save
```

## 📝 Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| PORT | Puerto del servidor | 3000 |
| NODE_ENV | Ambiente | development/production |
| JWT_SECRET | Clave para firmar tokens | your_secret_key |
| JWT_EXPIRE | Expiración del token | 7d |
| ADMIN_EMAIL | Email del administrador | admin@fabrica.la |
| ADMIN_PASSWORD | Contraseña del admin | changeme |
| CORS_ORIGIN | Orígenes permitidos | http://localhost:3000 |

## 🐛 Solución de Problemas

### Puerto ya en uso
```bash
# Cambiar puerto en .env
PORT=3001
```

### Módulos no encontrados
```bash
rm -rf node_modules package-lock.json
npm install
```

### Error de CORS
Verifica `CORS_ORIGIN` en `.env` incluya tu dominio.

## 📄 Licencia

MIT - Ver LICENSE para más detalles

## 👨‍💻 Autor

Gabriel Beas - gabrielbeas.mx@gmail.com

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Para cambios importantes:
1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

**Última actualización:** 28 de julio, 2026
