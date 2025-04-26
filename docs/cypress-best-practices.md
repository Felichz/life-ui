# Buenas Prácticas para Pruebas en Cypress

Este documento recopila las mejores prácticas para escribir pruebas estables y mantenibles con Cypress, basadas en nuestras experiencias y aprendizajes.

## Principios Generales

1. **Seguir el flujo real del usuario**:

   - Siempre preferir interacciones que simulen el comportamiento real de un usuario.
   - Evitar mocks complejos a menos que sean absolutamente necesarios.
   - Mantener las pruebas enfocadas en el comportamiento de la aplicación, no en su implementación.

2. **Conocer la base de código**:
   - Familiarizarse con el código fuente para entender las mejores formas de seleccionar elementos.
   - Comprender la estructura del DOM de la aplicación.

## Selectores y Elementos DOM

3. **Preferencia de selectores** (en orden):

   - Atributos `data-testid` (ideal para componentes complejos)
   - Atributos `aria-label` (bueno para accesibilidad)
   - Contenido de texto con `cy.contains()` (para botones y elementos textuales)
   - Asociación con etiquetas para inputs
   - Selectores CSS básicos como último recurso

4. **Usar `cy.contains()` para interacciones basadas en texto**:

   ```javascript
   cy.contains("Guardar").click();
   cy.contains("button", "Añadir").click();
   ```

5. **Asociar inputs con sus etiquetas**:

   ```javascript
   cy.contains("label", "Correo electrónico")
     .invoke("attr", "for")
     .then((id) => {
       cy.get(`#${id}`).type("usuario@ejemplo.com");
     });
   ```

6. **Selectores genéricos como último recurso**:

   - Cuando no hay alternativas mejores: `cy.get('input').first()`
   - Preferir siempre selectores más específicos cuando sea posible

7. **Evitar selectores frágiles**:
   - Evitar índices arbitrarios cuando sea posible
   - No depender de clases internas de bibliotecas
   - No confiar en la posición exacta de elementos en el DOM

## Sincronización y Esperas

8. **Gestionar modales y elementos dinámicos**:

   - Usar `cy.wait()` después de acciones que desencadenan cambios asíncronos
   - Para modales o popups:

   ```javascript
   cy.contains("Abrir modal").click();
   cy.wait(300); // Dar tiempo para que el modal se muestre completamente
   cy.get('[data-testid="modal"]').within(() => {
     // Interactuar con elementos dentro del modal
   });
   ```

9. **Esperar por eventos específicos** en lugar de tiempos fijos:
   ```javascript
   cy.intercept("GET", "/api/datos").as("datosCargados");
   cy.visit("/pagina");
   cy.wait("@datosCargados");
   ```

## Mantenibilidad

10. **Usar `data-testid` para componentes complejos**:

    - Añadir atributos `data-testid` a componentes que son difíciles de seleccionar
    - Mantener consistencia en la nomenclatura

11. **Mantener las pruebas legibles**:

    - Agrupar acciones relacionadas
    - Usar comentarios para explicar pasos complejos
    - Crear comandos personalizados para acciones repetitivas

12. **Depuración DOM dinámica**:
    - Usar `cy.debug()` para pausar la ejecución
    - Inspeccionar estructura DOM con `cy.log($el)` después de obtener elementos

## Consejos Avanzados

13. **Evitar dependencias en clases internas**:

    - Las clases CSS pueden cambiar con actualizaciones
    - Preferir atributos específicos para pruebas o contenido semántico

14. **Sincronizar después de cambios de estado**:

    - Asegurarse que la UI está estable antes de continuar
    - Verificar que los elementos estén visibles/habilitados antes de interactuar

15. **Priorizar la estabilidad sobre la velocidad**:
    - Pruebas más lentas pero estables son preferibles a pruebas rápidas pero frágiles

## Antipatrones a Evitar

1. Confiar en índices arbitrarios (`cy.get('button').eq(3)`)
2. Usar selectores excesivamente genéricos
3. No esperar correctamente después de cambios de estado
4. Pruebas que dependen del orden de ejecución

## Buenas Prácticas para Estructura de Pruebas

1. **Organizar por características**:

   - Agrupar pruebas relacionadas en el mismo archivo
   - Usar nombres descriptivos para archivos y suites

2. **Seguir el patrón Arrange-Act-Assert**:
   - Preparar el estado inicial
   - Realizar la acción
   - Verificar el resultado esperado

---

Documento creado como referencia para el equipo. Actualizar según se descubran nuevas prácticas recomendadas o desafíos.
