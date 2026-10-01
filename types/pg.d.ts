declare module "pg" {
  export class Pool {
    constructor(config?: Record<string, unknown>);
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
    connect(): Promise<Client>;
    end(): Promise<void>;
    on(event: string, listener: (err: Error) => void): void;
  }
  export class Client {
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
    release(): void;
  }
  const pg: { Pool: typeof Pool };
  export default pg;
}