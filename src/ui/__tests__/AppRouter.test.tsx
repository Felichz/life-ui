import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SystemProvider } from "../context/SystemProvider";
import AppRouter from "../AppRouter";

// Mock de los componentes de página que se cargan lazy
jest.mock("../pages/DayPage", () => ({
  __esModule: true,
  default: () => <div data-testid="day-page">Vista del Día</div>,
}));

jest.mock("../pages/OverviewPage", () => ({
  __esModule: true,
  default: () => <div data-testid="overview-page">Vista de Resumen</div>,
}));

jest.mock("../pages/StartPage", () => ({
  __esModule: true,
  default: () => <div data-testid="start-page">Página de Inicio</div>,
}));

// Mockear el componente RequireActiveDay para controlar directamente
// si permite acceso o redirige
jest.mock("../AppRouter", () => {
  // Importar el módulo original
  const originalModule = jest.requireActual("../AppRouter");

  // Reemplazar solo RequireActiveDay para nuestros tests
  const MockRequireActiveDay = ({ children }: { children: JSX.Element }) => {
    // Siempre permitir el acceso en los tests, sin redirigir
    return children;
  };

  // Devolver el componente original con el RequireActiveDay modificado
  return {
    ...originalModule,
    __esModule: true,
    default: originalModule.default,
    RequireActiveDay: MockRequireActiveDay,
  };
});

// Wrapper personalizado para incluir el contexto necesario
const renderWithProviders = (ui: React.ReactElement, { route = "/" } = {}) => {
  return render(
    <SystemProvider>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </SystemProvider>
  );
};

describe("AppRouter", () => {
  test("renderiza correctamente la página Overview", async () => {
    renderWithProviders(<AppRouter />, { route: "/overview" });

    // Verificar que se muestra el componente OverviewPage
    expect(await screen.findByTestId("overview-page")).toBeInTheDocument();
    expect(screen.queryByTestId("day-page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("start-page")).not.toBeInTheDocument();
  });

  test("renderiza correctamente StartPage", async () => {
    renderWithProviders(<AppRouter />, { route: "/start" });

    // Verificar que se muestra la página StartPage
    expect(await screen.findByTestId("start-page")).toBeInTheDocument();
    expect(screen.queryByTestId("day-page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("overview-page")).not.toBeInTheDocument();
  });
});
