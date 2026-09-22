import { imageIssue, MAX_IMAGE_BYTES, resizedDimensions } from './model'

export async function compressImage(file: File): Promise<File> {
  const issue = imageIssue(file)
  if (issue) throw new Error(issue)
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }) }
  catch { throw new Error('Cette image est illisible. Choisissez un autre fichier.') }
  try {
    const size = resizedDimensions(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = size.width; canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('La compression des images n’est pas disponible dans ce navigateur.')
    // Reduce both quality and dimensions if necessary; never upload an oversized file.
    for (let scale = 0; scale < 5; scale++) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.86, 0.72, 0.58, 0.44]) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
        if (blob && ['image/webp', 'image/jpeg'].includes(blob.type) && blob.size < MAX_IMAGE_BYTES) {
          return new File([blob], `image.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`, { type: blob.type })
        }
        // Browsers without WebP encoding can still produce JPEG.
        if (blob?.type !== 'image/webp') {
          const jpeg = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
          if (jpeg && jpeg.size < MAX_IMAGE_BYTES) return new File([jpeg], 'image.jpg', { type: 'image/jpeg' })
        }
      }
      canvas.width = Math.max(1, Math.floor(canvas.width * 0.75))
      canvas.height = Math.max(1, Math.floor(canvas.height * 0.75))
    }
    throw new Error('Impossible de réduire cette image sous 400 Ko. Choisissez une autre image.')
  } finally { bitmap.close() }
}
