export class WikiError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class WikiAuthenticationError extends WikiError {}
export class WikiNotFoundError extends WikiError {}
export class WikiTimeoutError extends WikiError {}
export class WikiUnexpectedResponseError extends WikiError {}
