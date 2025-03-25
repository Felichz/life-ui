# Qualia Control: Una Interfaz para la Vida

## Concepto Base

Qualia Control es una aplicación que funciona como una verdadera interfaz de usuario (UI) para la vida real, similar a cómo los videojuegos tienen una interfaz que proporciona información relevante al jugador. La aplicación asume que "la vida en sí es el único juego real, es la única fuente de la verdad" y simplemente proporciona una interfaz que complementa esta realidad sin sustituirla.

## Filosofía del Proyecto

- **La vida es el juego, la aplicación es solo la interfaz**: La aplicación no pretende crear un sistema artificial de gamificación, sino complementar y visualizar la vida real del usuario.
- **Enfoque en datos reales**: Recopilar y mostrar información precisa sobre las actividades y tiempo del usuario, sin distracciones innecesarias.
- **El usuario mantiene el control**: La responsabilidad final sobre la motivación y las decisiones recae en el usuario, no en la aplicación.
- **Valor directo y optimización de la experiencia**: El sistema está puramente enfocado en aportar valor directo al usuario, ayudándole a optimizar su experiencia real según sus propios criterios.

## Funcionalidades Principales

### 1. Gestión de Actividades y Bloques de Tiempo

#### Biblioteca de Actividades

- **Definición**: Repositorio donde el usuario crea y configura plantillas de actividades que puede reutilizar
- **Propiedades inmutables** (no cambian al incorporar la actividad al día):
  - Nombre y descripción de la actividad
  - Tipo de actividad (objetivo claro, duración flexible, timeboxing)
  - Categoría o etiquetas para clasificación
  - Icono o representación visual
- **Propiedades dinámicas** (tienen valores predeterminados pero pueden modificarse al incorporar al día):
  - Para actividades con objetivo claro: tiempo estimado predeterminado (ej. "~45 min")
  - Para actividades de duración flexible: rango de tiempo predeterminado (ej. "entre 5-10 minutos")
  - Para actividades de timeboxing: configuración predeterminada (ej. "mínimo 10 minutos")

#### Incorporación de Actividades al Día

- Cuando el usuario selecciona una actividad de la biblioteca para añadirla al día:
  - Las propiedades inmutables se mantienen fijas
  - Las propiedades dinámicas se cargan con sus valores predeterminados
  - El usuario puede modificar las propiedades dinámicas según las necesidades específicas del día
  - Esta configuración de actividad específica para el día es la que se utiliza en todos los análisis y registros

#### Bloques de Tiempo

- **Definición**: Rangos horarios predefinidos que el usuario puede crear para organizar su día
- **Ejemplos**: "Mañana" (6:00-12:00), "Tarde" (12:00-18:00), "Noche" (18:00-23:00)
- **Función**: Permiten al usuario hacer declaraciones flexibles como "voy a hacer X actividad en la mañana"

#### Planes de Acción

- **Definición**: Agrupaciones predefinidas de actividades, posiblemente con un orden sugerido
- **Función**: Permiten al usuario reutilizar secuencias comunes de actividades sin necesidad de recrearlas
- **Ejemplo**: "Plan matutino" (que incluye: meditación, ejercicio, desayuno, revisión de correos)

### 2. Sistema de Organización de Actividades (Estilo Kanban)

#### Columnas de Organización

- **Columna "Por Hacer" (Todo)**:

  - Contiene actividades pendientes sin tiempo específico asignado
  - Funciona como un backlog general de tareas

- **Columnas de Bloques de Tiempo**:
  - Cada columna representa un bloque de tiempo definido
  - El usuario puede crear y personalizar estos bloques
  - Las actividades colocadas en estas columnas están asignadas a ese rango horario

#### Restricciones Temporales

- El sistema solo permite activar actividades de la columna "Por Hacer" o del bloque de tiempo actual
- Las actividades en bloques futuros aparecen deshabilitadas
- Para activar una actividad fuera de su bloque, el usuario debe reasignarla

#### Flujo de Trabajo

1. El usuario selecciona una actividad de su biblioteca (que ya tiene un tipo definido)
2. Ajusta las propiedades dinámicas según las necesidades del día (estimación de tiempo, rango, etc.)
3. Selecciona un bloque de tiempo (columna) o lo deja en "Por Hacer"
4. Las actividades aparecen organizadas en las columnas correspondientes
5. El usuario puede reorganizarlas según necesite mediante arrastrar y soltar

### 3. Sistema de Estimaciones y Seguimiento

**Actividades con Objetivo Claro**

