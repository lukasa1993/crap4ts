declare module "node:child_process" {
  export const execSync: any;
  export const spawnSync: any;
}
declare module "node:crypto" { export const createHash: any; }
declare module "node:fs" {
  export const existsSync: any;
  export const mkdirSync: any;
  export const readFileSync: any;
  export const readdirSync: any;
  export const rmSync: any;
  export const statSync: any;
  export const writeFileSync: any;
}
declare module "node:path" {
  export const basename: any;
  export const dirname: any;
  export const extname: any;
  export const isAbsolute: any;
  export const join: any;
  export const relative: any;
  export const resolve: any;
  export const sep: string;
}
declare module "node:util" { export const parseArgs: any; }
declare const process: any;
