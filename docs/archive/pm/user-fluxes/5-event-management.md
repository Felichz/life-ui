## **Flujo 5: Manejo de eventos puntuales**

### **Objetivo**

El usuario registra eventos puntuales que pueden influir en sus variables subjetivas.

### **Precondiciones**

- Hay un día activo
- El usuario está en la vista principal del día
- Puede o no haber una actividad en curso

### **Flujo principal**

1. El usuario hace clic en el botón "Gestionar biblioteca de eventos"
2. El sistema muestra la interfaz de gestión de eventos
3. El usuario hace clic en "Nuevo evento"
4. El sistema muestra un formulario con campo:
   - Nombre del evento (texto)
5. El usuario ingresa "Tomar café"
6. El usuario hace clic en "Guardar evento"
7. El sistema guarda el evento en la biblioteca de eventos
8. El usuario repite los pasos 3-7 para crear eventos adicionales (ej. "Tomar medicación para dolor de cabeza")
9. El usuario vuelve a la vista principal del día
10. El usuario identifica el evento "Tomar café" en la barra de eventos de acceso rápido
11. El usuario hace clic en el evento "Tomar café"
12. El sistema registra el evento en el momento actual
13. El sistema muestra un modal para actualizar variables subjetivas con el evento preseleccionado
14. El usuario actualiza sus variables subjetivas (sigue Flujo 7\)
15. El sistema registra el evento en el timeline como un punto circular azul
16. Al hacer hover sobre el punto en el timeline, se muestra el nombre del evento

### **Puntos de decisión**

- **PD1**: ¿El usuario desea actualizar las variables subjetivas al registrar el evento?
  - Sí: Sigue el Flujo 7 con el evento preseleccionado
  - No: Cierra el modal y solo registra el evento

### **Flujos alternativos**

- **A1**: Registro de evento sin actualizar variables

  1. Después del paso 12, el usuario hace clic en "Omitir actualización de variables"
  2. El sistema solo registra el evento sin actualizar variables subjetivas
  3. El evento aparece en el timeline como un punto circular azul

- **A2**: Consulta de eventos históricos

  1. El usuario hace hover sobre un punto de evento en el timeline
  2. El sistema muestra un tooltip con el nombre del evento
  3. El usuario hace clic en el punto de evento
  4. El sistema muestra detalles del evento incluyendo hora exacta y cualquier actualización de variables asociada

### **Postcondiciones**

- El evento queda registrado en el timeline del día
- Si se actualizaron variables subjetivas, quedan asociadas al evento

### **Estados de entidades**

- **Evento**: Se crea en la biblioteca y se instancia en el timeline
- **Timeline**: Se actualiza con el marcador del evento
- **Variables subjetivas**: Pueden actualizarse y quedar relacionadas con el evento
