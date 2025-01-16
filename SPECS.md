# Especificación de Lógica de Negocio y Funcionalidades

# Qualia Control Software

## 1. Descripción General

El Qualia Control Software es un sistema orientado a gestionar de manera consciente el uso del tiempo diario y la realización de diversas actividades que promueven un equilibrio entre responsabilidades y pasiones. Para ello, el sistema opera sobre un ciclo diario de 16 horas (960 minutos), un saldo de tempos que puede ser positivo o negativo, y una selección de actividades en cada minuto que transcurre.

Se contemplan tres tipos de actividades (Desafío, Tempo Neutral y Hobby/Descuento), cada uno con reglas específicas sobre generación/consumo de tempos y duración. A continuación, se describen todos los elementos de la lógica de negocio, teniendo en cuenta esta nueva incorporación de actividades de tipo hobby (descuento).

## 2. Ciclo Diario

### Duración:

El día dura un máximo de 16 horas (960 minutos) desde que el usuario lo inicia.

### Inicio y Fin del Día:

- El usuario inicia el día manualmente, estableciendo la hora de inicio.
- Al llegar a 960 minutos (o antes, si el usuario cierra el día anticipadamente), el sistema se pausa y se registra el estado final del día.
- Al confirmar el inicio de un nuevo día, se reinicia el "tempo del día" a 0 y se actualiza el "tempo total acumulado" según el saldo final del día anterior.

### Estados del Sistema (en relación al día):

- Día no iniciado
- Día en curso
- Día pausado/finalizado (esperando la confirmación para iniciar otro día)

## 3. Estado Global y Estado Diario

### 3.1 Estado Global

- Tempo total acumulado (puede ser positivo o negativo).
- Historial de días, cada uno con su estado completo (tableros, actividades, criterios de aceptación, etc.).
- Tableros (organizan las actividades en jerarquía).

### 3.2 Estado Diario

- Hora de inicio y hora de fin (calculada).
- Minuto actual dentro de los 960.
- Tempo del día (inicia en 0).
- Colección de actividades (heredadas y/o nuevas de ese día).
- Selección de actividad actual (solo 1 a la vez).
- Historial de notificaciones del día (cambios en tempos, penalizaciones, etc.).

## 4. Actividades y Sus Tipos

El concepto de "Actividad" unifica todo aquello que el usuario puede "seleccionar" para su tiempo. Cada actividad tiene:

- ID único
- Título
- Tipo de actividad (Desafío, Tempo Neutral o Hobby/Descuento)
- Duración estimada o límite (en minutos)
- Atributo repetible (si se regenera cada nuevo día o no)

A continuación se detalla el comportamiento según el tipo:

### 4.1 Actividad de Tipo Desafío

#### Gana Tempos:

- Mientras se está dentro de la duración estimada (p. ej., 60 minutos), genera +1 tempo/minuto.

#### Exceso de Tiempo:

- Al exceder el tiempo estimado, deja de generar tempos y se retoma el consumo pasivo (1 tempo/min) aunque la actividad siga seleccionada.
- El usuario debe marcarlo como "completado" (recibe la recompensa total) o "deseleccionarlo sin completar" (no recibe recompensa adicional).

#### Criterios de Aceptación (ACs):

- Puede tener multas asociadas (fijas o porcentuales) si no se cumple cierta condición (p. ej., completarlo antes de una hora).

### 4.2 Actividad de Tipo Tempo Neutral

#### Pausa Consumo Pasivo:

- Mientras está seleccionada (dentro de su duración límite), no se consumen tempos.
- No genera tempos ni ACs.

#### Final Automático:

- Al cumplirse su duración (p. ej., 25 minutos de descanso), se deselecciona automáticamente y se vuelve al consumo pasivo normal (1 tempo/min).

#### Deselección Anticipada:

- Si el usuario la quita antes de llegar a su duración completa, el tiempo "sobrante" puede sumarse como tempos de compensación (p. ej., sobraron 10 minutos, se añaden +10 al tempo del día).

### 4.3 Actividad de Tipo Hobby (Descuento)

#### Descuento en Consumo de Tempos:

- Mientras está seleccionada (y dentro de su duración límite), en lugar de consumir 1 tempo/minuto, se consume una cantidad reducida (por ejemplo, 0.5 tempo/min).
- La idea es que es "ocio positivo" o "tiempo de calidad" que no genera tempos, pero tampoco consume la totalidad pasiva de 1 tempo/min.

#### Cierre Automático al Cumplir Duración:

- Igual que en las actividades de tempo neutral, al cumplirse su duración se deselecciona automáticamente.
- Se vuelve al consumo pasivo normal (1 tempo/min) si no se selecciona nada más.

