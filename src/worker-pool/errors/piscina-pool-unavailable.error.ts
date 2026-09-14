export class PiscinaPoolUnavailableError extends Error {
  constructor(message = 'Piscina pool is unavailable', options?: ErrorOptions) {
    super(message, options);
    this.name = 'PiscinaPoolUnavailableError';
    Object.setPrototypeOf(this, PiscinaPoolUnavailableError.prototype);
  }
}
