import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async (_req: Request, context: Context) => {
  const { key } = context.params;
  if (!KEY_PATTERN.test(key)) return new Response("Not found", { status: 404 });

  const store = getStore("rocket-images");

  const meta = await store.getMetadata(key);
  const data = meta && (await store.get(key, { type: "stream" }));
  if (!meta || !data) return new Response("Not found", { status: 404 });

  return new Response(data, {
    headers: {
      "Content-Type": String(meta.metadata.contentType ?? "application/octet-stream"),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

export const config: Config = {
  path: "/api/rocket-images/:key",
  method: "GET",
};
