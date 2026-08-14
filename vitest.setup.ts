process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL ??= `file:${process.cwd()}/.vitest/test.db`;
process.env.BETTER_AUTH_SECRET ??= "test-secret-must-be-at-least-32-chars!!";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.CORS_ORIGIN ??= "http://localhost:3001";
process.env.NODE_ENV ??= "test";
