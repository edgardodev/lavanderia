# La Lavandería & Bakery — mejora UI/UX frontend

## Qué quedó diseñado

- Landing con planes, precios, horarios, CTA de usuario, admin y creación de cuenta.
- Registro con autorización de tratamiento de datos personales y borrador en localStorage.
- Login con modo usuario/admin y 5 perfiles admin sin exponer contraseñas en frontend.
- Dashboard usuario con dos rutas: Autoservicio y Lo hacemos por ti.
- Formulario Lo hacemos por ti con sede, dirección, piezas, indicaciones, desmanche, tratamiento de datos, borrador local y espacio PSE/Wompi.
- Formulario Autoservicio con sede, máquina, fecha, franjas de 2 horas, bloqueo por admin, borrador local y espacio PSE/Wompi.
- Dashboard admin con filtro por sede, métricas, agenda, bloqueo de horarios y centro de notificaciones.
- Panel admin de órdenes con estados, notificación simulada y carga de evidencias.
- Panel admin de clientes con búsqueda, visitas, servicio usado y sede frecuente.
- Panel admin de reservas y bloqueos.

## Notas técnicas

- El frontend no guarda contraseñas en localStorage.
- Los borradores locales se usan para formularios operativos, no para claves.
- La defensa real contra SQL injection, hashing de contraseñas, rate limiting, autorización por rol y auditoría debe ir en backend.
- Wompi queda como espacio visual y componente preparado para consumir `/payments/wompi/checkout`.
- Las notificaciones push ya tienen estructura FCM; el envío real debe ejecutarse desde backend al cambiar el estado.
