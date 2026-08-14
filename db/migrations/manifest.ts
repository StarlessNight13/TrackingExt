import initialSql from "./0001_initial.sql?raw";

export type Migration = { version: number; name: string; checksum: string; sql: string };

export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: "initial",
    checksum: "sha256:00c7c10358ed77524a47d7d7d00c5e7273e2ab57ad888cf3edc6379e2689f70a",
    sql: initialSql,
  },
];
