# Despliegue a producción

Esta aplicación debe pasar primero por un ambiente de **staging** con la misma versión de MySQL, Node.js y configuración de red que producción. No ejecute `init.sql`; Prisma es la única fuente de verdad del esquema.

## 1. Runtime

- Node.js 22 LTS.
- MySQL con backups automáticos y restauración probada. Use un usuario dedicado de aplicación con contraseña fuerte; no ejecute la app con `root`. Cuando la base sea remota, use la conexión privada o TLS exigido por el proveedor.
- Frontend y backend bajo HTTPS.
- Preferir frontend y API bajo el mismo host (por ejemplo, `https://app.tu-dominio.com` y `/api` mediante proxy). Si se usan subdominios distintos, configure `COOKIE_DOMAIN=.tu-dominio.com` únicamente cuando todos esos subdominios sean de confianza; así el middleware del frontend puede ver la sesión. No use un dominio compartido con subdominios no confiables.
- Backend detrás de un proxy/load balancer que respete `X-Forwarded-*`.
- Liveness: `GET /api/health`.
- Readiness: `GET /api/ready` (comprueba MySQL y devuelve 503 si la instancia no está lista).

El backend aplica límites propios para no acumular trabajo indefinidamente:

- `headersTimeout`: 15 s.
- `requestTimeout`: 60 s.
- socket inactivo: 30 s.
- keep-alive: 5 s.
- máximo 100 peticiones por socket.
- JSON: 256 KiB.
- evidencia: máximo 4 archivos de 5 MiB cada uno.
- concurrencia global por instancia: `MAX_CONCURRENT_REQUESTS` (120 por defecto).
- concurrencia de evidencias: `MAX_CONCURRENT_UPLOADS` (6 por defecto).

Configure el timeout del proxy un poco por encima del timeout HTTP de la aplicación (por ejemplo, 65 s) y un body máximo de aproximadamente 22 MiB para permitir cuatro imágenes de 5 MiB más multipart overhead. No use un límite ilimitado.

## 2. MySQL / Prisma

Antes de desplegar una nueva versión:

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

El backend añade, salvo que ya estén en `DATABASE_URL`:

- `connection_limit=10` (configurable con `DB_CONNECTION_LIMIT`).
- `connect_timeout=5`.
- `pool_timeout=5`.
- `socket_timeout=10`.

El total de conexiones debe calcularse por **número de instancias**. Ejemplo: 3 instancias x 10 conexiones = 30 conexiones máximas de la aplicación. Reserve margen suficiente para migraciones, administración y otros servicios antes de fijar `DB_CONNECTION_LIMIT`.

Las transacciones interactivas tienen `maxWait=2 s` y `timeout=10 s`; si el pool se satura la API responde 503 en lugar de esperar indefinidamente.

## 3. Variables obligatorias

Use `backend/.env.example` y `frontend/web/.env.example` como inventario. En producción el backend se niega a iniciar si faltan secretos o datos legales críticos.

El frontend también debe compilarse con los valores públicos reales `NEXT_PUBLIC_LEGAL_*`, `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`, `NEXT_PUBLIC_CUSTOMER_SERVICE_EMAIL` y la configuración pública de Firebase. No copie secretos del backend a variables `NEXT_PUBLIC_*`.

Nunca guarde en GitHub:

- `JWT_SECRET`.
- `MFA_ENCRYPTION_KEY`.
- `WOMPI_PRIVATE_KEY`.
- secretos de integridad/eventos Wompi.
- `FIREBASE_SERVICE_ACCOUNT_JSON`.
- credenciales MySQL.
- contraseña bootstrap del administrador.

Después de crear el administrador bootstrap, cambiar la contraseña y activar MFA, retire `ADMIN_BOOTSTRAP_PASSWORD` del entorno cuando el proveedor lo permita.

Conserve `MFA_ENCRYPTION_KEY` en el gestor de secretos y en el procedimiento seguro de recuperación: cambiarla sin una migración/re-encriptado deja ilegibles los secretos TOTP y los hashes de recuperación existentes.

## 4. Wompi

Primero pruebe Sandbox de extremo a extremo: pago aprobado, rechazado, PSE pendiente, abandono, expiración y webhook. Solo entonces cambie a llaves `prod_*`.

