import "@testing-library/jest-dom";

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveTextContent(text: string): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toBeChecked(): R;
      toBeEmpty(): R;
      toHaveClass(className: string): R;
      toHaveStyle(css: string): R;
      toHaveAttribute(attr: string, value?: string): R;
      toHaveFocus(): R;
    }
  }
}

export {};
