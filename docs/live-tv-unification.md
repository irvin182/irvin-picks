# Unificación local de Irvin Analytics Live

Informe de validación previa a la publicación, preparado sobre `d866986`. Se conservan las correcciones locales anteriores de estadísticas/eventos, protección de selección, errores y mensajes de datos insuficientes.

## Interfaz oficial y compatibilidad

- Los tres accesos del administrador («IA LIVE» de móvil y escritorio y «Live TV») apuntan a `/live-tv`.
- El dashboard utiliza `/live-tv` para todos los dispositivos, incluidas sus tarjetas con `?fixture=ID`. Se conserva exactamente la tarjeta Backtest que estaba pendiente antes de esta tarea.
- `/live` y `/live/live-mobile` usan una redirección temporal 307 de Next.js hacia `/live-tv`. Conservan únicamente un `fixture` entero positivo y seguro; rechazan parámetros duplicados, arrays, valores inválidos y destinos externos.
- El middleware de acceso y `AuthGuard` de la página oficial no cambian. Un usuario sin sesión sigue pasando por el acceso habitual antes de llegar al terminal.
- La interfaz antigua `LiveTvMobile.tsx`, `LiveTvResponsive.tsx` y sus componentes permanecen intactos. Los wrappers originales se conservan solo localmente, fuera del commit, en `app/live/page.before-live-unification.tsx.backup` y `app/live/live-mobile/page.before-live-unification.tsx.backup`. Las dos rutas públicas antiguas ya no los montan.

## Funciones integradas

1. **Enlaces a un partido:** en la primera lista válida se elige el ID solicitado si está disponible; si no, se informa y se utiliza una selección guardada disponible o el primer partido. No se consulta un ID arbitrario fuera de la lista recibida. En posteriores actualizaciones se conserva la elección actual mientras siga disponible.
2. **Memoria de selección:** se utiliza la misma clave de almacenamiento de la interfaz antigua. La preferencia se valida contra la lista actual. Si Safari bloquea el almacenamiento, la interfaz sigue funcionando. La URL se sincroniza con la selección sin navegar ni duplicar consultas. La tarjeta seleccionada se hace visible dentro del selector, sin desplazar la página y ocultar el marcador.
3. **Estadísticas adicionales:** tiros a puerta y córners se leen por ID de equipo de la respuesta de estadísticas que ya se obtiene. Se conservan ceros reales; campos ausentes permanecen «Sin datos». No se añaden solicitudes de estadísticas para estas tarjetas.
4. **Agrupación:** todos los partidos se agrupan por ID de liga, con alternativa por país y nombre si falta ese ID. Se muestra el escudo de liga cuando lo proporciona el endpoint existente. En móvil se conserva la lista horizontal; en escritorio, la columna lateral.
5. **Actualización manual:** botón explícito accesible que relee `/api/live` y `/api/fixture?id=ID` mediante los mismos flujos protegidos frente a solapamientos. No añade cache-busters ni parámetros para forzar el proveedor. Se limitan las pulsaciones repetidas con un mínimo de 30 segundos entre acciones. El servidor conserva la decisión normal de revalidar una caché vencida; no se promete que una lectura vencida nunca produzca una consulta normal al proveedor.

## Motor, caché y seguridad

Sin modificaciones en Poisson, xG, validación de datos numéricos, Redis, presupuesto preventivo de 7000, `apiFootballFetch`, middleware ni permisos de suscripción. El listado mantiene su caché compartida de 300 segundos y las estadísticas su caché de 600 segundos. Se mantienen los abortos y el control de ID para evitar estadísticas de otro partido.

La diferencia temporal entre ambas capturas sigue pudiendo bloquear estimaciones. Tampoco se sustituye la falta de xG o cobertura por porcentajes inventados. La unificación no elimina esas limitaciones estadísticas ya documentadas.

## Validación local

- **82/82 pruebas Node locales** (78 pertenecen al contenido publicable; cuatro son de una prueba Redis preexistente que permanece sin seguimiento y se excluye del commit), incluyendo Redis local aislado, cuota, acceso, suscripciones, normalización Poisson, respuestas parciales, sincronización, cambios rápidos, selección inicial, almacenamiento bloqueado y actualización manual.
- **TypeScript:** sin errores.
- **ESLint:** cero errores nuevos. Permanecen seis errores anteriores de `app/admin/page.tsx`, comprobados contra la copia previa a esta tarea. Hay seis advertencias en el conjunto revisado (imágenes y dependencias); la imagen del escudo de liga añade un aviso `no-img-element`.
- **Chrome:** 96 comprobaciones responsive, incluidas orientación y textos largos.
- **WebKit real con React:** 84 casos de datos completos/parciales/ausentes, desincronización, fallo 503 y error independiente de eventos, en 320, 375, 390, 430, 768, 1440 y 1920 px. Mismos porcentajes para el mismo ID entre dispositivos. Incluye selección por URL, memoria, toques, respuesta retrasada, giro y actualización manual sin solicitudes duplicadas.
- **Administrador:** siete comprobaciones de enlaces renderizados con una sesión sintética aislada y reglas de visibilidad responsive; ambos accesos visibles apuntan siempre a `/live-tv`.
- **Redirecciones:** pruebas con la implementación real de `redirect` de Next.js y comprobación del código 307 y destino validado de ambas páginas.

Las pruebas de navegador usan únicamente datos sintéticos locales y bloquean tráfico ajeno a esas respuestas. No se han consumido llamadas reales a API-Football ni utilizado sesiones o credenciales de producción.

## Pendiente antes de publicar

No se ha probado el flujo completo de login de un suscriptor en un iPhone físico ni estas rutas en un despliegue nuevo, durante esta validación local. Esa comprobación corresponde al despliegue posterior autorizado. Los seis errores ESLint anteriores del administrador siguen pendientes fuera del alcance de los cambios de enlaces.

Para una publicación posterior, habrá que revisar y seleccionar expresamente los cambios de unificación y las correcciones anteriores autorizadas. No debe añadirse íntegramente el dashboard sin separar su modificación de Backtest ajena, ni incluir respaldos o cambios de otros módulos.
