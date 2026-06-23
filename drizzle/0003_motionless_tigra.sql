ALTER TABLE "workspace_invite" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD COLUMN "inviteChannel" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD COLUMN "feishuOpenId" text;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD COLUMN "feishuUnionId" text;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD COLUMN "displayName" text;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invite_workspace_feishu_idx" ON "workspace_invite" USING btree ("workspaceId","feishuOpenId");