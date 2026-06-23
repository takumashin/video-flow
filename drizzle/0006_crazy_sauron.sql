CREATE TABLE "asset_folder" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "folderId" text;--> statement-breakpoint
ALTER TABLE "seedance_task" ADD COLUMN "apiTaskId" text;--> statement-breakpoint
ALTER TABLE "seedance_task" ADD COLUMN "submitPayload" jsonb;--> statement-breakpoint
ALTER TABLE "asset_folder" ADD CONSTRAINT "asset_folder_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_folder_workspace_name_idx" ON "asset_folder" USING btree ("workspaceId","name");--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_folderId_asset_folder_id_fk" FOREIGN KEY ("folderId") REFERENCES "public"."asset_folder"("id") ON DELETE set null ON UPDATE no action;