## **Flujo 8: Finalización del día y visualización de datos**

### **Objetivo**

El usuario finaliza el día activo y visualiza los datos recopilados durante el día.

### **Precondiciones**

- Hay un día activo con actividades, eventos y variables registradas
- El usuario está en la vista principal del día

### **Flujo principal**

1. El usuario hace clic en el botón "Finalizar día" (con icono de dormir)
2. El sistema muestra un modal de confirmación: "¿Seguro que deseas finalizar el día?"
3. El usuario confirma
4. El sistema registra la hora de finalización del día
5. El sistema finaliza cualquier actividad activa en ese momento
6. El sistema persiste todos los datos del día en el almacenamiento global
7. El sistema muestra la pantalla de overview con dos secciones:
   - Datos del día finalizado
   - Datos globales (todos los días)
8. En la sección de datos del día, el sistema muestra:
   - Timeline horizontal con todas las actividades, eventos e interrupciones
   - Gráfico de líneas de variables subjetivas (cada variable con un color distinto)
   - Gráfico circular de distribución del tiempo por actividades
9. El usuario hace hover sobre un punto en el gráfico de variables
10. El sistema muestra tooltip con:
    - Nombre de la variable
    - Cambio registrado (ej. "de 3 a 7")
    - Actividades/eventos relacionados
11. El usuario hace clic en el botón para activar/desactivar visualización de variables
12. El sistema actualiza el gráfico mostrando solo las variables seleccionadas
13. El usuario hace hover sobre una porción del gráfico circular
14. El sistema muestra tooltip con el nombre de la actividad y porcentaje del día

### **Puntos de decisión**

- **PD1**: ¿Se llega a medianoche sin finalización manual del día?

  - Sí: El sistema finaliza automáticamente el día
  - No: El día continúa hasta que el usuario lo finalice manualmente

- **PD2**: ¿Hay una actividad activa al finalizar el día?

  - Sí: El sistema la finaliza automáticamente y registra el tiempo
  - No: El sistema solo finaliza el día

### **Flujos alternativos**

- **A1**: Visualización de datos durante día activo

  1. Mientras hay un día activo, el usuario hace clic en "Ver datos"
  2. El sistema muestra la pantalla de overview con datos actualizados hasta el momento
  3. El usuario puede consultar los datos parciales
  4. El usuario hace clic en "Volver al día" para regresar a la vista principal

- **A2**: Iniciar nuevo día después de finalizar

  1. Después de finalizar un día y estar en la pantalla de overview
  2. El usuario hace clic en "Comenzar nuevo día"
  3. El sistema inicia un nuevo día (Flujo 1\)
  4. Las actividades no activadas del día anterior permanecen en el Kanban

### **Postcondiciones**

- El día cambia a estado "Finalizado"
- Todos los datos del día quedan almacenados para análisis
- El sistema muestra la pantalla de overview
- Las actividades no activadas persisten para el próximo día

### **Estados de entidades**

- **Día**: Cambia de "Activo" a "Finalizado"
- **Datos del día**: Se persisten en almacenamiento global
- **Actividades no activadas**: Permanecen en sus columnas para el próximo día
- **Preferencias de visualización**: Se persisten (variables mostradas/ocultas)
