declare module "alpinejs" {
  interface AlpineRuntime {
    data(name: string, callback: () => unknown): void
    start(): void
  }

  const Alpine: AlpineRuntime
  export default Alpine
}
