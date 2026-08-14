import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";

/** Vercel Node launcher entry — Express app is a (req, res, next) function. */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  app(req, res);
}