- **Definición**: Actividades con un inicio y fin definidos y un resultado específico que completar
- **Propósito**: Planificar cuánto tiempo tomará alcanzar un objetivo concreto
- **Estimación**: El usuario estima un tiempo aproximado para completar la actividad ("~45 min" en lugar de un valor exacto)
- **Seguimiento**: Se compara el tiempo real con la estimación; las desviaciones indican planificación imprecisa
- **Ejemplo**: 📝 Escribir informe - Estimado: ~45 min | Real: 60 min ❌ (+15 min)

**Actividades de Duración Flexible**

- **Definición**: Actividades cuya duración puede variar pero tienen un rango típico predecible
- **Propósito**: Informativo - dar al usuario una noción de cuánto tiempo esperar dedicar
- **Estimación**: Se define un rango de tiempo estimado basado en experiencia previa (ej. 5-10 minutos)
- **Naturaleza**: Es una predicción o expectativa, no un límite estructural
- **Seguimiento**: Se verifica si el tiempo real cae dentro del rango establecido
- **Sin temporizador activo**: No hay notificaciones de límites, solo registro posterior
- **Ejemplo**: 🧹 Barrer - Rango estimado: 5-10 min | Real: 8 min ✅

**Actividades de Timeboxing con Modalidades Avanzadas**

- **Definición**: Actividades donde el usuario establece deliberadamente límites de tiempo estructurales
- **Propósito**: Estructurar intencionalmente el tiempo (no solo predecirlo)
- **Naturaleza**: Refleja una decisión consciente, no una predicción
- **Temporizador activo**: Notifica al usuario al alcanzar límites establecidos
- **Tipos**:
  - **Tiempo mínimo**: "Declaro que voy a leer al menos 10 minutos" (para vencer la resistencia inicial)
    - Notifica cuando se alcanza el mínimo, permitiendo continuar si hay flujo
  - **Tiempo máximo**: "Declaro que voy a revisar correos máximo 15 minutos" (para limitar actividades expansivas)
    - Alerta cuando se aproxima el límite máximo establecido
  - **Rango de tiempo**: "Declaro que voy a caminar mínimo 15 minutos pero máximo 1 hora"
    - Combina los beneficios de tener un compromiso mínimo para comenzar con un límite máximo para no extenderse
- **Ejemplo**: 📚 Leer - Timebox: mínimo 20 min | Real: 35 min ✅ (extensión voluntaria)

### 4. Gestión de Estados de Actividad y Descanso

#### Actividades Universales del Sistema

- **Piloto automático**: Estado activo por defecto cuando el usuario no declara ninguna actividad específica

  - Se registra automáticamente cuando no hay otra actividad declarada
  - Funciona como un "fallback" universal para evitar periodos sin registro
  - Representa el tiempo donde permitimos que la mente haga lo que quiera

- **Meditación**: Actividad estructurada de recuperación mental

  - Requiere esfuerzo y disciplina pero busca la recuperación
  - Se registra como actividad regular pero con propósito de recuperación

- **Descanso consciente**: Actividad donde el usuario intencionalmente descansa
  - A diferencia del piloto automático, es un descanso deliberado
  - El usuario procura no realizar actividades demandantes
  - Puede configurarse con timeboxes específicos ("Descanso de 15 minutos")

#### Barra de Acceso Rápido

- Implementada como una "hotbar" donde el usuario puede seleccionar una colección de actividades frecuentes
- Botones con iconos distintivos para actividades fundamentales
- Tooltips que aparecen al hacer hover mostrando detalles de cada actividad
- Posibilidad de personalizar la barra añadiendo actividades frecuentes

#### Manejo de Timeboxes Finalizados

- Cuando un timebox termina y el usuario no ha interactuado con la aplicación:
  - El sistema registra ese tiempo como "Tiempo extendido no confirmado"
  - Al regresar, el usuario puede confirmar la actividad o reclasificar ese tiempo
- Se mantiene un registro tanto del timebox original como de las extensiones

### 5. Gestión de Estados Subjetivos

#### Variables Subjetivas del Usuario

- **Variables subjetivas personalizables**:

  - El usuario puede definir y actualizar variables que reflejen su estado (energía, concentración, dolor de cabeza, etc.)
  - Escala adaptable según la variable (1-5, 1-10, etc.)
  - Posibilidad de crear variables personalizadas según necesidades específicas

- **Actualización en cualquier momento**:

  - El usuario puede actualizar sus variables de estado cuando lo desee
  - El sistema sugiere actualizaciones en checkpoints específicos (fin de actividad, registro de evento)
  - Se registran tanto el valor inicial como el final para cada cambio

- **Registro completo de estados**:
  - Se captura un snapshot completo de todas las variables en cada actualización
  - Permite analizar también cuando una actividad prolongada no genera fatiga
