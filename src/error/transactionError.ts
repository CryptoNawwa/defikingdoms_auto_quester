export class TransactionError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, TransactionError.prototype);
    }
}
