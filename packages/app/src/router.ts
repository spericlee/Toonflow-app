// @routes-hash fa5ef78a96f162288342ee0840eddc99
import { Express } from "express";

import route1 from "./routes/b";

export default async (app: Express) => {
  app.use("/api/b", route1);
}
