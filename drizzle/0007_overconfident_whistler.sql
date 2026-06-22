CREATE TABLE "workflow_version" (
	"id" text PRIMARY KEY NOT NULL,
	"workflowId" text NOT NULL,
	"revision" integer NOT NULL,
	"branchName" text DEFAULT 'main' NOT NULL,
	"nodes" jsonb NOT NULL,
	"edges" jsonb NOT NULL,
	"name" text NOT NULL,
	"label" text,
	"description" text,
	"type" text DEFAULT 'auto' NOT NULL,
	"createdBy" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_workflowId_workflow_id_fk" FOREIGN KEY ("workflowId") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_version_branch_revision_idx" ON "workflow_version" USING btree ("workflowId","branchName","revision" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workflow_version_branch_created_idx" ON "workflow_version" USING btree ("workflowId","branchName","createdAt" DESC NULLS LAST);