#### Criterios de Aceptación (ACs):

- Normalmente no tendrían ACs (no generan recompensas), pero se pueden añadir en tableros si se desea penalizar o controlar excesos.

### 4.4 Atributo "Repetible"

- Repetible: La actividad vuelve a estar disponible al iniciar un nuevo día (en estado "no completada", si aplica).
- No repetible:
  - Si se completa, no aparece de nuevo al día siguiente.
  - Si queda sin completar, pasa al día siguiente hasta que el usuario la finalice manualmente.

## 5. Tableros (Boards) y Jerarquía

### Organización Jerárquica:

- Los tableros pueden contener sub-tableros y/o actividades (de cualquier tipo).

### Criterios de Aceptación (ACs) Heredados:

- Los ACs configurados en un tablero aplican a todas las actividades bajo él.
- Las multas se suman si hay varios ACs incumplidos.

## 6. Criterios de Aceptación (ACs) y Multas

### Tipos de Penalización:

- Cantidad fija (p. ej., -10 tempos).
- Porcentaje sobre la recompensa de un desafío (p. ej., -100% si se incumple).
- Se pueden combinar y se suman las penalizaciones si hay varios criterios.

### Estados:

- Activo o Fallido (cuando se incumple).

### Ejemplos:

- AC: "Completar antes de las 13:00" con multa de -10 tempos si se falla.
- AC en un tablero "Obligatorios" con multa del 100% de la recompensa si no se completa ese mismo día.

## 7. Consumo, Generación y Descuento de Tempos

A nivel de minuto a minuto:

### Sin Actividad Seleccionada:

- Consumo pasivo de 1 tempo/min.

### Actividad de Tipo Desafío Seleccionada (y en su ventana de tiempo estimado):

- +1 tempo/min generado.

### Actividad de Tipo Desafío Seleccionada (fuera de su ventana estimada):

- No genera más tempos y se aplica el consumo pasivo de 1 tempo/min hasta que el usuario lo complete o deseleccione.

### Actividad de Tipo Tempo Neutral Seleccionada (durante su duración):

- El consumo pasivo se pausa (0 tempo/min).
- Se "quema" 1 minuto de la duración de la actividad en cada ciclo.
- Al llegar a 0 minutos, se deselecciona automáticamente.

### Actividad de Tipo Hobby (Descuento) Seleccionada (durante su duración):

- Aplica un consumo reducido (p. ej., 0.5 tempo/min o la tasa que el usuario haya definido para esa actividad).
- Al cumplirse el tiempo límite, se deselecciona automáticamente y se vuelve al consumo estándar si no se selecciona nada más.

## 8. Persistencia y Transición entre Días

### Registro del Estado Diario:

- Al finalizar el día, se guarda todo: actividades, tableros, ACs, tempos, etc.

### Inicio de Nuevo Día:

- Se suma o resta el saldo final del día al tempo total acumulado.
- Se reactivan las actividades repetibles (vuelven a estado inicial).
- Las actividades no repetibles que no se completaron continúan disponibles.
- Las actividades no repetibles que se completaron no se arrastran al siguiente día.

## 9. Selección de Actividad y Reglas Detalladas

Una sola actividad a la vez.

### Cambio de Selección en Cualquier Momento:

- Si se trata de un Desafío, el usuario puede:
  - Completar (recibir la recompensa total, sin importar cuántos minutos faltaban o sobraban).
  - Deseleccionar sin completar (abandona, no otorga más recompensa).
- Si se trata de una Actividad Tempo Neutral o de Hobby:
  - Al deseleccionarla antes de su fin, simplemente se la considera terminada de forma anticipada (en tempo neutral podría sumar compensaciones si así se definió; en hobby no hay recompensa, pero tampoco un reembolso del descuento).

### Aplicación de la Regla Minuto a Minuto:

- Cada minuto en punto (XX:00) se evalúa la actividad seleccionada y se modifica el tempo del día según corresponda (generación, consumo pausado, consumo reducido, etc.).

## 10. Ejemplo de Uso para Actividades de Tipo Hobby (Descuento)

### "Jugar rankeds de LoL en solitario (45 minutos)"

- Tipo: Hobby/Descuento
- Duración estimada: 45 minutos.
- Tasa de consumo reducida: 0.5 tempo/min (en vez de 1 tempo/min).
- Mientras esté seleccionada, en cada minuto se descuenta 0.5 tempo del saldo, pausando el resto.
- Al cumplirse los 45 minutos, la actividad se deselecciona automáticamente.

### "Estudiar animación (30 minutos)"

- Tipo: Hobby/Descuento
- Duración estimada: 30 minutos.
- Tasa de consumo: 0.3 tempo/min (ejemplo).

