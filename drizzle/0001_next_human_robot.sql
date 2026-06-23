CREATE TABLE "seedance_task" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"workspaceId" text NOT NULL,
	"taskId" text NOT NULL,
	"prompt" text,
	"nodeTitle" text,
	"model" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"progress" integer,
	"videoUrl" text,
	"remoteVideoUrl" text,
	"errorMessage" text,
	"progressStartedAt" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "lastWorkflowIds" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "seedance_task" ADD CONSTRAINT "seedance_task_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seedance_task" ADD CONSTRAINT "seedance_task_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seedance_task_user_task_idx" ON "seedance_task" USING btree ("userId","taskId");