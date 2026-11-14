import type postgres from "postgres";

export declare const SCHEMA_STATEMENTS: string[];
export declare function migrate(sql: postgres.Sql): Promise<void>;
export declare const dateAsString: {
  to: number;
  from: number[];
  serialize: (x: string) => string;
  parse: (x: string) => string;
};
