import "dotenv/config";

import { createContext } from "@trackingext/api/context";
import { appRouter } from "@trackingext/api/routers/index";
import { auth, getAuthPublicConfig, seedDefaultAdminUser } from "@trackingext/auth";
import { env } from "@trackingext/env/server";
import { resolveCorsOrigin } from "@trackingext/env/cors-origins";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: (origin) =>
      resolveCorsOrigin(origin, env.CORS_ORIGIN, {
        allowPrivateNetworkOrigins: env.NODE_ENV === "development",
      }),
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["set-auth-token"],
    credentials: true,
  }),
);

app.get("/api/auth/config", (c) => c.json(getAuthPublicConfig()));

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

void seedDefaultAdminUser().then((result) => {
  if (result.created) {
    console.log("Seeded default admin user");
  }
}).catch((error) => {
  console.error("Failed to seed default admin user:", error);
});

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context: context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context: context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  await next();
});

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
