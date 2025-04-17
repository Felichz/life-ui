## **Flujo 4: Activación y finalización de actividades**

### **Objetivo**

El usuario activa, monitorea y finaliza diferentes tipos de actividades durante su día.

### **Precondiciones**

- Hay un día activo
- Existen actividades instanciadas en el tablero Kanban
- Al menos una actividad está en un bloque de tiempo actual o en "Por Hacer"

### **Flujo principal**

#### **4.1 Activación de actividad con objetivo claro**

1. El usuario identifica la actividad "Redactar informe de trabajo" (tipo: con objetivo claro) en la columna del bloque actual
2. El usuario hace clic en el botón "Activar" de la tarjeta de actividad
3. El sistema verifica que no haya otra actividad activa
   - Si había otra actividad activa (ej. Piloto automático), el sistema la finaliza automáticamente
4. El sistema registra la hora de inicio de la actividad
5. El sistema actualiza el timeline mostrando la actividad como activa
6. El sistema muestra un cronómetro ascendente en la tarjeta de la actividad, indicando tiempo transcurrido
7. El sistema muestra barra de estimación (\~60 min) como referencia en el timeline
8. El usuario trabaja en la actividad durante 70 minutos
9. El usuario hace clic en "Completar" en la tarjeta de actividad
10. El sistema registra la hora de finalización (70 minutos después del inicio)
11. El sistema muestra modal para actualizar variables subjetivas con la actividad preseleccionada
12. El usuario actualiza sus variables subjetivas (Flujo 7\)
13. El sistema actualiza el timeline mostrando:
    - Barra completa de actividad (70 min)
    - Barra de estimación en rojo (excedió tiempo estimado)
14. El sistema cambia automáticamente a "Piloto automático" como actividad activa
15. El sistema elimina la instancia de actividad del tablero Kanban

### **Puntos de decisión**

- **PD1**: ¿Hay otra actividad activa al intentar activar una nueva?

  - Sí: El sistema finaliza la actividad actual antes de activar la nueva
  - No: Se activa directamente la nueva actividad

- **PD2**: ¿El usuario completa la actividad dentro del tiempo estimado?

  - Sí: La barra de estimación se muestra en verde en el timeline
  - No: La barra de estimación se muestra en rojo en el timeline

- **PD3**: ¿El usuario decide interrumpir la actividad en lugar de completarla?

  - Sí: Se inicia el flujo de interrupción (Flujo 6\)
  - No: La actividad se completa normalmente

### **Flujos alternativos**

- **A1**: Activación de actividad con duración flexible

  1. El usuario activa una actividad "Barrer la casa" (tipo: duración flexible, rango: 5-10 min)
  2. El sistema registra el inicio y muestra el rango de tiempo como referencia
  3. El sistema no muestra alertas durante la actividad
  4. El usuario completa la actividad en 8 minutos
  5. El sistema registra que el tiempo real cayó dentro del rango estimado
  6. El timeline muestra la barra de rango en verde (dentro de rango)

- **A2**: Activación de actividad con timeboxing (tiempo mínimo)

  1. El usuario activa una actividad "Leer libro" (tipo: timeboxing, mínimo: 20 min)
  2. El sistema registra el inicio y muestra contador descendente hacia el mínimo
  3. Al llegar a los 20 minutos, el sistema muestra una notificación discreta
  4. El usuario puede decidir continuar (está en flujo) por 15 minutos más
  5. El usuario completa la actividad después de 35 minutos totales
  6. El sistema registra que se cumplió el tiempo mínimo y se extendió voluntariamente

- **A3**: Activación desde barra de acceso rápido

  1. El usuario hace clic en "Meditación" en la barra de acceso rápido
  2. El sistema muestra modal para configurar propiedades dinámicas
  3. El usuario configura timeboxing (mínimo 10 minutos)
  4. El usuario confirma y la actividad se activa inmediatamente
  5. Al completarse, sigue el flujo normal de finalización

### **Postcondiciones**

- La actividad completada se registra en el historial del día
- La actividad desaparece del tablero Kanban
- El timeline muestra la actividad con su duración real
- Se vuelve a "Piloto automático" como actividad por defecto

### **Estados de entidades**

- **Actividad**: Cambia de "Instanciada" a "Activa" y luego a "Completada"
- **Timeline**: Se actualiza mostrando la actividad con su duración real y comparativa con estimación
- **Piloto automático**: Se activa automáticamente tras completar la actividad
