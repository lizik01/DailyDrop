CREATE TYPE "public"."digest_source" AS ENUM('llm', 'fallback');--> statement-breakpoint
CREATE TYPE "public"."digest_status" AS ENUM('generated', 'sent', 'delivered', 'opened', 'bounced', 'complained', 'failed');--> statement-breakpoint
CREATE TYPE "public"."subscriber_status" AS ENUM('active', 'paused', 'unsubscribed', 'bounced');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"source" text NOT NULL,
	"snippet" text,
	"published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "digest_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digest_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"headline" text NOT NULL,
	"blurb" text NOT NULL,
	"why_you" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscriber_id" uuid NOT NULL,
	"day" date NOT NULL,
	"content" jsonb NOT NULL,
	"source" "digest_source" NOT NULL,
	"status" "digest_status" DEFAULT 'generated' NOT NULL,
	"resend_email_id" text,
	"sent_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" text NOT NULL,
	"resend_email_id" text NOT NULL,
	"digest_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "email_events_webhook_id_unique" UNIQUE("webhook_id")
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" text NOT NULL,
	"model" text NOT NULL,
	"attempt" smallint NOT NULL,
	"ok" boolean NOT NULL,
	"error" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"steps" smallint,
	"latency_ms" integer NOT NULL,
	"subscriber_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"interest_prompt" text NOT NULL,
	"profile" jsonb NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"send_hour" smallint DEFAULT 7 NOT NULL,
	"status" "subscriber_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "digest_items" ADD CONSTRAINT "digest_items_digest_id_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "public"."digests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_items" ADD CONSTRAINT "digest_items_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digests" ADD CONSTRAINT "digests_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_digest_id_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "public"."digests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_published_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "articles_search_idx" ON "articles" USING gin (to_tsvector('english', "title" || ' ' || coalesce("snippet", '')));--> statement-breakpoint
CREATE INDEX "digest_items_digest_idx" ON "digest_items" USING btree ("digest_id");--> statement-breakpoint
CREATE UNIQUE INDEX "digests_subscriber_day_idx" ON "digests" USING btree ("subscriber_id","day");--> statement-breakpoint
CREATE INDEX "digests_resend_email_idx" ON "digests" USING btree ("resend_email_id");--> statement-breakpoint
CREATE INDEX "email_events_digest_idx" ON "email_events" USING btree ("digest_id");--> statement-breakpoint
CREATE INDEX "llm_calls_created_idx" ON "llm_calls" USING btree ("created_at");