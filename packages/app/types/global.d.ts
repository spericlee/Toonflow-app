declare module "process" {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        NODE_ENV: "dev" | "prod" | "electron";
        DATADIR: string;
        BUILDDIR: string;
        PORT?: string;
      }
    }
  }
}