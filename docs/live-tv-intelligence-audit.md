# Fase 1: auditoría de la inteligencia de Live TV

Auditoría del commit de partida `86fb1cf8496f19156c4dc605daeff546f9b1133b`.
Cambios de esta fase exclusivamente locales, sin acceso a credenciales, producción ni API-Football.

## Hallazgos antes de modificar el motor

| Área | Comportamiento anterior | Evaluación |
| --- | --- | --- |
| Datos ausentes | `getStat` devolvía 0; posesión ausente se sustituía por 50% | Confundía falta de medición con un valor observado |
| Confianza | Base 55; `max(over, dangerIndex)`; reglas con umbrales manuales | No era una probabilidad de acierto ni una confianza calibrada |
| Ejemplo reproducido | 0-0, minuto 75, sin tiros, posesión 50/50 por defecto: confianza 88 y recomendación UNDER 2.5 | Confianza alta sin evidencia; debe retirarse |
| Poisson | Sumas de marcador/tiros/posesión con pesos 0.75, 1.6, 0.03, 0.12 y 0.18 | No calculaba una distribución Poisson ni parámetros ajustados a históricos |
| Resultado 1X2 | Normalizado después de topes y sumas arbitrarias | Sumar 100 era correcto aritméticamente, no validaba los pesos |
| Próximo gol y BTTS | Presión y límites mínimos/máximos elegidos manualmente | Heurísticos sin validación |
| Sucesos cumplidos | Con 1-1, BTTS 92% y over 1.5 95% | Incorrecto para sucesos ya cumplidos según el marcador |
| Primera mitad | UI usaba campos inexistentes y sustituía por 33/34/33; después del descanso infería primera mitad del marcador actual | No representaba la salida real ni el resultado de la primera mitad |
| Tiempo | `HT`/`FT` se convertían en minuto 1; se extrapolaba el reloj desde la recepción, no desde el proveedor | Modificaba el horizonte e inventaba minutos en capturas antiguas |
| Córners/tarjetas | Porcentajes derivados de tiros, minuto y marcador, sin modelos de esos eventos | No había respaldo estadístico |
| Irvin Score, peligro, riesgo y valor | Combinación de las mismas heurísticas, sin cuotas ni retornos evaluados | No medían confianza ni valor esperado |
| Calidad | Bastaba un array no vacío para “ALTA/PRO” | Podía contener solo datos parciales o nulos |
| xG | Se mostraba como dato, pero no se incorporaba al motor | xG es una estimación del proveedor, no goles reales ni una garantía |

## Correcciones locales

`liveData.ts` conserva ausencia como `null`, acepta solo números válidos y mantiene
ceros reales. Distingue origen de las estadísticas y evita cruces por nombres si están
presentes los IDs de equipo en el dashboard. No imputa posesión ni tiros.

El dashboard deja de extrapolar minutos y presenta el marcador/minuto recibidos.
Tanto dashboard como vista móvil alternativa muestran «No disponible» y «Confianza no
evaluable». Se retiran recomendaciones de entrada, scores y momentum no validados.
No se presume que una liga carece de estadísticas por una respuesta vacía temporal.

### Calidad de datos, sin convertirla en confianza

- Insuficiente: falta marcador/minuto válido, estado fuera de alcance o captura del marcador antigua o sin fecha conocida.
- Básica: marcador/minuto compatibles, sin métricas válidas.
- Intermedia: alguna métrica válida, cobertura incompleta, inconsistencia o antigüedad desconocida.
- Avanzada: las ocho métricas válidas (tiros, tiros a puerta, posesión y xG de ambos equipos),
  consistentes y con captura estadística de hasta 600 s. El marcador debe tener como máximo
  300 s y las dos capturas no pueden diferir en más de 60 s. También se rechaza xG mayor
  que los tiros totales del equipo.

Los límites de 300/600 s y el desfase máximo de 60 s son políticas operativas conservadoras;
no es un umbral aprendido ni demuestra sincronización exacta entre marcador y estadísticas.
Calidad avanzada describe cobertura, nunca precisión. Un xG cero real se conserva,
pero no se interpreta como imposibilidad de marcar después.

### Probabilidades actuales

El motor ahora usa una distribución Poisson explícita e independiente para los goles
restantes. Únicamente habilita la estimación con calidad avanzada, xG positivos de ambos
equipos y minuto entre 15 y 89. El mínimo de 15 minutos es una barrera operativa de
abstención, no un resultado empírico. No hay ajuste aprendido en esta fase.

Supuesto exploratorio: intensidad constante `xG acumulado / minutos observados`;
intensidad restante = esa tasa por minutos hasta 90. Se calculan:

