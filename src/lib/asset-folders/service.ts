import { and, asc, count, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { assetFolders, assets } from '@/db/schema'

export type AssetFolderSummary = {
  id: string
  name: string
  assetCount: number
  createdAt: number
  updatedAt: number
}

export async function listAssetFolders(workspaceId: string): Promise<AssetFolderSummary[]> {
  const rows = await db
    .select({
      id: assetFolders.id,
      name: assetFolders.name,
      createdAt: assetFolders.createdAt,
      updatedAt: assetFolders.updatedAt,
      assetCount: count(assets.id),
    })
    .from(assetFolders)
    .leftJoin(assets, eq(assets.folderId, assetFolders.id))
    .where(eq(assetFolders.workspaceId, workspaceId))
    .groupBy(assetFolders.id)
    .orderBy(asc(assetFolders.name))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    assetCount: Number(row.assetCount),
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }))
}

export async function countUncategorizedAssets(workspaceId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(assets)
    .where(and(eq(assets.workspaceId, workspaceId), isNull(assets.folderId)))

  return Number(row?.total ?? 0)
}

export async function getAssetFolderById(folderId: string, workspaceId: string) {
  const [row] = await db
    .select()
    .from(assetFolders)
    .where(and(eq(assetFolders.id, folderId), eq(assetFolders.workspaceId, workspaceId)))
    .limit(1)

  return row ?? null
}

export async function createAssetFolder(workspaceId: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed)
    throw new Error('请填写文件夹名称')

  const [row] = await db
    .insert(assetFolders)
    .values({
      workspaceId,
      name: trimmed,
    })
    .returning()

  return row
}

export async function renameAssetFolder(folderId: string, workspaceId: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed)
    throw new Error('请填写文件夹名称')

  const [row] = await db
    .update(assetFolders)
    .set({
      name: trimmed,
      updatedAt: new Date(),
    })
    .where(and(eq(assetFolders.id, folderId), eq(assetFolders.workspaceId, workspaceId)))
    .returning()

  return row ?? null
}

export async function deleteAssetFolder(folderId: string, workspaceId: string): Promise<boolean> {
  const folder = await getAssetFolderById(folderId, workspaceId)
  if (!folder)
    return false

  await db
    .update(assets)
    .set({ folderId: null })
    .where(and(eq(assets.folderId, folderId), eq(assets.workspaceId, workspaceId)))

  await db
    .delete(assetFolders)
    .where(and(eq(assetFolders.id, folderId), eq(assetFolders.workspaceId, workspaceId)))

  return true
}
