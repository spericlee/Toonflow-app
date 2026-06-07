import "./src/env"
import { defineConfig } from 'drizzle-kit'
import getPath from "./src/utils/getPath";

// 专用于 `drizzle-kit pull`（introspect）：
// 从现有数据库（例如在 drizzle studio 中创建的表）反向生成 schema 到 src/utils/db/schema 下。
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
