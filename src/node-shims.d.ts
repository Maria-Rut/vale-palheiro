/**
 * Minimal ambient declarations so the project type-checks in environments where
 * `@types/node` cannot be installed (this offline sandbox). These cover only
 * the small slice of the Node API the prototype touches.
 *
 * In a normal environment you would instead run `npm i -D @types/node` and
 * delete this file — the real types are a strict superset of what's here.
 */

declare const process: {
  env: Record<string, string | undefined>;
};

declare module "node:http" {
  export interface IncomingMessage {
    url?: string;
    method?: string;
    headers: Record<string, string | string[] | undefined> & { cookie?: string; host?: string };
    on(event: "data", cb: (chunk: Buffer | string) => void): this;
    on(event: "end", cb: () => void): this;
  }
  export interface ServerResponse {
    writeHead(status: number, headers?: Record<string, string>): this;
    setHeader(name: string, value: string): void;
    end(body?: unknown): void;
  }
  export interface Server {
    listen(port: number, host?: string, cb?: () => void): this;
    listen(port: number, cb?: () => void): this;
  }
  export function createServer(
    handler: (req: IncomingMessage, res: ServerResponse) => void,
  ): Server;
  const http: { createServer: typeof createServer };
  export default http;
}

declare module "node:url" {
  export function fileURLToPath(url: string): string;
}

declare module "node:fs" {
  export function readFile(
    path: string,
    cb: (err: Error | null, data: Buffer) => void,
  ): void;
}

declare module "node:path" {
  interface PathApi {
    dirname(p: string): string;
    join(...parts: string[]): string;
    normalize(p: string): string;
    extname(p: string): string;
  }
  const path: PathApi;
  export default path;
  export const dirname: PathApi["dirname"];
  export const join: PathApi["join"];
  export const normalize: PathApi["normalize"];
  export const extname: PathApi["extname"];
}

declare class Buffer {}

declare const __filename: string;
declare const __dirname: string;

interface ImportMeta {
  url: string;
}
