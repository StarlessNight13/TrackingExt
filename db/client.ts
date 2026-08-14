import type { Client, InStatement, ResultSet } from "@libsql/client";

export type DatabaseClient = Pick<Client, "execute" | "batch">;
export type Statement = InStatement;
export type QueryResult = ResultSet;