- 1X2 desde el marcador observado y la distribución conjunta de goles adicionales.
- Over desde el total de goles adicionales; BTTS desde las probabilidades de que marque
  cada equipo que todavía no lo hizo.
- Próximo gol local/ninguno/visitante hasta el minuto 90 con riesgos competitivos constantes.
- Gol en los próximos diez minutos, recortando el horizonte al minuto 90.
- Primera mitad solo antes del minuto 45; al descanso su resultado es observado.
  Después del descanso no se reconstruye una primera mitad desconocida.

Las familias 1X2, BTTS y próximo gol se normalizan a 100 con redondeo por restos mayores.
Las colas Poisson se truncan a masa residual menor de 1e-12 y se renormalizan; intensidades
restantes totales superiores a 20 se rechazan por dominio numérico. No se introducen
pesos de conversión de tiros a goles ni históricos inventados. Añadido, prórroga y penaltis
no están modelados. En el minuto 90 aún en juego se abstiene de pronosticar el resto.

Los sucesos ya cumplidos según el marcador recibido y un partido terminado son hechos
condicionales a ese marcador (sujeto a correcciones del proveedor), no aciertos predictivos.
Se distinguen con `settled` y «resultado observado» al finalizar. La confianza permanece
nula incluso en esos casos: no se presenta un resultado observado como una predicción acertada.

**Esta extrapolación de xG no está validada.** Un Poisson matemáticamente coherente no
basta para afirmar que las frecuencias reales siguen sus probabilidades. No se usa
Dixon-Coles entrenado, fuerzas de equipos, liga, expulsiones, forma ni información previa.
No se evalúan tarjetas/córners, riesgo, valor de apuestas o confianza sin sus modelos y datos.
Los xG recibidos son estimaciones del modelo externo del proveedor; las probabilidades
exploratorias son estimaciones propias; los datos ausentes permanecen ausentes.

## Lo que necesita históricos

Registrar capturas con minuto, estado, fecha del proveedor, cobertura, datos realmente
disponibles y resultado futuro por horizonte. Separar entrenamiento y evaluación por
fecha y por partido; evitar que capturas de un mismo partido queden en ambos conjuntos.
No usar estadísticas del final como si hubieran estado disponibles antes.

Evaluar 1X2, BTTS, over y próximo gol por separado mediante Brier score/log loss,
curvas de calibración, cobertura de la abstención, intervalos de incertidumbre y comparación
con modelos base. Estratificar por liga, minuto, expulsiones, disponibilidad y antigüedad;
comprobar sesgo por cobertura de xG. Ajustar y validar ritmos/intensidades y dependencias
con históricos antes de ofrecer confianza numérica o recomendaciones. La calidad de datos
no debe convertirse en un porcentaje arbitrario de confianza.

Referencias primarias que orientan esa validación, sin afirmar que validen este modelo:

- [Dixon y Coles (1997), registro de Lancaster University](https://www.research.lancs.ac.uk/portal/en/publications/modelling-association-football-scores-and-inefficiencies-in-the-football-betting-market%28d16276a2-d6e0-483b-a708-1d29663f1992%29.html): modelo Poisson ajustado con datos históricos.
- [Gneiting y Raftery (2007), artículo de los autores](https://sites.stat.washington.edu/people/raftery/Research/PDF/Gneiting2007jasa.pdf): reglas de puntuación para evaluación probabilística.

## Protección del servicio

No se cambian `liveFixturesCache`, reservas de cuota, Redis, rutas API, autenticación ni
planes. No se añaden llamadas a API-Football. La lista y selección de todos los partidos
siguen probándose; las estadísticas se vinculan al ID seleccionado. Los cambios y respaldos
ajenos a Live TV permanecen intactos. Ninguna prueba sintética se sirve como dato real.

## Revisión final antes del commit

Se añadió bloqueo inmediato de estimaciones si falla la lectura de la lista, además del
control continuo de la edad de la captura. No basta con que una respuesta anterior tuviera
`stale: false`. La fecha usada es `cachedAt` del servidor; no es una fecha de medición
interna del proveedor, que no se conoce ni se inventa. Limitar el desfase entre capturas
reduce inconsistencias conocidas, pero no certifica que sus mediciones sean simultáneas.

La vista móvil alternativa usa versiones de solicitud y cancelación para impedir que una
respuesta de A sustituya las estadísticas de un A posterior tras una secuencia A-B-A.
Ambas vistas rechazan un `fixtureId` de respuesta diferente del solicitado. Las pruebas
cubren esas carreras, cuatro partidos seleccionables, errores de lista, datos parciales,
normalización y hechos ya conocidos. Las recomendaciones siguen siempre sin validación
numérica: ningún nivel de cobertura habilita porcentajes de confianza ni consejos de entrada.
