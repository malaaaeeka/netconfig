// src/lib/fireworks.js
// Replaces gemini.js — now calls our own Flask backend
// which handles the Fireworks AI API call securely server-side

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5002'

async function urlToBase64(url) {
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.readAsDataURL(blob)
  })
}

// Converts Gemini-style history [{role, parts:[{text}]}]
// to Fireworks/OpenAI-style history [{role, content}]
function convertHistory(geminiHistory) {
  return geminiHistory.map(item => ({
    role: item.role === 'model' ? 'assistant' : item.role,
    content: item.parts?.[0]?.text ?? item.content ?? ''
  }))
}

export async function askFireworks(
  message,
  history = [],
  systemPromptText = '',   // kept for compatibility but system prompt now lives in backend
  imageUrl = null
) {
  const image_base64 = imageUrl ? await urlToBase64(imageUrl) : null

  const body = {
    message,
    history: convertHistory(history),
    ...(image_base64 && { image_base64 })
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
