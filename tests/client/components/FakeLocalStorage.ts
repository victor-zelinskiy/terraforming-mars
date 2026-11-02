// A fake version of global.localStorage that  also regsiters as
// the global instance. Used for testing.
export class FakeLocalStorage implements Storage {
  private saved: Storage | undefined;
  private data: {[x: string]: string} = {};

  private static assign(value: any) {
    Object.defineProperty(global, 'localStorage', {value: value, configurable: true, writable: true});
  }
  public static register(localStorage: FakeLocalStorage): void {
    localStorage.saved = (global as any).localStorage;
    this.assign(localStorage);
  }

  public static deregister(localStorage: FakeLocalStorage) {
    this.assign(localStorage.saved);
  }

  public getItem(key: string) {
    if (this.data[key] === undefined) {
      return null;
    }
    return this.data[key];
  }

  public setItem(key: string, value: string) {
    this.data[key] = value;
  }

  public clear(): void {
    this.data = {};
  }

  public get length(): number {
    throw new Error('Not yet implemented');
  }

  key(_index: number): string | null {
    throw new Error('Not yet implemented');
  }

  public removeItem(key: string): void {
    delete this.data[key];
  }

  public hasItem(key: string): boolean {
    return typeof this.data[key] !== 'undefined';
  }
}
