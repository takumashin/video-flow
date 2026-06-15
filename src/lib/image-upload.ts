import {
  getImageFiles,
  isImageFile,
  MAX_IMAGE_SIZE,
} from './media-upload-shared'

export { IMAGE_ACCEPT, getImageFiles, isImageFile, MAX_FILE_SIZE } from './media-upload-shared'

export async function uploadImageFile(file: File): Promise<string> {
  if (!isImageFile(file))
    throw new Error('请上传图片文件（JPG、PNG、WebP 等）')

  if (file.size > MAX_IMAGE_SIZE)
    throw new Error('图片大小不能超过 10MB')

  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/uploads', {
    method: 'POST',
    body: formData,
  })

  const result = await response.json()

  if (!response.ok)
    throw new Error(result.error || '上传失败')

  return result.url as string
}

export async function processImageFile(file: File): Promise<string> {
  return uploadImageFile(file)
}

export async function processImageFiles(files: File[]): Promise<string[]> {
  const results: string[] = []
  for (const file of files)
    results.push(await processImageFile(file))
  return results
}
