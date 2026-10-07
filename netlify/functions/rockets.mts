import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { rockets } from "../../db/schema.js";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

const toClient = (r: typeof rockets.$inferSelect) => ({
  ...r,
  imageUrl: `/api/rocket-images/${r.imageKey}`,
});

const text = (form: FormData, key: string, max: number) =>
  String(form.get(key) ?? "").trim().slice(0, max);

const num = (form: FormData, key: string) => {
  const raw = String(form.get(key) ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export default async (req: Request) => {
  if (req.method === "GET") {
    const rows = await db.select().from(rockets).orderBy(desc(rockets.createdAt)).limit(200);
    return Response.json(rows.map(toClient));
  }

  if (req.method === "POST") {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return Response.json({ error: "Expected a multipart form upload." }, { status: 400 });
    }

    const name = text(form, "name", 80);
    const builder = text(form, "builder", 80);
    const description = text(form, "description", 600);
    const motor = text(form, "motor", 40);
    const heightM = num(form, "heightM");
    const weightKg = num(form, "weightKg");
    const topSpeedKmh = num(form, "topSpeedKmh");
    const apogeeM = num(form, "apogeeM");
    const image = form.get("image");

    const errors: Record<string, string> = {};
    if (!name) errors.name = "Give your rocket a name.";
    if (!builder) errors.builder = "Tell us who built it.";
    if (heightM === null || Number.isNaN(heightM) || heightM === 0) errors.heightM = "Enter a height in metres.";
    if (weightKg === null || Number.isNaN(weightKg) || weightKg === 0) errors.weightKg = "Enter a weight in kilograms.";
    if (topSpeedKmh === null || Number.isNaN(topSpeedKmh)) errors.topSpeedKmh = "Enter a top speed in km/h.";
    if (Number.isNaN(apogeeM)) errors.apogeeM = "Apogee must be a positive number.";
    if (!(image instanceof File) || image.size === 0) errors.image = "Add a photo of your rocket.";
    else if (!IMAGE_TYPES.includes(image.type)) errors.image = "Use a JPG, PNG, WebP, GIF or AVIF image.";
    else if (image.size > MAX_IMAGE_BYTES) errors.image = "Images must be 4 MB or smaller.";

    if (Object.keys(errors).length) {
      return Response.json({ error: "Some fields need attention.", fields: errors }, { status: 422 });
    }

    const file = image as File;
    const imageKey = crypto.randomUUID();
    const images = getStore("rocket-images");
    await images.set(imageKey, file, {
      metadata: { contentType: file.type },
    });

    let row: typeof rockets.$inferSelect;
    try {
      [row] = await db
        .insert(rockets)
        .values({
          name,
          builder,
          description,
          motor,
          heightM: heightM!,
          weightKg: weightKg!,
          topSpeedKmh: topSpeedKmh!,
          apogeeM: apogeeM ?? null,
          imageKey,
        })
        .returning();
    } catch (err) {
      await images.delete(imageKey);
      throw err;
    }

    return Response.json(toClient(row), { status: 201 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/rockets",
};
