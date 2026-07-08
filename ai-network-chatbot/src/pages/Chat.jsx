import { useState, useRef, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth, db } from '../lib/firebase'
import { collection, addDoc, serverTimestamp, setDoc, doc, query, where, getDocs } from 'firebase/firestore'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CommandBlock from '../components/CommandBlock'
import ProtocolSidebar from '../components/ProtocolSidebar'
import { systemPrompt, protocolPrompts } from '../prompts/systemPrompt'
import { askFireworks } from '../lib/fireworks'

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

const GEMINI_MODELS = [
  { id: 'kimi-k2p7-code', label: 'Kimi K2.7 Code', desc: 'Vision + Code' },
]

async function uploadToCloudinary(file) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  )
  const data = await response.json()
  if (data.error) throw new Error('Cloudinary upload failed: ' + data.error.message)
  return data.secure_url
}

async function urlToBase64(url) {
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.readAsDataURL(blob)
  })
}


// ─── Inline markdown (bold, italic, inline code) ──────────────────────────────
function renderInline(text) {
  const parts = []
  const regex = /(\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*)/g
  let last = 0, match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[2]) parts.push(<strong key={match.index} style={{ color: '#e8e3dc', fontWeight: '600' }}>{match[2]}</strong>)
    else if (match[3]) parts.push(<code key={match.index} style={{ background: '#141414', color: '#e8c9b8', padding: '1px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}>{match[3]}</code>)
    else if (match[4]) parts.push(<em key={match.index} style={{ color: '#b8b3ac', fontStyle: 'italic' }}>{match[4]}</em>)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 0 ? parts : text
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────
function MarkdownText({ text }) {
  const lines = text.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++ }
      elements.push(
        <div key={`code-${i}`} style={{ background: '#141414', border: '1px solid #1a1a1a', borderRadius: '10px', margin: '12px 0', overflow: 'hidden' }}>
          {lang && <div style={{ padding: '6px 14px', background: '#141414', borderBottom: '1px solid #1a1a1a', fontSize: '11px', color: '#6b7280', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{lang}</div>}
          <pre style={{ margin: 0, padding: '14px 16px', overflowX: 'auto', fontSize: '13px', lineHeight: '1.65', color: '#4ade80', fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace" }}>
            {codeLines.join('\n')}
          </pre>
        </div>
      )
      i++; continue
    }

    // Headings
    if (line.startsWith('### ')) { elements.push(<h3 key={i} style={{ fontSize: '15px', fontWeight: '600', color: '#d1ccc6', margin: '16px 0 4px', lineHeight: 1.4 }}>{renderInline(line.slice(4))}</h3>); i++; continue }
    if (line.startsWith('## '))  { elements.push(<h2 key={i} style={{ fontSize: '17px', fontWeight: '600', color: '#e0dbd4', margin: '20px 0 6px', lineHeight: 1.4 }}>{renderInline(line.slice(3))}</h2>); i++; continue }
    if (line.startsWith('# '))   { elements.push(<h1 key={i} style={{ fontSize: '20px', fontWeight: '600', color: '#e8e3dc', margin: '24px 0 8px', lineHeight: 1.3 }}>{renderInline(line.slice(2))}</h1>); i++; continue }

    // Bullet list
    if (line.match(/^[-*] /)) {
      const items = []
      while (i < lines.length && lines[i].match(/^[-*] /)) { items.push(lines[i].slice(2)); i++ }
      elements.push(
        <ul key={`ul-${i}`} style={{ margin: '6px 0', paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {items.map((item, idx) => <li key={idx} style={{ color: '#c9c3bc', fontSize: '14px', lineHeight: '1.7' }}>{renderInline(item)}</li>)}
        </ul>
      )
      continue
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const items = []
      while (i < lines.length && lines[i].match(/^\d+\. /)) { items.push(lines[i].replace(/^\d+\. /, '')); i++ }
      elements.push(
        <ol key={`ol-${i}`} style={{ margin: '6px 0', paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {items.map((item, idx) => <li key={idx} style={{ color: '#c9c3bc', fontSize: '14px', lineHeight: '1.7' }}>{renderInline(item)}</li>)}
        </ol>
      )
      continue
    }

    // HR
    if (line.match(/^---+$/)) { elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #1a1a1a', margin: '16px 0' }} />); i++; continue }

    // Empty line
    if (line.trim() === '') { elements.push(<div key={i} style={{ height: '6px' }} />); i++; continue }

    // Paragraph
    elements.push(<p key={i} style={{ margin: '0', color: '#c9c3bc', fontSize: '14.5px', lineHeight: '1.75', letterSpacing: '0.01em' }}>{renderInline(line)}</p>)
    i++
  }

  return <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>{elements}</div>
}

// ─── Typing dots ──────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <>
      <style>{`@keyframes td{0%,60%,100%{opacity:.3;transform:scale(1)}30%{opacity:1;transform:scale(1.3)}}`}</style>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '6px 0' }}>
        {[0,1,2].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#555', animation: `td 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
      </div>
    </>
  )
}

function MessageRow({ msg, onDeploy }) {
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 28px', maxWidth: '820px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ background: '#141414', border: '1px solid #262626', color: '#ececec', padding: '10px 16px', borderRadius: '18px', fontSize: '15px', lineHeight: '1.6', maxWidth: '72%', fontFamily: 'ui-sans-serif, system-ui, sans-serif', letterSpacing: '0.01em' }}>
          {msg.images?.map((src, i) => <ImagePreviewThumb key={i} src={src} onRemove={() => {}} />)}
          {msg.text}
        </div>
      </div>
    )
  }
  // Check if bot message has code blocks (commands)
  const hasCommands = /```[\s\S]*?```/.test(msg.text)
  return (
    <div style={{ padding: '8px 28px 16px', maxWidth: '820px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#141414', border: '1px solid #262626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '3px' }}>
          <NetworkIcon size={16} />
        </div>
        <div style={{ flex: 1, paddingTop: '2px' }}>
          <MarkdownText text={msg.text} />
          {hasCommands && (
            <button onClick={() => onDeploy(msg.text)}
              style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#0ea5e9', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}
              // onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,165,233,0.2)'}
              // onMouseLeave={e => e.currentTarget.style.background = 'rgba(14,165,233,0.1)'}
              >
               Deploy to Router
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const quickActions = [
  { label: 'Code',      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>, prompt: 'Show me example Cisco IOS command structure' },
  { label: 'Routing',   icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>, prompt: 'Configure OSPF with network 192.168.1.0/24 in area 0' },
  { label: 'Switching', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>, prompt: 'Create VLAN 10 named Sales and assign it to interface FastEthernet0/1' },
  { label: 'ACL Rules', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, prompt: 'Create an extended ACL to block HTTP traffic from 192.168.1.0/24' },
  { label: 'NAT',       icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, prompt: 'Configure PAT (NAT overload) for inside network 192.168.1.0/24' },
]

// ─── Spinner Icon ─────────────────────────────────────────────────────────────
const NetworkIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="10" strokeDasharray="15.7 62.8">
      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
    </circle>
  </svg>
)

function ModelSelector({ selected, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = GEMINI_MODELS.find(m => m.id === selected) || GEMINI_MODELS[0]
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '13px', padding: '4px 6px', borderRadius: '7px', transition: 'background 0.12s, color 0.12s' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#d1d5db' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9ca3af' }}>
        {current.label}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, background: '#141414', border: '1px solid #262626', borderRadius: '10px', zIndex: 400, minWidth: '210px', boxShadow: '0 -8px 32px rgba(0,0,0,0.55)', overflow: 'hidden', padding: '4px' }}>
          {GEMINI_MODELS.map(model => (
            <button key={model.id} onClick={() => { onChange(model.id); setOpen(false) }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', cursor: 'pointer', borderRadius: '7px', background: selected === model.id ? 'rgba(196,122,90,0.12)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.12s' }}
              onMouseEnter={e => { if (selected !== model.id) e.currentTarget.style.background = '#1a1a1a' }}
              onMouseLeave={e => { if (selected !== model.id) e.currentTarget.style.background = 'transparent' }}>
              <div>
                <div style={{ fontSize: '13px', color: selected === model.id ? '#e8c9b8' : '#d1d5db', fontWeight: selected === model.id ? '500' : '400' }}>{model.label}</div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>{model.desc}</div>
              </div>
              {selected === model.id && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c47a5a" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CollapsedSidebar({ user, onNewChat, onToggle }) {
  const [tooltip, setTooltip] = useState(null)
  const navigate = useNavigate()
  const IconBtn = ({ title, onClick, children }) => (
    <div style={{ position: 'relative' }} onMouseEnter={() => setTooltip(title)} onMouseLeave={() => setTooltip(null)}>
      <button onClick={onClick} style={{ width: '36px', height: '36px', background: 'none', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, color 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#141414'; e.currentTarget.style.color = '#d1d5db' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280' }}>{children}</button>
      {tooltip === title && <div style={{ position: 'absolute', left: '46px', top: '50%', transform: 'translateY(-50%)', background: '#141414', border: '1px solid #262626', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: '#d1d5db', whiteSpace: 'nowrap', zIndex: 999, pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>{title}</div>}
    </div>
  )
  return (
    <div style={{ width: '52px', background: '#0a0a0a', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0 12px', gap: '2px', height: '100vh', flexShrink: 0 }}>
      <IconBtn title="Open sidebar" onClick={onToggle}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="1.5"/></svg></IconBtn>
      <IconBtn title="New chat" onClick={onNewChat}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></IconBtn>
      <IconBtn title="Search" onClick={() => navigate('/history')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/><path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></IconBtn>
      <IconBtn title="Chats" onClick={() => navigate('/chat')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></IconBtn>
      <div style={{ flex: 1 }} />
      <div style={{ position: 'relative', cursor: 'pointer' }} onMouseEnter={() => setTooltip('user')} onMouseLeave={() => setTooltip(null)}>
        {user?.photoURL ? <img src={user.photoURL} alt="avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'block' }} /> : <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: '500' }}>{user?.displayName?.[0] || 'U'}</div>}
        {tooltip === 'user' && <div style={{ position: 'absolute', left: '42px', bottom: '0', background: '#141414', border: '1px solid #262626', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: '#d1d5db', whiteSpace: 'nowrap', zIndex: 999, pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>{user?.displayName || user?.email || 'User'}</div>}
      </div>
    </div>
  )
}

function Lightbox({ src, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', maxWidth: '70vw', maxHeight: '75vh', boxShadow: '0 8px 48px rgba(0,0,0,0.6)' }}>
        <img src={src} alt="preview" style={{ display: 'block', maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }} />
        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '4px' }}>✕</button>
        </div>
      </div>
    </div>
  )
}

function ImagePreviewThumb({ src, onRemove, label }) {
  const [hovered, setHovered] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  return (
    <>
      {lightbox && <Lightbox src={src} onClose={() => setLightbox(false)} />}
      <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '8px' }}>
        <div
          style={{ position: 'relative', display: 'inline-block' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <img
            src={src}
            alt="preview"
            onClick={() => setLightbox(true)}
            style={{
              height: '64px', width: 'auto', maxWidth: '120px',
              borderRadius: '10px', objectFit: 'cover',
              border: '1px solid #262626', display: 'block', cursor: 'pointer',
            }}
          />
          {hovered && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              style={{
                position: 'absolute', top: '-7px', right: '-7px',
                width: '20px', height: '20px', borderRadius: '50%',
                background: '#141414', border: '1.5px solid #262626',
                color: '#ccc', fontSize: '11px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1, zIndex: 10,
              }}
            >✕</button>
          )}
        </div>
        {label && <span style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>{label}</span>}
      </div>
    </>
  )
}

// ─── Color map (matches Login.jsx exactly) ────────────────────────────────────
// #0a0a0a — page / chrome background
// #141414 — cards, inputs, bubbles, dropdowns
// #1a1a1a — subtle dividers / hover surfaces
// #262626 — borders

const s = {
  root:      { display: 'flex', height: '100vh', background: '#0a0a0a', fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif', color: '#e5e7eb' },
  main:      { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  messages:  { flex: 1, overflowY: 'auto', padding: '24px 0 16px', display: 'flex', flexDirection: 'column' },
  inputArea: { padding: '12px 20px 16px', background: '#0a0a0a', flexShrink: 0 },
  inputBox:  { display: 'flex', alignItems: 'center', gap: '6px', background: '#141414', border: '1px solid #262626', borderRadius: '14px', padding: '4px 6px 4px 14px', maxWidth: '720px', margin: '0 auto' },
  input:     { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#bfbfbf', fontSize: '14px', padding: '10px 0' },
}

// ─── Deploy to Router Modal ───────────────────────────────────────────────────
function DeployModal({ text, onClose }) {
  const [host, setHost] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState(null) // null | 'loading' | 'success' | 'error'
  const [result, setResult] = useState('')
  const [useGns3, setUseGns3] = useState(false)

  // Extract commands from bot message (lines inside code blocks)
  const extractCommands = (text) => {
    const matches = []
    const regex = /```[\w]*\n([\s\S]*?)```/g
    let match
    while ((match = regex.exec(text)) !== null) {
      const lines = match[1].split('\n').filter(l => l.trim())
      matches.push(...lines)
    }
    return matches
  }

  const handleDeploy = async () => {
    if (!useGns3 && (!host || !username || !password)) {
      setResult('Please fill all fields'); setStatus('error'); return
    }
    const commands = extractCommands(text)
    if (commands.length === 0) {
      setResult('No commands found in this message'); setStatus('error'); return
    }
    setStatus('loading')
    try {
      const res = await fetch('http://127.0.0.1:5002/api/deploy', {
      // const res = await fetch('https://peeer.pythonanywhere.com/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, username, password, commands, use_gns3: useGns3 })
      })
      const data = await res.json()
      if (data.success) {
        setResult(data.output || data.message)
        setStatus('success')
      } else {
        setResult(data.error)
        setStatus('error')
      }
    } catch (err) {
      setResult('Cannot connect to backend. Make sure Flask server is running.')
      setStatus('error')
    }
  }

  const inp = { width: '100%', background: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '8px 12px', color: '#d1d5db', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }
return (
  <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
    <div onClick={e => e.stopPropagation()} style={{ background: '#0f0f0f', border: '1px solid #1f1f1f', borderRadius: '20px', padding: '28px', width: '360px', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ color: '#e8e3dc', fontSize: '15px', fontWeight: '500', letterSpacing: '-0.2px' }}>Deploy to Router</div>
          <div style={{ color: '#404040', fontSize: '12px', marginTop: '2px' }}>Enter your router credentials</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>

      {/* GNS3 toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <input
          type="checkbox"
          checked={useGns3}
          onChange={e => setUseGns3(e.target.checked)}
          id="gns3-toggle"
        />
        <label htmlFor="gns3-toggle" style={{ color: '#9ca3af', fontSize: '12px', cursor: 'pointer' }}>
          Use GNS3 simulator (local demo router)
        </label>
      </div>

      {/* Fields */}
      {!useGns3 && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {[
         { label: 'Router IP', value: host, onChange: e => setHost(e.target.value), placeholder: '', type: 'text' },
{ label: 'Username', value: username, onChange: e => setUsername(e.target.value), placeholder: '', type: 'text' },
{ label: 'Password', value: password, onChange: e => setPassword(e.target.value), placeholder: '', type: 'password' },
        ].map(({ label, ...props }) => (
          <div key={label}>
            <div style={{ color: '#404040', fontSize: '11px', marginBottom: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
            <input {...props} style={{ width: '100%', background: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '9px 12px', color: '#d1d5db', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              onFocus={e => e.target.style.borderColor = '#333'}
              onBlur={e => e.target.style.borderColor = '#222'} />
          </div>
        ))}
      </div>
      )}

      {/* Output */}
   {status === 'loading' && (
  <div style={{ marginBottom: '14px' }}>
    <div style={{ color: '#0ea5e9', fontSize: '12px' }}>Connecting to router</div>
  </div>
)}
     {status === 'success' && (
  <div style={{ marginBottom: '14px' }}>
    <div style={{ color: '#4ade80', fontSize: '12px' }}>Deployed successfully</div>
  </div>
)}
  {status === 'error' && (
  <div style={{ marginBottom: '14px' }}>
    <div style={{ color: '#ef4444', fontSize: '12px' }}> {result}</div>
  </div>
)}

      {/* Button */}
     <button onClick={handleDeploy} disabled={status === 'loading'}
  style={{ width: '100%', background: 'none', color: '#0ea5e9', border: 'none', borderRadius: '10px', padding: '13px 20px', fontSize: '14px', fontWeight: '500', cursor: status === 'loading' ? 'not-allowed' : 'pointer', opacity: status === 'loading' ? 0.7 : 1, transition: 'opacity 0.2s' }}>
       
        
        {status === 'loading' ? 'Deploying...' : 'Deploy Commands'}
      </button>
    </div>
  </div>
)
}

export default function Chat() {
  const [user] = useAuthState(auth)
  const [searchParams] = useSearchParams()
  const chatIdParam = searchParams.get('id')
  const [messages, setMessages] = useState([])

  const [deployModal, setDeployModal] = useState(null) // holds bot message text
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [protocol, setProtocol] = useState('general')
  const [history, setHistory] = useState([])
  const [selectedImages, setSelectedImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sessionId, setSessionId] = useState(null)
  const [lastImageUrl, setLastImageUrl] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedModel, setSelectedModel] = useState(GEMINI_MODELS[0].id)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()
  const isWelcome = messages.length === 0

  useEffect(() => {
    if (chatIdParam) { setSessionId(chatIdParam); loadPreviousChat(chatIdParam) }
    else { setSessionId(Date.now().toString()); setMessages([]); setProtocol('general'); setHistory([]); setInput('') }
  }, [chatIdParam])

  const loadPreviousChat = async (chatId) => {
    try {
      const q = query(collection(db, 'chats'), where('sessionId', '==', chatId))
      const snapshot = await getDocs(q)
      if (snapshot.empty) return
      const chatData = snapshot.docs[0].data()
      setProtocol(chatData.protocol || 'general')
      const messagesSnapshot = await getDocs(query(collection(db, `chats/${snapshot.docs[0].id}/messages`)))
      if (!messagesSnapshot.empty) setMessages(messagesSnapshot.docs.map(d => ({ 
  role: d.data().role, 
  text: d.data().text,
  images: d.data().images || []
})))
      else setMessages([{ role: 'user', text: chatData.lastMessage }, { role: 'bot', text: chatData.lastResponse }])
    } catch (error) { console.error('Error loading previous chat:', error) }
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    const handler = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) setSelectedImages(prev => [...prev, { file, previewUrl: URL.createObjectURL(file) }])
        }
      }
    }
    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [])

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    const newImgs = files.map(f => ({ file: f, previewUrl: URL.createObjectURL(f) }))
    setSelectedImages(prev => [...prev, ...newImgs])
  }

  const handleRemoveImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handlePaste = (e) => {
    e.stopPropagation()
    const items = e.clipboardData?.items; if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) setSelectedImages(prev => [...prev, { file, previewUrl: URL.createObjectURL(file) }])
      }
    }
  }

  const handleSend = async (overrideMessage = null) => {
    const userMessage = overrideMessage || input.trim() || (selectedImages.length > 0 ? 'Analyze this network diagram and generate Cisco IOS commands' : '')
    if (!userMessage && selectedImages.length === 0) return
    if (loading || !sessionId) return
    const imageFiles = selectedImages
    setInput(''); setSelectedImages([])
    if (fileInputRef.current) fileInputRef.current.value = ''

    setMessages(prev => [...prev, { role: 'user', text: userMessage, images: imageFiles.map(i => i.previewUrl) }])
    setLoading(true)

    try {
      let cloudinaryUrls = []
      if (imageFiles.length > 0) {
        setUploading(true)
        cloudinaryUrls = await Promise.all(imageFiles.map(i => uploadToCloudinary(i.file)))
        setUploading(false)
        setLastImageUrl(cloudinaryUrls)
        setMessages(prev => prev.map((msg, idx) =>
          idx === prev.length - 1 && msg.role === 'user'
            ? { ...msg, images: cloudinaryUrls }
            : msg
        ))
      }

      const botReply = await askFireworks(
  userMessage, history,
  systemPrompt + '\n' + protocolPrompts[protocol],
  cloudinaryUrls.length > 0 ? cloudinaryUrls : (lastImageUrl || []),
  selectedModel
)

      setMessages(prev => [...prev, { role: 'bot', text: botReply }])
      setHistory(prev => [...prev,
        { role: 'user', parts: [{ text: userMessage }] },
        { role: 'model', parts: [{ text: botReply }] }
      ])

      await setDoc(doc(db, 'chats', sessionId), {
        userId: user.uid, userEmail: user.email, sessionId,
        lastMessage: userMessage, lastResponse: botReply,
        protocol, messageCount: messages.length + 1,
        timestamp: serverTimestamp()
      }, { merge: true })

      setRefreshKey(prev => prev + 1)

      await addDoc(collection(db, `chats/${sessionId}/messages`), {
  role: 'user', text: userMessage, 
  images: cloudinaryUrls,  // ← add this
  timestamp: serverTimestamp()
})
      await addDoc(collection(db, `chats/${sessionId}/messages`), {
        role: 'bot', text: botReply, timestamp: serverTimestamp()
      })

    } catch (error) {
      setUploading(false)
      setMessages(prev => [...prev, { role: 'bot', text: 'Error: ' + error.message }])
    }
    setLoading(false)
  }

  const handleLogout = async () => { await signOut(auth); navigate('/') }
  const handleNewChat = () => {
    setSessionId(Date.now().toString()); setMessages([]); setHistory([])
    setInput(''); setSelectedImages([]); setProtocol('general')
    setLastImageUrl(null); setRefreshKey(prev => prev + 1); navigate('/chat')
  }

  if (!sessionId) return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      Loading...
    </div>
  )

  return (
    <div style={s.root}>
      {sidebarOpen
        ? <ProtocolSidebar selected={protocol} onSelect={setProtocol} user={user} onNewChat={handleNewChat} onLogout={handleLogout} refreshKey={refreshKey} onToggleSidebar={() => setSidebarOpen(false)} />
        : <CollapsedSidebar user={user} onNewChat={handleNewChat} onToggle={() => setSidebarOpen(true)} />
      }
      <div style={s.main}>

        {isWelcome ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto', background: '#0a0a0a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '36px' }}>
              <NetworkIcon size={34} />
              <h1 style={{ margin: 0, fontSize: '32px', fontWeight: '400', color: '#e8e3dc', letterSpacing: '-0.3px', fontFamily: "'Georgia', 'Times New Roman', serif", lineHeight: 1.2 }}>What shall we configure?</h1>
            </div>
            <div style={{ width: '100%', maxWidth: '580px', marginBottom: '16px' }}>
              {selectedImages.length > 0 && (
                <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: '14px 14px 0 0', padding: '10px 18px 2px', borderBottom: 'none', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedImages.map((img, i) => <ImagePreviewThumb key={i} src={img.previewUrl} onRemove={() => handleRemoveImage(i)} />)}
                </div>
              )}
              <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: selectedImages.length > 0 ? '0 0 14px 14px' : '14px',
borderTop: selectedImages.length > 0 ? 'none' : undefined, padding: '16px 16px 10px 16px' }}>
                <textarea value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  onPaste={handlePaste} placeholder="How can I help you today?" autoFocus rows={2}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#bfbfbf', fontSize: '14px', resize: 'none', lineHeight: '1.5', fontFamily: 'inherit', boxSizing: 'border-box', caretColor: '#bfbfbf' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px' }}>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: 'none' }} />
                  <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '22px', lineHeight: 1, padding: '0 4px', transition: 'color 0.15s', display: 'flex', alignItems: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#d1d5db'} onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}>+</button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ModelSelector selected={selectedModel} onChange={setSelectedModel} />
                    <button onClick={() => handleSend()} disabled={!input.trim() && selectedImages.length === 0}
                      style={{ background: (!input.trim() && selectedImages.length === 0) ? 'none' : '#0ea5e9', border: 'none', borderRadius: '7px', padding: '5px 7px', cursor: (!input.trim() && selectedImages.length === 0) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', opacity: (!input.trim() && selectedImages.length === 0) ? 0.25 : 1, transition: 'opacity 0.15s, background 0.15s' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke={(!input.trim() && selectedImages.length === 0) ? '#9ca3af' : '#fff'} strokeWidth="2" strokeLinecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={(!input.trim() && selectedImages.length === 0) ? '#9ca3af' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '620px' }}>
              {quickActions.map((action) => (
                <button key={action.label} onClick={() => handleSend(action.prompt)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'transparent', border: '1px solid #262626', borderRadius: '20px', color: '#888', fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#141414'; e.currentTarget.style.borderColor = '#404040'; e.currentTarget.style.color = '#d1d5db' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#262626'; e.currentTarget.style.color = '#888' }}>
                  <span style={{ color: '#555', display: 'flex', alignItems: 'center' }}>{action.icon}</span>{action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={s.messages}>
            <style>{`.chat-scroll::-webkit-scrollbar{width:4px}.chat-scroll::-webkit-scrollbar-thumb{background:#262626;border-radius:10px}`}</style>
            {messages.map((msg, i) => <MessageRow key={i} msg={msg} onDeploy={(text) => setDeployModal(text)} />)}
            {(loading || uploading) && (
              <div style={{ padding: '8px 28px', maxWidth: '820px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#141414', border: '1px solid #262626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><NetworkIcon size={16} /></div>
                  <div style={{ paddingTop: '4px' }}>
                    {uploading ? <span style={{ color: '#6b7280', fontSize: '13px' }}>Uploading image...</span> : <TypingDots />}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {!isWelcome && selectedImages.length > 0 && (
          <div style={{ padding: '8px 20px 0', background: '#0a0a0a' }}>
            <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {selectedImages.map((img, i) => <ImagePreviewThumb key={i} src={img.previewUrl} onRemove={() => handleRemoveImage(i)} label={img.file?.name} />)}
            </div>
          </div>
        )}

        {!isWelcome && (
          <div style={s.inputArea}>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: 'none' }} />
            <div style={s.inputBox}>
              <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '0 4px', transition: 'color 0.15s', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.color = '#d1d5db'} onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}>+</button>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} onPaste={handlePaste}
                placeholder={selectedImages.length > 0 ? 'Describe what you want...' : 'Message AI Network Chatbot...'} style={s.input} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <ModelSelector selected={selectedModel} onChange={setSelectedModel} />
                <button onClick={() => handleSend()} disabled={loading || (!input.trim() && selectedImages.length === 0)}
                  style={{ background: (loading || (!input.trim() && selectedImages.length === 0)) ? 'none' : '#0ea5e9', border: 'none', borderRadius: '7px', padding: '5px 7px', display: 'flex', alignItems: 'center', opacity: (loading || (!input.trim() && selectedImages.length === 0)) ? 0.25 : 1, cursor: (loading || (!input.trim() && selectedImages.length === 0)) ? 'not-allowed' : 'pointer', transition: 'opacity 0.15s, background 0.15s' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke={(loading || (!input.trim() && selectedImages.length === 0)) ? '#9ca3af' : '#fff'} strokeWidth="2" strokeLinecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={(loading || (!input.trim() && selectedImages.length === 0)) ? '#9ca3af' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
            <p style={{ textAlign: 'center', color: '#374151', fontSize: '11px', marginTop: '8px' }}>
              Paste images with Ctrl+V · Click + to attach · Press Enter to send
            </p>
          </div>
        )}
      </div>
      {deployModal && <DeployModal text={deployModal} onClose={() => setDeployModal(null)} />}
    </div>
  )
}
