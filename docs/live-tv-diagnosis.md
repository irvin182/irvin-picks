# Diagnóstico de los partidos de Live TV

Validación local, sin acceso a producción, credenciales ni llamadas externas.

## Recorrido comprobado

`app/live-tv/page.tsx` monta `LiveTvDashboard`, no `LiveTvMobile` ni `LiveTvResponsive`.
`/api/live` pide `/fixtures?live=all` mediante el servicio con reserva Redis de cuota.
La ruta conserva el array `response` completo. El componente hace `map` de ese array
sin filtrar ligas, estados ni aplicar límites; cada ID tiene su botón de selección.
La disponibilidad de estadísticas no condiciona la inclusión de un partido.

Las pruebas locales comparan los IDs de una respuesta de cuatro partidos con los
IDs de los botones renderizados, partiendo de una lista anterior de un solo partido.
También comprueban selección individual y respuestas de estadísticas fuera de orden.
Los datos de esas pruebas son sintéticos; no demuestran cuántos partidos había en producción.
El árbol React se verifica con un arnés local de hooks; no equivale a una comprobación visual en navegador.

## Caché anterior y solución local preparada

La prueba `live-tv-cache.test.mjs` conserva la reproducción del problema anterior con
el código instalado de Next y almacenamiento local en memoria: al caducar una entrada,
Next la devuelve mientras la revalida en segundo plano. Con una lectura del navegador
cada 300 segundos, una captura de un partido podía seguir en pantalla otro ciclo de
cinco minutos aunque la caché ya contuviera cuatro. No demuestra que fuera la causa en producción.

La nueva ruta elimina esa capa `unstable_cache` de Live TV y usa `lib/liveFixturesCache.ts`:

- Redis mantiene una captura compartida, fresca durante 300 segundos y retenida hasta
  24 horas desde la última captura válida para poder servirla con aviso si hay fallos.
- `SET NX EX 300` concede una única actualización entre usuarios e instancias. La puerta
  permanece todo el intervalo incluso si falla el proveedor o está agotada la cuota.
- El propietario espera el resultado de `fixtures?live=all` y lo publica mediante Lua
  solo si sigue siendo propietario. Una respuesta vieja no puede reemplazar otra nueva.
- Los demás lectores reciben la captura previa con `stale: true` durante la actualización.
  Si no existe ninguna captura válida, reciben un 503 controlado; no consultan el proveedor.
- Todos los accesos al proveedor pasan por la reserva atómica del presupuesto existente.
  Si Redis falla, no hay acceso directo al proveedor. Los errores no se almacenan como partidos.
- La pantalla lee la caché cada 30 segundos cuando está visible y al volver a la pestaña,
  sin solapar peticiones. La autenticación y el límite por IP siguen ejecutándose en la ruta.
- La ruta mantiene `Cache-Control: private, no-store`. Ya no existe una segunda capa Next
  que pueda entregar otra captura antigua tras actualizar Redis.

### Latencia y consumo

Para un partido disponible en el proveedor justo después de una captura, con pestañas
visibles, tráfico continuo, Redis sano y proveedor respondiendo dentro del timeout de 10 s:

- Hasta 300 s para caducar la captura.
- Hasta 30 s para que una pantalla solicite la actualización.
- Hasta 10 s para la respuesta del proveedor.
- Hasta 30 s para que otra pantalla que leyó durante esa actualización vuelva a leer.

Presupuesto conservador: aproximadamente 370 s (6 min 10 s), más la latencia de Redis y
entrega de la respuesta. La pantalla que actualiza recibe los datos al terminar la consulta
(alrededor de 5 min 40 s en ese peor caso); una vez publicados, los otros navegadores los
leen en hasta 30 s. No es una garantía absoluta: fallos, cuota agotada, pestañas suspendidas,
red lenta o retraso de API-Football pueden prolongarlo. La falta de estadísticas no oculta partidos.