Así, el usuario puede "canjear" su tiempo libre de ocio constructivo con una penalización de tempo menor que la estándar, incentivando actividades que le aportan bienestar o formación sin penalizarlo tanto como la inacción completa.

## 11. Ejemplo de Uso Integrado

### Desafío Diario "Practicar Piano (60 min, +60 tempos)"

- Genera +1 tempo/min por los primeros 60 minutos de selección.
- Luego deja de generar, y el sistema vuelve al consumo pasivo si se excede el tiempo.

### Actividad Tempo Neutral "Descanso de 20 min"

- Pausa el consumo (0 tempo/min).
- Se deselecciona automáticamente a los 20 minutos (o antes si el usuario la quita).

### Actividad Hobby "Jugar League of Legends (Ranked) 45 min"

- Aplica consumo de 0.5 tempo/min mientras esté seleccionada.
- Se deselecciona al llegar a los 45 minutos.

### Flujo en un día:

1. El usuario inicia el día a las 08:00, tempo del día = 0, tempo total acumulado = 50.
2. Selecciona el desafío "Practicar Piano" a las 08:10. Gana +1 tempo/min hasta las 09:10.
3. A las 09:10, lleva 60 minutos practicados; deja de generar tempo, pero el desafío sigue seleccionado. Se activa el consumo normal de 1 tempo/min.
4. A las 09:15, decide completarlo manualmente y obtiene +60 tempos en su saldo.
5. A las 10:00, selecciona la actividad hobby "Jugar LoL 45 min (0.5 tempo/min)". Hasta las 10:45, el consumo es de 0.5 tempo/min.
6. A las 10:45, la actividad se deselecciona automáticamente y se vuelve al consumo de 1 tempo/min.

## 12. Notificaciones y Eventos

- Cambios de saldo: ganar tempo por desafío, consumir o recibir compensación.
- Cumplimiento o fracaso de ACs.
- Fin de actividad (por duración cumplida o completada manual).
- Fin del día.

Estas notificaciones pueden mostrarse en un panel o registro de eventos, con indicadores visuales de positivo/negativo.

## 13. Principios de Negocio y Expansión Futura

### Flexibilidad Total en la Creación de Actividades:

- El usuario define manualmente cada actividad con su tipo, duración, tasas de consumo/generación y repetibilidad.

### Motivación y Autonomía:

- El sistema no "castiga" por ocio constructivo: las actividades Hobby permiten un consumo reducido.
- Los Desafíos recompensan cuando se necesita un empujón adicional.
- El Tiempo Neutral reconoce la necesidad de pausas y descansos.

### Posibles Extensiones:

- Reportar "AFK" (desconexiones) y reasignar retroactivamente el tiempo si así se decide.
- Integrar métricas más completas (gráficas de uso del tiempo, comparativas diarias, etc.).
- Personalizar tasas de descuento en hobbies.

## 14. Sección de UI (Nivel Funcional)

Se mantiene una visión no técnica y aglomerada para la UI, recordando que la implementación final puede variar.

### Panel de Estado Diario:

- Muestra el tempo del día, el tempo total acumulado, y el tiempo restante para llegar a 960 minutos.

### Indicador de Progreso del Minuto:

- Un componente que muestra el avance de cada minuto en tiempo real (0% a 100%).

### Visualización de Tableros y Actividades:

- Lista de tableros, cada uno con sus actividades (Desafíos, Neutral, Hobby).
- Iconos o etiquetas para diferenciar los tipos.

### Panel de Actividad Seleccionada:

- Si es un desafío: botón de "Completar" y ver cuánto tiempo de generación queda.
- Si es tempo neutral o hobby: mostrar duración restante, consumo si es hobby, etc.
- Al llegar a 0 minutos de actividad (neutral/hobby), se deselecciona sola.

### Historial de Tempo:

- Panel lateral con notificaciones (ganancias/pérdidas, penalizaciones, etc.).

### Bar Chart o Timeline de 0 a 960:

- Segmentos para cada actividad, en distintos colores según sea desafío (generación), neutral (pausa) u hobby (consumo reducido).

## Conclusión

Con la incorporación de las Actividades de Tipo Hobby (Descuento), se completa el panorama de actividades que el sistema admite para un manejo integral del tiempo:

- Desafíos para generar tempos e incentivarse,
- Actividades Tempo Neutral para descansar o detener el consumo,
- Actividades Hobby/Descuento para utilizar el tiempo libre de manera positiva reduciendo el consumo pasivo.

Esta lógica de negocio promueve la adaptabilidad y la motivación intrínseca, ofreciendo al usuario mecanismos para personalizar su experiencia y alinear el sistema con sus intereses, metas y bienestar.
