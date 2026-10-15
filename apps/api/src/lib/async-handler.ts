import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Express 4 ne capture pas les erreurs des handlers async : une exception non gérée
 * devient une "unhandled rejection" qui peut faire planter le process (API hors ligne
 * => "Failed to fetch" côté navigateur). Ce wrapper les transmet au middleware d'erreur.
 */
export function ah(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
