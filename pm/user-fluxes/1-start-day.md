## **Flujo 1: Inicio del día**

### **Objetivo**

El usuario inicia un nuevo día en la aplicación para comenzar a registrar y organizar sus actividades.

### **Precondiciones**

- La aplicación está instalada y correctamente configurada
- No hay un día activo en curso
- Si no es el primer uso, se muestra la página de overview con datos del día anterior

### **Flujo principal**

1. El usuario abre la aplicación Qualia Control
2. El sistema muestra la pantalla de overview con datos del día anterior (si no es el primer uso)
3. El usuario visualiza el botón prominente "Comenzar día" en la parte superior de la interfaz
4. El usuario hace clic en el botón "Comenzar día"
5. El sistema registra la fecha y hora actual como inicio del día
6. El sistema inicializa el estado de "Piloto automático" como actividad activa por defecto
7. El sistema muestra la interfaz principal del día con:
   - Tablero Kanban vacío con la columna "Por Hacer"
   - Timeline horizontal de 24 horas con indicador de hora actual
   - Barra de acceso rápido con actividades del sistema (Piloto automático, Meditación, Descanso consciente)
   - Botón de finalizar día (con icono representativo de irse a dormir)
   - Botón para ver la pantalla de overview
   - Botón para gestionar la biblioteca de actividades
   - Botón para gestionar los bloques de tiempo
   - Botón para actualizar variables subjetivas

### **Puntos de decisión**

- **PD1**: ¿Es el primer uso de la aplicación?
  - Sí: Se muestra una interfaz vacía de overview con mensaje orientativo
  - No: Se muestran los datos del día anterior

### **Flujos alternativos**

- **A1**: El usuario navega a la biblioteca de actividades sin iniciar el día
  1. El usuario hace clic en "Gestionar biblioteca de actividades" desde la pantalla de overview
  2. El sistema muestra la interfaz de gestión de la biblioteca sin necesidad de iniciar un día
  3. El usuario puede crear/editar actividades en la biblioteca
  4. El usuario puede volver a la pantalla de overview

### **Postcondiciones**

- Hay un día activo en el sistema
- La actividad "Piloto automático" está activa por defecto
- El usuario puede comenzar a organizar y activar actividades

### **Estados de entidades**

- **Día**: Cambia de "No activo" a "Activo"
- **Actividad sistema (Piloto automático)**: Cambia a "Activa"
- **Timeline**: Se inicializa mostrando actividad "Piloto automático" desde la hora de inicio
