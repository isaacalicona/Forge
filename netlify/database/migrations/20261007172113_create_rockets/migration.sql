CREATE TABLE "rockets" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"builder" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"motor" text DEFAULT '' NOT NULL,
	"height_m" real NOT NULL,
	"weight_kg" real NOT NULL,
	"top_speed_kmh" real NOT NULL,
	"apogee_m" real,
	"image_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
