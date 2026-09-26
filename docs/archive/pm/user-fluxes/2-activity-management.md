## **Flujo 2: Creación y gestión de actividades en la biblioteca**

### **Objetivo**

El usuario crea y configura actividades en la biblioteca para poder utilizarlas durante su día.

### **Precondiciones**

- La aplicación está abierta (con o sin día activo)
- El usuario ha navegado a la sección "Biblioteca de Actividades"

### **Flujo principal**

1. El usuario hace clic en el botón "Biblioteca de Actividades" en la interfaz principal
2. El sistema muestra la pantalla de biblioteca con lista de actividades existentes (vacía en primer uso)
3. El usuario hace clic en el botón "Nueva Actividad"
4. El sistema muestra un formulario con los siguientes campos:
   - Título (campo de texto)
   - Descripción (área de texto)
   - Tipo de actividad (selector con opciones: "Con objetivo claro", "Duración flexible", "Timeboxing")
5. El usuario completa el título "Redactar informe de trabajo"
6. El usuario agrega la descripción "Escribir informe semanal para el jefe"
7. El usuario selecciona el tipo "Con objetivo claro"
8. El sistema muestra campo adicional específico para este tipo: "Tiempo estimado" con formato aproximado (\~XX min)
9. El usuario ingresa "\~45 min" como estimación
10. El usuario hace clic en "Guardar actividad"
11. El sistema guarda la actividad en la biblioteca
12. El sistema muestra la actividad en la lista de la biblioteca

### **Puntos de decisión**

- **PD1**: ¿Qué tipo de actividad selecciona el usuario?
  - Con objetivo claro: Mostrar campo de tiempo estimado aproximado
  - Duración flexible: Mostrar campos para rango de tiempo (mínimo-máximo)
  - Timeboxing: Mostrar opciones de configuración (tiempo mínimo, tiempo máximo, o ambos)

### **Flujos alternativos**

- **A1**: Creación de actividad con duración flexible

  1. En el paso 7, el usuario selecciona "Duración flexible"
  2. El sistema muestra campos adicionales: "Tiempo mínimo" y "Tiempo máximo"
  3. El usuario ingresa "5 min" y "10 min" respectivamente
  4. Continúa en el paso 10

- **A2**: Creación de actividad con timeboxing

  1. En el paso 7, el usuario selecciona "Timeboxing"
  2. El sistema muestra opciones: "Tiempo mínimo", "Tiempo máximo", "Ambos"
  3. El usuario selecciona "Tiempo mínimo"
  4. El sistema muestra campo "Tiempo mínimo"
  5. El usuario ingresa "20 min"
  6. Continúa en el paso 10

- **A3**: Edición de una actividad existente

  1. El usuario hace clic en una actividad de la biblioteca
  2. El sistema muestra los detalles de la actividad con opción de editar
  3. El usuario modifica los campos deseados
  4. El usuario hace clic en "Guardar cambios"
  5. El sistema actualiza la actividad en la biblioteca

### **Postcondiciones**

- La nueva actividad queda almacenada en la biblioteca
- La actividad está disponible para ser añadida al tablero Kanban

### **Estados de entidades**

- **Biblioteca de Actividades**: Se añade una nueva actividad
- **Actividad**: Se crea con estado "En biblioteca" (no instanciada)
