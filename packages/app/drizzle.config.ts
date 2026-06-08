import "./src/env"
import { defineConfig } from 'drizzle-kit'
import getPath from "./src/utils/getPath";

export default defineConfig({
  schema: "./src/utils/db/schema/schema.ts",
  out: "./src/utils/db/schema",
  dialect: "sqlite",
  dbCredentials: {
    url: getPath("data", "sqlite.db"),
  },
  introspect: {
    casing: 'preserve',
  },
})
