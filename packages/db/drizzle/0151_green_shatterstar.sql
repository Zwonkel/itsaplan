CREATE TABLE "agent_chat_last_agent" (
	"project_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_chat_last_agent_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "chat_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "default_chat_agent_id" integer;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "default_chat_agent_id" integer;--> statement-breakpoint
ALTER TABLE "agent_chat_last_agent" ADD CONSTRAINT "agent_chat_last_agent_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_chat_last_agent" ADD CONSTRAINT "agent_chat_last_agent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_chat_last_agent" ADD CONSTRAINT "agent_chat_last_agent_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE set null ON UPDATE no action;