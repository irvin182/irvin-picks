# Live TV: auditoría de datos y Safari/iPhone

Revisión local: 27 de octubre de 2026. Cambios sin commit, push ni despliegue.

## Resultado y alcance de la evidencia

Producción continúa en `dpl_6LfpYHLTN4JLGV3SbSigtaEh4nmD`, Ready, commit `d86698647363c92a461821abe951e2bc8fe5d8b1`. Se consultó el despliegue y sus registros: cero entradas 5xx en la última hora consultada. Sin sesión, tanto escritorio como agente iPhone reciben 307 hacia login. No se consultó API-Football, no se leyeron secretos ni datos de usuarios y no se alteró producción.

No se dispone de las respuestas autenticadas del partido afectado. Por tanto, no se puede afirmar cuáles de sus estadísticas faltaban realmente en el proveedor. Los hallazgos siguientes están demostrados mediante código y pruebas aisladas; no son observaciones de ese partido real.

## Origen de los datos

| Campo | Origen y tratamiento |
| --- | --- |
| ID, equipos, escudos, goles, minuto y estado | API-Football `/fixtures?live=all`, compartido en Redis. No se inventa el marcador cuando falta. |
| Tiros, tiros a puerta, posesión, xG | `/fixtures/statistics?fixture=ID`, por ID de equipo. `null`, filas ausentes y valores inválidos permanecen ausentes; un cero numérico legítimo se conserva. Los xG son estimaciones del proveedor. |
| Eventos | `/fixtures/events?fixture=ID`; su disponibilidad es independiente de las estadísticas. |
| 1-X-2, goles, BTTS y próximo gol | Cálculos exploratorios del modelo Poisson de Irvin, no porcentajes leídos del endpoint `/predictions`. Usa xG acumulados por minuto para estimar goles restantes hasta el minuto 90. |
| «Observado» | Sucesos ya cumplidos según el marcador: por ejemplo, ambos equipos han anotado. No equivale a certeza sobre una predicción futura. |
| Confianza, riesgo y recomendaciones validadas | No evaluables sin validación histórica fuera de muestra. No se han añadido porcentajes. |

El proveedor documenta que la cobertura no garantiza datos completos para cada encuentro: https://www.api-football.com/documentation_v3 y https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide

## Causas demostradas

1. **Criterio conservador del modelo.** Requiere marcador/minuto/estado compatibles, los ocho valores estadísticos, coherencia entre tiros/xG/posesión, xG positivos en ambos equipos, al menos 15 minutos y menos de 90. Un cero de xG observado no se convierte en una tasa futura nula. No se extrapolan añadido ni prórroga. No se han cambiado fórmulas ni criterios.
2. **Capturas desincronizadas.** Redis actualiza el listado como máximo cada 300 segundos; los detalles tienen caché de 600 segundos. La estimación se bloquea cuando las capturas difieren más de 60 segundos, aun con todos los campos presentes. Ejemplo probado: tras renovar el listado, estadísticas de hace 300 segundos producen probabilidades nulas y el motivo de sincronización; con ambas capturas contemporáneas sí se calcula. Esta protección se conserva: presencia de datos no implica que puedan combinarse con seguridad.
3. **Fallo acoplado de eventos.** El endpoint descartaba estadísticas válidas si fallaba la consulta de eventos. Corregido con resultados independientes; se devuelve la estadística válida y una advertencia explícita de eventos. Un error de estadísticas sigue dando 503 y nunca datos válidos. La caché sigue siendo de 600 segundos y no hay reintentos ni más consultas por carga.
4. **Segundo plano.** El listado se refrescaba al recuperar visibilidad; los detalles esperaban el intervalo de diez minutos. Ahora se releen al recuperar visibilidad, usando la caché existente, con una sola petición en vuelo y limpieza al cambiar de partido.
5. **Explicación insuficiente.** Los motivos quedaban en el desplegable. Ahora se muestran carga, ausencia de campos, errores o capturas incompatibles junto a las tarjetas. Las estadísticas ausentes se etiquetan «Sin datos»; las probabilidades ausentes conservan «No evaluable» y «Sin datos».

## Safari y sincronización de interfaz

La ruta monta un único `LiveTvDashboard` con `ssr: false`: no hay motor de probabilidades alternativo para móvil ni contenido estadístico SSR que hidratar. El CSS cambia la composición, no los datos. Se ha probado el componente React real en WebKit 26 con respuestas sintéticas interceptadas, sin conexión al proveedor: mismo resultado numérico en escritorio y emulación iPhone, estadísticas completas/parciales/ausentes, caché desincronizada, error 503 y fallo de eventos. También se prueban cambios rápidos A-B-C con una respuesta B retrasada, aborto y correspondencia de selección/estadísticas.

No equivale a una comprobación de la sesión del suscriptor en el iPhone físico afectado. Una incidencia particular de sesión, red o versión de iOS requiere las respuestas de ese dispositivo.

## Pruebas y garantías

- Suite Node: 73 pruebas satisfactorias, incluyendo cuota, Redis local, seguridad, suscripciones, normalización, ausencia de datos y regresiones nuevas.
- TypeScript sin errores; ESLint de los archivos afectados sin errores, con tres avisos existentes de imágenes en el dashboard.
- Chrome: 96 comprobaciones responsive; WebKit: 84 casos del dashboard React real, en 320, 375, 390, 430, 768, 1440 y 1920 px, con nombres normales y largos. Se comprueba orientación, desbordamiento, solapamientos y selección táctil.
- El motor, Redis, presupuesto preventivo de 7000, caché de listado de 300 segundos, caché de detalles de 600, autenticación y permisos no se modifican. La lectura al volver a la pestaña puede activar una revalidación vencida de detalles, pero no reduce su TTL ni añade reintentos por usuario.
- Cambios locales ajenos y respaldos preservados; nada preparado para commit.

## Diagnóstico reproducible del partido real pendiente

Guardar únicamente cuerpos JSON sanitizados de `/api/live` y `/api/fixture?id=ID` de una sesión propia. No guardar cabeceras, cookies, tokens ni contraseñas. Ejecutar localmente:

```sh
node scripts/diagnose-live-analysis.mjs live.json fixture.json ID
```

La herramienta no hace solicitudes. Comprueba IDs, selecciona estadísticas por equipo y ejecuta exactamente el modelo actual. Informa de los campos recibidos, edades, calidad, motivos y probabilidades. Si se ejecuta mucho después de capturar los datos, los señalará correctamente como antiguos.

Para atribuir el caso del iPhone hace falta comparar cuerpos capturados para el mismo ID y periodo en ambos dispositivos. Hasta entonces, no puede asegurarse que todos los «Sin datos» de producción estén solucionados, ni distinguir ausencia real de cobertura y desincronización en ese encuentro concreto. Una solución general de capturas coordinadas debe diseñarse y verificarse antes de relajar el límite temporal o aumentar consultas.