- **Sistema de referencias entre estados y actividades/eventos**:
  - Cada snapshot de variables incluye multiselect para relacionarlo con actividades o eventos
  - En checkpoints como fin de actividad, la actividad terminada aparece preseleccionada
  - Durante una actividad activa, esa actividad aparece preseleccionada
  - El usuario puede seleccionar múltiples actividades y eventos como causas del cambio
  - Permite capturar efectos retardados de eventos anteriores (como medicación)
  - Este sistema facilita el análisis causal entre acciones y cambios en estados subjetivos

#### Métricas Relacionadas con Actividades

- **Satisfacción con la actividad**: Escala del 1 al 10 para medir la satisfacción general
- **Percepción de valor por tiempo invertido**: Evalúa si el tiempo dedicado valió la pena

#### Variables Globales del Sistema

- **Momentum**: Variable derivada que representa la continuidad y densidad de actividades planificadas
  - Aumenta cuando el usuario completa actividades consecutivamente con descansos breves
  - Disminuye durante periodos largos de "piloto automático"
  - Permite identificar cuándo los niveles de momentum son óptimos para ciertos tipos de actividades

#### Eventos Puntuales

- **Registro de eventos discretos**:
  - El usuario puede registrar eventos puntuales como "Tomé ibuprofeno", "Comí algo con cafeína", etc.
  - Al registrar un evento, se ofrece la opción de actualizar variables subjetivas
  - El sistema reconoce que muchos eventos tienen efectos retardados (no inmediatos)
- **Visualización y referencias**:
  - Estos eventos aparecen como marcadores en la visualización principal
  - Cuando el usuario actualiza variables más tarde, puede seleccionar eventos anteriores como causas
  - El sistema puede sugerir eventos recientes que podrían estar relacionados con cambios actuales
  - Se pueden establecer múltiples relaciones causales para análisis más precisos

### 6. Causas de Interrupción

- **Registro de causas de interrupción evitables**:

  - Cuando el usuario no completa una actividad según lo planeado, puede registrar la causa
  - El sistema ofrece una distinción simple: "¿Fue por una causa que podrías evitar en el futuro?" (Sí/No)
  - Solo se registran con detalle las causas evitables, ya que son las únicas sobre las que el usuario puede actuar

- **Causas personalizadas**:

  - El usuario puede crear causas personalizadas específicas a su situación
  - Estas causas se guardan para su uso posterior, simplificando el proceso de registro

- **Análisis de patrones de interrupción**:
  - El sistema muestra estadísticas como "30% de tus actividades fueron interrumpidas por causas evitables"
  - Identifica las causas de interrupción más frecuentes
  - La información se presenta de forma diagnóstica y constructiva, no punitiva

### 7. Visualización de Datos

#### Visualización Principal (Estilo Kanban)

- **Columnas de Organización**:

  - Columna "Por Hacer" para actividades sin bloque de tiempo asignado
  - Columnas para cada bloque de tiempo definido por el usuario
  - Indicadores visuales que muestran qué columnas están actualmente disponibles

- **Visualización de Actividades**:
  - Las actividades aparecen como tarjetas en las columnas correspondientes
  - Información visual sobre tipo de actividad, duración estimada, y estado

#### Otras Visualizaciones

- **Comparativa de estimaciones vs. tiempo real**:

  - Para actividades con objetivo claro: barras de comparación entre estimación y realidad
  - Para actividades flexibles: indicadores de si el tiempo real cayó dentro del rango
  - Para timeboxing: marcadores de cumplimiento del bloque establecido y registro de extensiones

- **Visualización de estados subjetivos**:

  - Gráficos que muestran la evolución de variables subjetivas a lo largo del día
  - Correlación visual con actividades y descansos

- **Representación de momentum y eventos puntuales**:
  - Línea de tendencia para el momentum a lo largo del día
  - Marcadores para eventos puntuales que pueden influir en las variables

### 8. Declaraciones Default por Grupos de Días

- **Configuración de patrones por días**:

  - El usuario puede definir conjuntos de declaraciones predeterminadas para diferentes grupos de días:
    - Días laborables (Lunes a Viernes)
    - Fin de semana (Sábado y Domingo)
    - Días específicos (solo Martes y Jueves, etc.)
    - Patrones personalizados

- **Declaraciones automáticas**:

  - En base a estos patrones, el sistema carga automáticamente actividades y planes de acción en las columnas correspondientes
  - Ejemplos:
    - "Haré Plan de acción: Rutina matutina en bloque Mañana" (L-V)
    - "Haré Actividad: Tiempo familiar en bloque Tarde" (S-D)

- **Ajustes diarios**:
  - El usuario puede modificar las actividades precargadas según necesite
  - El sistema mantiene la estructura básica mientras permite flexibilidad

