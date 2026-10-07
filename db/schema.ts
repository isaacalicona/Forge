import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";

export const rockets = pgTable("rockets", {
  id: serial().primaryKey(),
  name: text().notNull(),
  builder: text().notNull(),
  description: text().notNull().default(""),
  motor: text().notNull().default(""),
  heightM: real("height_m").notNull(),
  weightKg: real("weight_kg").notNull(),
  topSpeedKmh: real("top_speed_kmh").notNull(),
  apogeeM: real("apogee_m"),
  imageKey: text("image_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
