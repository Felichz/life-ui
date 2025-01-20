# 1. Layout General en Pantalla Ancha (~900p+)

## Sección Superior: Timeline y Datos Generales del Día

### Encabezado y Timeline

En la parte superior (se fusionan en una franja ancha):

- Línea de tiempo ocupando la mayor parte del ancho, con escala de 0 a 960 minutos
- En la parte izquierda, se puede incluir la información del día:
  - Tiempo restante en formato horas+minutos (p. ej.: "Restan 6h 20m")
  - Hora exacta de finalización (p. ej.: "Finaliza a las 22:30")
- En la parte derecha, un recuadro con los saldos de tempo:
  - "Tempo del Día: XX"
  - "Tempo Total: YY"

### Funcionamiento del Timeline (InvestedTimeHistory)

- Está siempre visible en la parte superior, mostrando barras de color para cada tramo de actividad o inactividad (Idle)
- Al pasar el ratón por encima de un tramo, un tooltip detalla la actividad, la hora de inicio/fin, la duración y el efecto en el tempo (generado, consumido, etc.)
- Un "cursor" o marcador indica el minuto actual dentro de esos 960. Todo lo que está por delante del minuto actual se muestra en gris o vacío

## Sección Inferior: Paneles de Tableros y Notificaciones

### Columna Izquierda (Ancha): Listado de Tableros y Actividades

- Aquí se gestionan tanto los tableros raíz (desplegados por defecto) como los subtableros (colapsados por defecto)
- Botón "Crear Tablero Raíz" en la parte superior de esta columna
- Cada tablero se lista con:
  - Su título y un botón "Crear Subtablero"
  - Un listado (o cards) de actividades directamente pertenecientes a ese tablero
  - Si el tablero tiene subtableros, aparecen como nodos anidados colapsados. Al hacer clic para expandir, se muestran sus respectivas actividades
- Opciones de editar y eliminar para cada tablero:
  - Editar: únicamente cambiar el título (sin cambiar el padre)
  - Eliminar: genera un modal de confirmación indicando que se borrará todo lo que cuelgue (subtableros y sus actividades)

### Columna Derecha (Estrecha): Historial de Notificaciones (TempoModificationHistory)

- Un feed cronológico de eventos relacionados con el saldo de tempos, con el más reciente en la parte superior
- Muestra:
  - Hora del evento
  - Razón o tipo (ej. "Penalización por expiración", "Recompensa por completar desafío", "Compensación por terminar antes", etc.)
  - Monto de tempos (+ o -)
  - Texto breve explicando lo sucedido

# 2. Cards de Actividad y Acciones

Dentro de cada tablero (o subtablero), las actividades se presentan en tarjetas (cards) con los detalles visibles (para no requerir ventanas emergentes). Cada card incluye:

## Elementos Básicos

- Título y Tipo (Desafío, Neutral, Hobby)
- Estado ("Por hacer", "En progreso", "Completada")

## Información Específica según el tipo

### Desafío

- Minutos activos / meta (p. ej., "30/60")
- Recompensa total (p. ej., +60 tempos)
- Criterios de aceptación (por ejemplo, "Expira a las 14:00, penalización de -10")

### Neutral

- Duración máxima (p. ej., 20 min)
- Minutos consumidos / restantes

### Hobby / Descuento

- Duración máxima
- Tasa de consumo reducida (p. ej., -0.5 tempo/min)
- Minutos consumidos / restantes

## Botones de Acción

### Seleccionar (si está libre o en "Por hacer")

- Si ya hay una actividad en progreso, el modal avisa que se deseleccionará la anterior (aplicando la lógica de penalización/compensación) y se seleccionará esta nueva

### Deseleccionar (si está en progreso)

- Modal explicando qué pasa si se quita esta actividad antes de cumplirla (en el caso de Neutral/Hobby, se muestra la compensación posible; en el caso de Desafío, no hay compensación, se abandona o se completa manualmente)

### Completar (solo si es un Desafío en progreso)

- Modal indicando la recompensa final que vas a recibir, o penalizaciones si algún criterio falló

### Eliminar (independiente del estado)

- Modal confirmando que se borrará la actividad

# 3. Detalles Clave de UX

- Timeline Arriba: Da un panorama global del día y su avance. El usuario ve de un vistazo cuánto queda de jornada y qué se ha hecho hasta ahora
- Información del Día (tiempo restante, hora de fin, saldos de tempo) integrada en la misma franja, para que sea muy visible
- Columna Izquierda con tableros/actividades:
  - Expandido por defecto para tableros raíz, colapsado para subtableros. Así no se satura la pantalla si hay mucha jerarquía
  - Diferentes botones de creación:
    - "Crear Tablero Raíz" (fuera de cualquier tablero)
    - "Crear Subtablero" (dentro de cada tablero)
- Columna Derecha con el feed de notificaciones brinda transparencia sobre los cambios de saldo
- Confirmaciones Modal evitan errores de clic rápido; el usuario siempre ve las consecuencias de sus acciones

# 4. Flujo de Uso Simplificado

1. Usuario entra y ve, en la parte superior, la barra (Timeline) y los datos del día:
   - "Restan 7h 10m / Finaliza 23:10"
   - "Tempo del Día: 10 / Tempo Total: 58"
2. El Timeline muestra en colores qué se hizo en cada tramo transcurrido del día
3. En la columna izquierda, el usuario ve Tableros Raíz ya expandidos, con sus actividades en formato card. Si hay subtableros, aparecen colapsados esperando clic para expandir
4. Selecciona o cambia de actividad usando los botones en cada card (con confirmación). El Timeline se actualizará minuto a minuto cuando la actividad esté en progreso
5. Cualquier penalización o recompensa aparece reflejada al momento, y además se registra en la columna derecha (notificaciones)
6. El día finaliza automáticamente al llegar los 960 minutos, y (opcionalmente) puede mostrarse un mensaje al usuario con el resumen final si lo deseas. Pero no hay botón manual de "Cerrar día"

# 5. Observaciones Adicionales de UX

- Orden de Tableros: Se puede permitir reordenar tableros raíz si fuera relevante para el usuario, pero no es imprescindible
- Visualización: Al tener el timeline horizontal en la parte superior, conviene que sea lo suficientemente alto para ver bien los tramos de color, pero no demasiado para que no ocupe toda la pantalla
- Separación de Roles:
  - InvestedTimeHistory → timeline
  - TempoModificationHistory → panel de notificaciones
  - Se mantiene la claridad de "qué hice y cuándo" vs. "por qué sube/baja el saldo"
- Consolidar la Actividad Actual: Podría resaltarse en la parte superior del timeline o en un pequeño recuadro al costado ("Actividad actual: [nombre]") para no obligar al usuario a buscar en la lista de tableros
- Confirmaciones Frecuentes: Cada vez que se selecciona una actividad distinta, salta un modal. Puede ser 100% deseado (transparencia) o, en el futuro, se podría simplificar con una opción de "No volver a preguntar en esta sesión" (dependiendo de la preferencia del usuario)

# 6. Conclusión

Desde un punto de vista de UX, se busca brindar:

- Transparencia (saber siempre qué pasa con el tempo)
- Facilidad de navegación (estructura por tableros, con expansiones claras)
- Feedback inmediato (modales de confirmación + panel de notificaciones)

De este modo, el usuario tiene total control sobre sus actividades y un panorama simple pero poderoso para manejar su día.
