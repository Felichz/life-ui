import "@testing-library/jest-dom";
import "jest-localstorage-mock";

// Polyfill para TextEncoder y TextDecoder
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

// o implementar un mock manual
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
