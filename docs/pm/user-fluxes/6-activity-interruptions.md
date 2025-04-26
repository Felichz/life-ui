## **Flujo 6: Registro y gestión de interrupciones**

### **Objetivo**

El usuario registra y gestiona interrupciones de actividades que no pudo completar.

### **Precondiciones**

* Hay un día activo  
* Hay una actividad actualmente activa  
* El usuario necesita interrumpir la actividad antes de completarla

### **Flujo principal**

1. El usuario tiene la actividad "Redactar informe de trabajo" activa desde hace 20 minutos  
2. El usuario hace clic en "Interrumpir" en la tarjeta de la actividad  
3. El sistema registra la hora de interrupción  
4. El sistema muestra un modal con la pregunta: "¿Fue por una causa que podrías evitar en el futuro?"  
5. El usuario selecciona "Sí"  
6. El sistema muestra un campo adicional: "Causa de interrupción"  
7. El sistema muestra un listado de causas previamente registradas (vacío en primer uso)  
8. El usuario hace clic en "Nueva causa"  
9. El sistema muestra un campo de texto  
10. El usuario ingresa "Distracciones por notificaciones del teléfono"  
11. El usuario confirma la causa  
12. El sistema muestra un modal para actualizar variables subjetivas con la actividad interrumpida preseleccionada  
13. El usuario actualiza sus variables subjetivas (sigue Flujo 7\)  
14. El sistema registra la interrupción en el timeline como un punto rojo  
15. El sistema actualiza el timeline mostrando la actividad interrumpida (sin mostrar barra de estimación)  
16. El sistema cambia automáticamente a "Piloto automático" como actividad activa

### **Puntos de decisión**

* **PD1**: ¿La causa de interrupción es evitable?

  * Sí: El sistema solicita detalles sobre la causa  
  * No: El sistema solo registra que hubo una interrupción no evitable  
* **PD2**: ¿Existe la causa en el listado de causas previas?

  * Sí: El usuario selecciona la causa existente  
  * No: El usuario crea una nueva causa

### **Flujos alternativos**

* **A1**: Interrupción por causa no evitable

  1. En el paso 5, el usuario selecciona "No"  
  2. El sistema registra la interrupción sin solicitar detalles adicionales  
  3. Continúa con el paso 12 (actualización de variables subjetivas)  
* **A2**: Selección de causa previamente registrada

  1. Después del paso 7, si existen causas previas, el usuario selecciona una del listado  
  2. El sistema registra esa causa para la interrupción actual  
  3. Continúa con el paso 12

### **Postcondiciones**

* La actividad queda registrada como "Interrumpida" en el historial  
* La causa de interrupción queda registrada (si era evitable)  
* La causa se añade al listado de causas para futuros usos  
* Se muestra un punto rojo de interrupción en el timeline

### **Estados de entidades**

* **Actividad**: Cambia de "Activa" a "Interrumpida"  
* **Causa de interrupción**: Se crea (si es nueva) y se asocia a la actividad  
* **Timeline**: Se actualiza con la barra de actividad parcial y el punto de interrupción  
* **Piloto automático**: Se activa automáticamente tras la interrupción