Con tráfico continuo se permiten como máximo 288 intentos de actualización de Live TV
en 24 horas, compartidos entre todos los usuarios, no 288 por usuario. Al agotarse la cuota,
los intentos rechazados por el presupuesto no generan llamadas HTTP al proveedor.
Comparado con un refresco efectivo compartido cada cinco minutos, no aumenta ese techo.
Comparado con el comportamiento anterior de refrescar efectivamente cada diez minutos,
podría añadir hasta unos 144 intentos diarios para Live TV. Las llamadas de estadísticas,
eventos y otras rutas siguen consumiendo el mismo presupuesto global de 7.000; el cálculo
de 288 no incluye esas otras rutas ni la sincronización inicial de cuota ya existente.
Aumentan las lecturas a la aplicación/Redis y las validaciones de sesión; no se crea un
acceso nuevo al proveedor por cada navegador conectado.

`cachedAt` sigue indicando la fecha de captura del servidor. `stale: true` avisa de que
se sirve una captura antigua. La herramienta offline informa de la edad y diferencias de IDs;
no presupone que una actualización haya terminado.

## Comparación real preparada, sin consultas adicionales

Cuando se decida validar una sesión real, usar la respuesta de `/api/live` que la página
ya haya solicitado en la pestaña Network. No hacer una consulta directa a API-Football,
invalidar caché ni compartir cookies, cabeceras de autorización, HAR completos o secretos.

1. Guardar solo `cachedAt`, `errors` y `response` con los campos de partidos necesarios,
   especialmente `fixture.id`, nombres de equipos, liga y estado. No guardar cabeceras.
2. Comparar con la lista de esa misma actualización, no con una respuesta anterior o posterior.
3. En esta versión local los botones tienen `data-live-fixture-id`. Este fragmento de la
   consola solo lee el DOM y produce la lista de IDs; no hace peticiones:

   ```js
   JSON.stringify(Array.from(document.querySelectorAll('button[data-live-fixture-id]'),
     button => Number(button.dataset.liveFixtureId)))
   ```

   Guardar el resultado como `ids-renderizados.json`. El atributo aún no está publicado:
   si no existe en la versión examinada, no interpretar un array vacío como prueba de
   partidos omitidos. En la versión anterior comparar los nombres de ambos equipos
   manualmente con la misma respuesta, incluyendo los elementos fuera de la zona visible.
4. Ejecutar localmente desde la raíz del proyecto:

   ```sh
   node scripts/diagnose-live-tv.mjs respuesta.json ids-renderizados.json
   ```

La herramienta es totalmente offline. Informa IDs recibidos/renderizados, ausentes,
inesperados, duplicados y edad de la captura. Código de salida: 0 si coinciden los IDs,
1 si difieren, 2 si los datos de entrada no son válidos. No registra el contenido íntegro.
`revalidationDue` solo indica edad >= 300 segundos, no que una actualización haya terminado.

## Interpretación

- Respuesta con cuatro IDs, DOM con cuatro: no hay pérdida de encuentros en ese recorrido.
  Revisar visibilidad, desplazamiento y selección si solo se percibe uno.
- Respuesta con cuatro IDs, DOM con uno en la misma actualización: diferencia de interfaz
  confirmada; guardar únicamente los IDs y el momento para reproducirla.
- Respuesta con uno y captura antigua: compatible con retraso de caché; esperar el refresco
  normal y comparar de nuevo, sin forzar llamadas ni eludir la cuota.
- Respuesta reciente con uno: esta ruta recibió uno en esa captura. No atribuir los otros
  tres a un filtro de interfaz; aún falta contrastar la disponibilidad/cobertura del proveedor.
- Error HTTP o `errors` no vacío: no es una lista válida de cero encuentros. La herramienta
  lo rechaza y la pantalla conserva la última lista válida con aviso de error.

Conclusión: localmente no se pierden IDs entre respuesta válida y lista renderizada.
La combinación anterior de caché y refresco podía explicar un retraso; se ha sustituido
localmente por la caché Redis coordinada. La causa del incidente real sigue sin confirmar.
No se ha realizado push ni despliegue, ni se ha consultado producción.
