import "@testing-library/jest-dom";
import { CoreError } from "./src/system/errors";
import "jest-localstorage-mock";

// Polyfill for TextEncoder and TextDecoder
Object.assign(globalThis, {
  TextEncoder: function TextEncoder() {
    return {
      encode: function encode(str: string) {
        const buf = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
          buf[i] = str.charCodeAt(i);
        }
        return buf;
      },
    };
  },
  TextDecoder: function TextDecoder() {
    return {
      decode: function decode(buf: Uint8Array) {
        return String.fromCharCode.apply(null, Array.from(buf));
      },
    };
  },
});

// or implement a manual mock
class LocalStorageMock {
  store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] || null;
  }
  setItem(key: string, value: string) {
    this.store[key] = value;
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new LocalStorageMock() as unknown as Storage;

// Core errors are asserted by code, never by message text
expect.extend({
  toThrowCoreError(received: () => unknown, code: string) {
    try {
      received();
    } catch (error) {
      const actual = (error as { code?: unknown }).code;
      return {
        pass: error instanceof CoreError && actual === code,
        message: () =>
          `expected CoreError "${code}", got ${
            error instanceof CoreError ? `CoreError "${String(actual)}"` : String(error)
          }`,
      };
    }
    return { pass: false, message: () => `expected CoreError "${code}", but nothing was thrown` };
  },
});
