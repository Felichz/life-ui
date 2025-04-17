## **Flujo 7: Actualización de variables subjetivas**

### **Objetivo**

El usuario actualiza sus variables subjetivas para registrar cambios en su estado personal.

### **Precondiciones**

- Hay un día activo
- El usuario puede estar en cualquier punto de uso de la aplicación

### **Flujo principal**

#### **7.1 Actualización manual de variables**

1. El usuario hace clic en el botón "Actualizar variables subjetivas" en la interfaz principal
2. Si no existen variables subjetivas previas, el sistema muestra "No hay variables definidas"
3. El usuario hace clic en "Nueva variable subjetiva"
4. El sistema muestra un campo para el nombre de la variable
5. El usuario ingresa "Nivel de energía"
6. El usuario confirma la creación de la variable
7. El sistema muestra un slider con escala del 1 al 10 para la nueva variable
8. El usuario mueve el slider a valor 7
9. El usuario repite los pasos 3-8 para crear variables adicionales:
   - "Concentración" (valor inicial: 6\)
   - "Dolor de cabeza" (valor inicial: 2\)
10. El sistema muestra sección "Relacionado con:"
11. El sistema muestra dos multi-select:
    - "Actividades relacionadas" (muestra actividad activa actual preseleccionada, si hay alguna)
    - "Eventos relacionados" (muestra eventos recientes para selección)
12. El usuario mantiene la actividad actual preseleccionada
13. El usuario no selecciona eventos
14. El usuario hace clic en "Aplicar cambios"
15. El sistema guarda el snapshot completo de todas las variables con:
    - Valores actuales
    - Referencias a actividad relacionada
    - Timestamp exacto
16. El sistema cierra el modal
17. El sistema desactiva la posibilidad de actualizar variables por 5 minutos

### **Puntos de decisión**

- **PD1**: ¿Existen variables subjetivas creadas previamente?

  - Sí: Se muestran con sus últimos valores registrados
  - No: Se muestra mensaje y opción para crear nuevas variables

- **PD2**: ¿Hay actividad actualmente activa?

  - Sí: Aparece preseleccionada en "Actividades relacionadas"
  - No: No aparece nada preseleccionado

- **PD3**: ¿Se está actualizando variables tras completar/interrumpir actividad o registrar evento?

  - Sí: La actividad/evento aparece preseleccionada
  - No: Nada aparece preseleccionado

### **Flujos alternativos**

- **A1**: Actualización al completar actividad

  1. El usuario completa una actividad
  2. El sistema muestra automáticamente el modal de actualización de variables
  3. Las variables existentes aparecen con sus valores previos
  4. La actividad completada aparece preseleccionada en "Actividades relacionadas"
  5. El usuario ajusta los valores de las variables
  6. El usuario hace clic en "Aplicar cambios"
  7. El sistema registra los cambios asociados a la actividad

- **A2**: Actualización al registrar evento

  1. El usuario registra un evento puntual
  2. El sistema muestra automáticamente el modal de actualización de variables
  3. El evento registrado aparece preseleccionado en "Eventos relacionados"
  4. Si hay una actividad activa, también aparece preseleccionada
  5. El usuario ajusta los valores y confirma
  6. El sistema registra el snapshot relacionado con el evento

- **A3**: Omisión de actualización de variables

  1. En cualquier momento donde aparezca el modal de actualización
  2. El usuario hace clic en "Omitir actualización"
  3. El sistema no registra nuevos valores de variables
  4. Se continúa con el flujo normal de la acción que gatilló la actualización

### **Postcondiciones**

- Se crea un nuevo snapshot de variables subjetivas
- El snapshot queda relacionado con actividades/eventos seleccionados
- El usuario no puede actualizar variables de nuevo por 5 minutos

### **Estados de entidades**

- **Variables subjetivas**: Se crea un nuevo snapshot con valores actualizados
- **Snapshot**: Se crea con referencias a actividades/eventos relacionados
- **Botón de actualización**: Queda deshabilitado por 5 minutos