- El webhook público debe ser `/api/payments/wompi/webhook`.
- El redirect de checkout debe apuntar a `/client/payment-return`; esa pantalla es informativa y nunca se toma como confirmación de pago.
- Wompi tiene timeout de red interno (`WOMPI_HTTP_TIMEOUT_MS`, 8 s por defecto).
- El backend nunca confía únicamente en el redirect del navegador.
- Los estados finales de pago no se regresan a `PENDING` por eventos tardíos. Si llega un pago aprobado cuando una reserva ya perdió su bloqueo, se conserva el pago para conciliación y se registra `WOMPI_LATE_PAYMENT_EVENT` con revisión manual en vez de reactivar una reserva sin cupo.
- Una orden “Lo hacemos por ti” no puede iniciar ni avanzar etapas operativas hasta que el pago asociado esté `APPROVED`.

## 5. Firebase

- Bucket privado; las evidencias no son públicas.
- La base guarda la ruta del objeto, no el binario.
- El cliente recibe URLs firmadas temporales.
- Probar FCM en segundo plano y primer plano en navegadores objetivo.
- `FIREBASE_OPERATION_TIMEOUT_MS` limita operaciones remotas; las cargas además tienen una concurrencia independiente.

## 6. Rate limiting y escalado

Los límites actuales viven en memoria de cada proceso. Son suficientes como primera defensa en una instancia, pero **no son globales entre réplicas**. Antes de escalar horizontalmente a muchas instancias, use un store compartido compatible con `express-rate-limit` (por ejemplo Redis) o aplique un rate-limit global equivalente en el API gateway/WAF.

Aun con rate-limit externo, conserve los límites internos de concurrencia y pool de DB.

## 7. Observabilidad

Configure el proveedor para alertar como mínimo por:

- respuestas 5xx sostenidas;
- aumentos de 429/503;
- latencia p95/p99;
- uso de memoria/CPU;
- conexiones MySQL y pool agotado;
- fallos de webhook Wompi y eventos `WOMPI_LATE_PAYMENT_EVENT` que requieran conciliación;
- fallos de Firebase/FCM;
- reinicios del proceso.

No registre contraseñas, JWT, cookies, service-account JSON, llaves Wompi, contenido completo de webhooks ni URLs firmadas de evidencia.

## 8. Backups y recuperación

Antes del lanzamiento:

1. activar backup automático MySQL;
2. ejecutar al menos una restauración completa en staging;
3. documentar RPO/RTO con el cliente;
4. confirmar retención de Firebase Storage y política de borrado;
5. conservar las migraciones Prisma en Git.

## 9. Checklist de salida

No desplegar producción hasta que:

- CI compile backend y frontend;
- `npm audit --omit=dev --audit-level=high` pase en ambos proyectos;
- Next.js esté en una versión de seguridad vigente de la línea 16.x (actualmente el repositorio está fijado a 16.3.6);
- todas las migraciones apliquen correctamente en staging;
- Wompi Sandbox complete casos aprobado/rechazado/pendiente/expirado;
- Firebase Storage/FCM se pruebe con credenciales reales;
- MFA admin se pruebe, incluyendo recovery code y bloqueo por intentos;
- reserva simultánea/bloqueo de máquina se pruebe con dos sesiones;
- al menos un domingo, un festivo fijo y un festivo trasladado al lunes se prueben con el horario especial;
- una orden con domicilio/desmanche permanezca sin pago hasta que la sede cargue los cargos variables y el total mostrado coincida con el valor enviado a Wompi;
- evidencias privadas se prueben con usuario autorizado y no autorizado;
- razón social, NIT, contactos y textos legales sean revisados por la empresa/asesor jurídico;
- las tres direcciones reales de las sedes estén configuradas antes de ejecutar el seed de producción;
- se realice prueba de carga del backend con el volumen esperado y margen de seguridad;
- se pruebe restauración de backup.

## 10. Despliegue gradual

Para el primer lanzamiento, despliegue primero a staging, ejecute smoke tests y luego producción. Si el proveedor permite rolling deploy, use `/api/ready` para no enviar tráfico a una instancia que todavía esté migrando/iniciando o no pueda acceder a MySQL. El proceso maneja `SIGTERM`/`SIGINT` y deja de aceptar tráfico antes de cerrar Prisma.
