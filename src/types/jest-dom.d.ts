import "@testing-library/jest-dom";

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveTextContent(text: string | RegExp): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toBeChecked(): R;
      toBeEmpty(): R;
      toHaveClass(className: string): R;
      toHaveStyle(css: string): R;
      toHaveAttribute(attr: string, value?: string): R;
      toHaveFocus(): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHTML(htmlText: string): R;
      toHaveValue(value?: string | string[] | number): R;
      toBeRequired(): R;
      toBeInvalid(): R;
      toBeValid(): R;
      toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R;
    }
  }
}
