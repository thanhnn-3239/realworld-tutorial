export class PiscinaTaskTimeoutError extends Error {
  constructor(message = 'Piscina task timed out') {
    super(message);
    this.name = 'PiscinaTaskTimeoutError';
    Object.setPrototypeOf(this, PiscinaTaskTimeoutError.prototype);
  }
}
