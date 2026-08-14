# TrackingExt D1 Worker

1. Create a D1 database: `npx wrangler d1 create trackingext`.
2. Copy its `database_id` into `wrangler.jsonc`.
3. Set a long random connection token: `npx wrangler secret put TRACKINGEXT_TOKEN`.
4. Deploy: `npx wrangler deploy`.
5. In TrackingExt, choose **Cloudflare D1 Worker** and enter the deployed Worker URL and that token.

The Worker accepts only authenticated SQL requests from your extension. Keep the Worker URL and token private.
