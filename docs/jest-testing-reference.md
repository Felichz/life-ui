# Guía de Referencia para Testing UI

Este documento proporciona consejos prácticos y patrones para tests de componentes UI en life-ui.

## Configuración de Mocks

### Mock de useSystemCore (fundamental)

```js
// En tu archivo de test
import { useSystemCore } from '../hooks/useSystemCore';
jest.mock('../hooks/useSystemCore');

// Define un objeto base con los métodos necesarios
beforeEach(() => {
  (useSystemCore as jest.Mock).mockReturnValue({
    isDayActive: jest.fn().mockReturnValue(true),
    getActiveActivity: jest.fn().mockReturnValue(null),
    createActivityInstance: jest.fn(),
    completeActivity: jest.fn(),
    getTimeBlocks: jest.fn().mockReturnValue([]),
    // Añade otros métodos según necesites
  });
});
```

### Mock de Drag & Drop (@hello-pangea/dnd)

```js
jest.mock("@hello-pangea/dnd", () => ({
  Draggable: ({ children }) =>
    children(
      {
        draggableProps: { "data-rfd-draggable-id": "test-id" },
        dragHandleProps: { tabIndex: 0 },
        innerRef: () => {},
      },
      { isDragging: false }
    ),

  Droppable: ({ children }) =>
    children(
      {
        droppableProps: {},
        innerRef: () => {},
        placeholder: null,
      },
      {}
    ),

  DragDropContext: ({ children }) => <>{children}</>,
}));
```

### Mock de React Router

```js
import { MemoryRouter } from "react-router-dom";

// Mock de useNavigate para verificar redirecciones
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

// Uso para tests
render(
  <MemoryRouter initialEntries={["/start"]}>
    <ComponenteConNavegacion />
  </MemoryRouter>
);

// Verificar redirección
expect(mockNavigate).toHaveBeenCalledWith("/day");
```

## Patrones de Test Efectivos

### Simular múltiples estados del sistema

```js
test('muestra mensaje cuando no hay día activo', () => {
  // Sobrescribir mock para un día inactivo
  (useSystemCore as jest.Mock).mockImplementation(() => ({
    ...commonMock,
    isDayActive: () => false,
  }));

  render(<DayPage />);
  expect(screen.getByText("No hay un día activo")).toBeInTheDocument();
});
```

### Verificar comportamiento de modales

```js
test("abre y cierra el modal de biblioteca", () => {
  render(<DayPage />);

  // Inicialmente cerrado
  expect(screen.getByTestId("modal")).toHaveAttribute("data-open", "false");

  // Abrir modal
  fireEvent.click(screen.getByLabelText("abrir biblioteca"));
  expect(screen.getByTestId("modal")).toHaveAttribute("data-open", "true");

  // Cerrar modal
  fireEvent.click(screen.getByText("Cerrar"));
  expect(screen.getByTestId("modal")).toHaveAttribute("data-open", "false");
});
```

### Testing de botones condicionales

```js
test("muestra botón Activar solo cuando condiciones adecuadas", () => {
  // Con día activo y bloque disponible
  render(<KanbanCard {...props} isDayActive={true} isTimeBlockAvailable={true} />);
  expect(screen.getByTestId("activate-button")).toBeInTheDocument();

  // Con día inactivo, botón no debe existir
  rerender(<KanbanCard {...props} isDayActive={false} />);
  expect(screen.queryByTestId("activate-button")).not.toBeInTheDocument();

  // Con bloque no disponible, botón debe estar deshabilitado
  rerender(<KanbanCard {...props} isDayActive={true} isTimeBlockAvailable={false} />);
  expect(screen.getByTestId("activate-button")).toBeDisabled();
});
```

### Testing de estilos computados (Timeline)

```js
test("posiciona elementos según momento del día", () => {
  render(<Timeline activities={mockActivities} events={[]} />);

  const activityBar = screen.getByTestId("timeline-bar-act-1");
  const styles = window.getComputedStyle(activityBar);

  // Verificar posición relativa (ej. 09:00 = 37.5% del día)
  // Mejor comprobar rangos que valores exactos por zonas horarias
  const leftPosition = parseFloat(styles.left);
  expect(leftPosition).toBeGreaterThanOrEqual(35);
  expect(leftPosition).toBeLessThanOrEqual(40);
});
```

### Testing de interacción con tooltips/hovers

```js
test("muestra tooltip al hacer hover", async () => {
  const user = userEvent.setup();
  render(<Timeline activities={mockActivities} />);

  // Interactuar con un elemento
  const activityBar = screen.getByTestId("timeline-bar-act-1");
  await user.hover(activityBar);

  // Verificar que aparece tooltip (puede estar fuera del componente)
  expect(await screen.findByText(/Duración: 1h 30m/i)).toBeInTheDocument();
});
```

## Consejos Prácticos

1. **Usa queries accesibles**: Prefiere `getByRole`, `getByText` sobre `getByTestId`.

2. **Limpia mocks entre tests**: Usa `beforeEach(() => { jest.clearAllMocks(); })`.

3. **Para eventos temporales**: Mockea `Date.now()` y `requestAnimationFrame`.

4. **Componentes con referencias**: Usa `React.forwardRef` en mocks.

5. **Flujos completos**: Para test de finalización del día:

   ```js
   // Clic en botón → Abrir modal → Confirmar → Verificar efectos
   fireEvent.click(screen.getByLabelText("finalizar día"));
   fireEvent.click(screen.getByTestId("confirm-end-day-button"));
   expect(mockEndDay).toHaveBeenCalled();
   ```

6. **Usa `data-testid` estratégicamente**: Solo cuando no hay alternativa accesible.

7. **Para hooks**: Usa `renderHook` y `act` para comprobar cambios de estado.

   ```js
   const { result } = renderHook(() => useDragDrop());
   act(() => { result.current.handleDragStart({...}); });
   expect(result.current.isDragging).toBe(true);
   ```

8. **Testing de fechas/horas**: Evita depender de zonas horarias, verifica rangos.
