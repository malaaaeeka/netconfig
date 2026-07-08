const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5002'

async function urlToBase64(url) {
  const response = await fetch(url)
  const blob = await response.blob()
  const mime = blob.type || 'image/png'
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
  console.log('urlToBase64:', url, 'mime:', mime, 'bytes(base64):', data.length)
  return { mime, data }
}

function convertHistory(geminiHistory) {
  return geminiHistory.map(item => ({
    role: item.role === 'model' ? 'assistant' : item.role,
    content: item.parts?.[0]?.text ?? item.content ?? ''
  }))
}

export async function askFireworks(
  message,
  history = [],
  systemPromptText = '',
  imageUrls = null,
  model = 'kimi-k2p7-code'
) {
  const urls = Array.isArray(imageUrls) ? imageUrls : (imageUrls ? [imageUrls] : [])
  const images = await Promise.all(urls.map(url => urlToBase64(url)))

  console.log('askFireworks sending images count:', images.length)

  const body = {
    message,
    history: convertHistory(history),
    ...(images.length > 0 && { images })
  }

  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Backend error')
  }

  return data.reply
}