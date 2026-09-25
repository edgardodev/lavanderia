# La Lavandería & Bakery

Aplicación web para reservas de autoservicio y seguimiento del servicio **Lo hacemos por ti**.

La rama de preparación de producción es `hardening/admin-workflow`.

## Requisitos locales

- Node.js 22
- npm
- MySQL 8.x
- Git
- Una app TOTP para el administrador: Google Authenticator, Microsoft Authenticator, 1Password u otra compatible

Firebase y Wompi no son obligatorios para probar registro, login, reservas, órdenes, panel cliente y panel admin. Sí son necesarios para probar push, evidencias fotográficas y pagos reales/sandbox completos.

## 1. Obtener la rama

```bash
git clone https://github.com/edgardodev/lavanderia.git
cd lavanderia
git checkout hardening/admin-workflow
```

Si ya tienes el repositorio:

```bash
git fetch origin
git checkout hardening/admin-workflow
git pull origin hardening/admin-workflow
```

## 2. Crear la base MySQL

Crea una base vacía llamada `lavanderia` con UTF-8. Por ejemplo, entrando a MySQL:

```sql
CREATE DATABASE IF NOT EXISTS lavanderia
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

No uses `init.sql` para instalar la aplicación. La fuente soportada del esquema son las migraciones Prisma.

## 3. Configurar y arrancar el backend

```bash
cd backend
npm ci
```

Copia `backend/.env.example` a `backend/.env` y ajusta al menos:

```dotenv
NODE_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:3000
APP_URL=http://localhost:3000
DATABASE_URL=mysql://root:TU_CLAVE_MYSQL@127.0.0.1:3306/lavanderia
JWT_SECRET=TU_SECRETO_JWT_ALEATORIO
MFA_ENCRYPTION_KEY=TU_CLAVE_BASE64_DE_32_BYTES

ADMIN_BOOTSTRAP_NAME=Tu Nombre
ADMIN_BOOTSTRAP_EMAIL=tu-admin-local@example.com
ADMIN_BOOTSTRAP_PASSWORD=ELIGE_UNA_CLAVE_TEMPORAL_SEGURA

WOMPI_ENVIRONMENT=sandbox
```

Puedes generar secretos locales desde Node:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Usa la primera salida como `JWT_SECRET` y la segunda como `MFA_ENCRYPTION_KEY`.

La contraseña bootstrap del administrador debe tener entre 16 y 128 caracteres, combinar al menos tres tipos de caracteres y no contener el nombre, correo, `admin`, `lavanderia`, `password`, `123456` o secuencias previsibles.

Después prepara la base:

```bash
npx prisma generate
npx prisma migrate deploy
npm run seed
```

El seed crea las sedes:

- Universidad Metropolitana
- Cra 46 con 93
- Villa Carolina

Cada sede queda con cuatro máquinas. El administrador bootstrap solo se crea si definiste `ADMIN_BOOTSTRAP_EMAIL`. Si ya existe, volver a ejecutar el seed **no cambia su contraseña**.

Arranca la API:

```bash
npm run dev
```

Comprobaciones rápidas:

- `http://localhost:4000/api/health`
- `http://localhost:4000/api/ready`

Ambas deben responder correctamente; `ready` además comprueba la conexión MySQL.

## 4. Configurar y arrancar el frontend

Abre otra terminal:

```bash
cd frontend/web
npm ci
```

Copia `frontend/web/.env.example` a `frontend/web/.env.local`. Para una prueba básica basta con:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Los campos públicos de Firebase pueden dejarse vacíos mientras no estés probando notificaciones push. Después arranca Next.js:

```bash
npm run dev
```

Abre:

`http://localhost:3000`

## 5. Crear un usuario cliente

Abre:

`http://localhost:3000/register`

Completa nombre, correo, teléfono opcional, contraseña y los consentimientos obligatorios. La contraseña del cliente debe tener mínimo 12 caracteres y no ser predecible.

Después entra desde:

`http://localhost:3000/login`

Selecciona **Usuario**. Desde el panel podrás probar autoservicio y **Lo hacemos por ti**.

Reglas operativas actuales:

- Domingos y festivos colombianos usan las mismas franjas de autoservicio: 09:00-11:00, 11:00-13:00, 13:00-15:00 y 15:00-17:00.
- En “Lo hacemos por ti”, el domicilio y el desmanche/despercude son cargos variables. Si aplican, la orden queda pendiente de cotización.
- La persona encargada de la sede carga esos valores desde el panel de órdenes. El cliente ve el desglose y el total antes de que se habilite el pago con Wompi.
- Una orden asistida no puede avanzar al proceso de lavandería mientras el pago no esté aprobado.

## 6. Entrar como administrador por primera vez

Abre directamente:

`http://localhost:3000/login?role=admin`

Usa `ADMIN_BOOTSTRAP_EMAIL` y `ADMIN_BOOTSTRAP_PASSWORD` que pusiste en `backend/.env` antes de ejecutar el seed.

En el primer acceso la aplicación no permite entrar directamente al dashboard. Te lleva al asistente de seguridad:

1. Cambia la contraseña temporal por una nueva de al menos 16 caracteres.
2. Agrega el secreto TOTP a Google Authenticator, Microsoft Authenticator, 1Password u otra app compatible.
3. Escribe el código de 6 dígitos.
4. Guarda los 8 códigos de recuperación que aparecen una sola vez.
5. Continúa al dashboard admin.

En accesos posteriores usa el correo, la nueva contraseña y el código TOTP actual.

## 7. Reiniciar completamente el entorno local

Si quieres volver a probar el onboarding del primer administrador desde cero, elimina únicamente tu base **local de desarrollo**, créala otra vez y repite migraciones + seed:

```bash
npx prisma migrate deploy
npm run seed
```

No hagas un reset destructivo sobre staging ni producción.

## 8. Pruebas técnicas disponibles

Con la API local levantada puedes probar carga ligera desde `backend` configurando `TARGET_URL=http://127.0.0.1:4000` y ejecutando:

```bash
node scripts/load-smoke.mjs
```

El script mide errores, RPS, p50, p95, p99 y timeouts. Está diseñado para local/staging y bloquea hostnames que parezcan producción salvo autorización explícita.

El CI de la rama ejecuta además en cada cambio:

- instalación reproducible con `npm ci`;
- build backend;
- build frontend;
- auditoría de dependencias desplegables;
- MySQL 8.4 vacío;
- todas las migraciones Prisma;
- seed;
- registro/login cliente;
- idempotencia de reservas y órdenes;
- bootstrap admin, cambio de contraseña y MFA;
- protección CSRF;
- cambio de estado de una orden;
- comunicación admin → cliente;
- smoke de concurrencia controlada.

## Firebase y Wompi

Para probar evidencias y push configura en backend `FIREBASE_STORAGE_BUCKET` y `FIREBASE_SERVICE_ACCOUNT_JSON`, y en frontend las variables `NEXT_PUBLIC_FIREBASE_*` del proyecto web.

Para probar pagos usa primero llaves **sandbox** de Wompi y configura el webhook. No uses llaves de producción en `.env` local ni las subas a Git.

Consulta `DEPLOYMENT.md` antes de un despliegue público.
