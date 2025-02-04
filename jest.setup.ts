import "jest-localstorage-mock";
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

global.localStorage = new LocalStorageMock() as unknown as Storage;
