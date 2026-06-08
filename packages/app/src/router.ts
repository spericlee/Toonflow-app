// @routes-hash f0799b7d534454769aed14b16191fb9e
import { Express } from "express";

import route1 from "./routes/login/login";

export default async (app: Express) => {
  app.use("/api/login/login", route1);
}
