## **Flujo 3: Organización de actividades en el tablero Kanban**

### **Objetivo**

El usuario organiza sus actividades para el día actual utilizando el tablero Kanban y crea bloques de tiempo personalizados.

### **Precondiciones**

* Hay un día activo  
* Existen actividades en la biblioteca  
* El usuario está en la vista principal del día

### **Flujo principal**

1. El usuario hace clic en el botón "Gestionar bloques de tiempo"  
2. El sistema muestra la interfaz para crear bloques de tiempo  
3. El usuario hace clic en "Nuevo bloque de tiempo"  
4. El sistema muestra un formulario con campos:  
   * Nombre del bloque (texto)  
   * Hora de inicio (selector de hora)  
   * Hora de fin (selector de hora)  
5. El usuario completa "Mañana" como nombre  
6. El usuario selecciona "06:00" como hora de inicio  
7. El usuario selecciona "12:00" como hora de fin  
8. El usuario hace clic en "Guardar bloque"  
9. El sistema crea el bloque de tiempo y actualiza el tablero Kanban añadiendo la columna "Mañana"  
10. El usuario repite los pasos 3-9 para crear bloques "Mediodía" (12:00-15:00) y "Tarde" (15:00-19:00)  
11. El usuario navega a la biblioteca de actividades  
12. El usuario hace clic y arrastra la actividad "Redactar informe de trabajo" hacia la columna "Mañana" del Kanban  
13. El sistema muestra un modal para ajustar las propiedades dinámicas, mostrando los valores predeterminados de la actividad  
14. El usuario ajusta la estimación a "\~60 min" (en lugar de los \~45 min predeterminados)  
15. El usuario hace clic en "Confirmar"  
16. El sistema crea una instancia de la actividad y la coloca en la columna "Mañana"  
17. El usuario repite los pasos 11-16 para otras actividades, colocándolas en diferentes columnas según planificación

### **Puntos de decisión**

* **PD1**: ¿El bloque de tiempo actual corresponde a la hora actual del sistema?  
  * Sí: Las actividades en ese bloque aparecen habilitadas para activación  
  * No: Las actividades en ese bloque aparecen deshabilitadas  
* **PD2**: ¿El usuario intenta mover una actividad a un bloque de tiempo?  
  * Si el bloque destino es el actual o "Por Hacer": Se permite la acción  
  * Si el bloque destino es futuro: Se permite la acción pero la actividad quedará deshabilitada  
  * Si el bloque destino es pasado: No se permite la acción (muestra mensaje de error)

### **Flujos alternativos**

* **A1**: Reordenamiento de actividades dentro de una columna

  1. El usuario hace clic y mantiene presionado sobre una actividad en una columna  
  2. El usuario arrastra la actividad hacia arriba o abajo dentro de la misma columna  
  3. El sistema actualiza el orden de las actividades en esa columna  
  4. El sistema persiste el nuevo orden  
* **A2**: Movimiento de actividades entre columnas

  1. El usuario arrastra una actividad desde una columna a otra  
  2. Si la columna destino es un bloque de tiempo, el sistema verifica temporalidad  
  3. Si es válido, el sistema mueve la actividad a la nueva columna  
  4. El sistema actualiza el estado de habilitación según la hora actual

### **Postcondiciones**

* El tablero Kanban muestra las columnas de bloques de tiempo creados  
* Las actividades están organizadas en las columnas correspondientes  
* Las actividades en el bloque de tiempo actual están habilitadas  
* Las actividades en bloques futuros están deshabilitadas

### **Estados de entidades**

* **Bloque de tiempo**: Se crean los bloques definidos por el usuario  
* **Tablero Kanban**: Se actualiza con las nuevas columnas  
* **Actividad**: Cambia de "En biblioteca" a "Instanciada" y se asocia a un bloque específico