## Responsabilidades del Usuario y la Aplicación

### Responsabilidades del Usuario:

- Declarar el inicio y finalización de actividades
- Actualizar sus variables de estado subjetivas cuando lo considere necesario
- Definir sus actividades, timeboxes y estimaciones de tiempo
- Establecer sus bloques de tiempo personalizados
- Crear sus planes de acción para reutilizar secuencias de actividades
- Configurar las declaraciones default para diferentes grupos de días
- Registrar eventos puntuales relevantes
- Registrar las causas de interrupción cuando no completa actividades

### Responsabilidades de la App:

- Registrar con precisión los tiempos de actividades y descansos
- Visualizar la información de manera clara y accesible
- Mostrar comparaciones entre tiempos estimados y reales
- Detectar patrones en los datos del usuario
- Calcular y mantener variables derivadas como el momentum
- Proporcionar notificaciones sutiles sobre límites de tiempo
- Solicitar actualizaciones de variables subjetivas en momentos oportunos
- Identificar correlaciones entre actividades y cambios en estados subjetivos
- Analizar patrones de interrupciones y proporcionar insights útiles

## Aspectos Técnicos

### Arquitectura de la Interfaz de Usuario

**Estructura Principal**

- **Panel de Organización Kanban**:

  - Columnas para "Por Hacer" y bloques de tiempo
  - Tarjetas de actividades arrastrables
  - Indicadores de estado y tiempo

- **Panel de Estados Subjetivos**:

  - Controles intuitivos para actualizar variables subjetivas
  - Visualización de tendencias a lo largo del día/semana

- **Barra de Acceso Rápido**:

  - Botones con iconos distintivos para actividades frecuentes
  - Acceso rápido a actividades especiales como Meditación y Piloto Automático

- **Panel de Biblioteca de Actividades**:
  - Repositorio donde el usuario crea y configura sus actividades
  - Opciones para crear nuevos planes de acción
  - Interfaz para establecer propiedades de actividades

### Arquitectura de Datos

**Modelo de Datos**

- **Actividades en Biblioteca**:

  - Plantillas de actividades con propiedades inmutables y valores predeterminados para propiedades dinámicas
  - Funcionan como base para crear instancias específicas de actividades

- **Actividades Realizadas**:

  - Instancias específicas de actividades incorporadas al día
  - Mantienen todas las propiedades inmutables de la actividad original
  - Contienen los valores específicos de las propiedades dinámicas definidas para esa instancia
  - Registran tiempo real de ejecución, interrupciones, extensiones, etc.
  - Incluyen referencias a los bloques de tiempo asignados

- **Referencias a Actividades**:

  - Cuando se hace referencia a una actividad (ej. desde un snapshot de variables):
    - Se guarda el ID de la instancia específica de la actividad (no solo el ID de la plantilla)
    - Se incluyen los valores de las propiedades dinámicas de esa instancia específica
    - Esto permite análisis precisos de causa-efecto (ej. cómo afecta un timebox de "mínimo 30 min" vs uno de "mínimo 10 min" para la misma actividad)

- **Bloques de Tiempo**:

  - Definiciones de rangos horarios creados por el usuario
  - Referencias a actividades asignadas a cada bloque

- **Planes de Acción**:

  - Colecciones de actividades predefinidas
  - Información sobre orden sugerido y configuración

- **Variables de Estado**:

  - Snapshots completos e inmutables de todas las variables en cada actualización
  - Cada snapshot incluye:
    - Valores actuales de todas las variables (incluso las que no cambiaron)
    - Valores iniciales y magnitud del cambio para cada variable
    - Referencias a múltiples actividades/eventos que pudieron influir en el cambio
    - Timestamp exacto de la actualización
  - No se sobrescriben valores anteriores, cada actualización crea un nuevo registro

- **Eventos Puntuales**:

  - Registro de eventos discretos como tomar medicación
  - Timestamp exacto de ocurrencia
  - Mantiene referencias a qué snapshots de variables están relacionados con él

- **Causas de Interrupción**:

  - Registro de actividades interrumpidas con sus causas

- **Variables de Sistema**:

  - Registro de variables derivadas como momentum

- **Declaraciones Default**:
  - Configuraciones de actividades y planes de acción por grupos de días

**Mecanismo de Referencias**

- Cuando el usuario actualiza variables subjetivas:
  - Se crea un snapshot completo de todas las variables
  - A través de multiselects, puede relacionar este snapshot con:
    - Múltiples actividades previas o en curso
    - Múltiples eventos puntuales registrados anteriormente
  - El sistema ofrece preselecciones contextuales (actividad actual, evento reciente)
  - Estas referencias permiten análisis causales precisos y detección de patrones temporales
