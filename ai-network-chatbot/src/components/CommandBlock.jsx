import { useEffect, useState, useRef } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { signOut } from 'firebase/auth'
import { auth, db } from '../lib/firebase'
import { collection, query, where, orderBy, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import ProtocolSidebar from '../components/ProtocolSidebar'
function CustomCheckbox({ checked, indeterminate = false, onChange, onClick }) {
  return (
    <div
      onClick={onClick || onChange}
      style={{
        width: '16px',        // was 20px
        height: '16px',       // was 20px
        borderRadius: '4px',  // was 6px
        background: (checked || indeterminate) ? '#3b82f6' : 'transparent',
        border: (checked || indeterminate) ? '2px solid #3b82f6' : '2px solid #6b7280',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {indeterminate && !checked && (
        <svg width="8" height="2" viewBox="0 0 8 2" fill="none">
          <rect x="0" y="0" width="8" height="2" rx="1" fill="white" />
        </svg>
      )}
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}
export default function History() {
  const [user] = useAuthState(auth)
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const menuRef = useRef(null)
  const navigate = useNavigate()

  const [sidebarOpen, setSidebarOpen] = useState(true)
const [protocol, setProtocol] = useState('general')
const handleNewChat = () => navigate('/chat')
const handleLogout = async () => { await signOut(auth); navigate('/') }

  useEffect(() => {
    if (!user) { navigate('/'); return }
    fetchHistory()
  }, [user])

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const q = query(collection(db, 'chats'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'))
      const snapshot = await getDocs(q)
      setChats(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'chats', id))
    setChats(prev => prev.filter(c => c.id !== id))
    setOpenMenu(null)
  }

  const handleDeleteSelected = async () => {
    await Promise.all([...selected].map(id => deleteDoc(doc(db, 'chats', id))))
    setChats(prev => prev.filter(c => !selected.has(c.id)))
    setSelected(new Set())
    setSelectMode(false)
  }

  const handleRename = async (id) => {
    if (!renameValue.trim()) return
    await updateDoc(doc(db, 'chats', id), { lastMessage: renameValue.trim() })
    setChats(prev => prev.map(c => c.id === id ? { ...c, lastMessage: renameValue.trim() } : c))
    setRenamingId(null)
    setRenameValue('')
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const formatTime = (ts) => {
    if (!ts) return 'Just now'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    const diff = Date.now() - d
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    const months = Math.floor(days / 30)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`
    return `${months} month${months !== 1 ? 's' : ''} ago`
  }

  const filtered = chats.filter(c =>
    (c.lastMessage || 'New Chat').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1a1a1a', color: '#e5e7eb', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
  <ProtocolSidebar selected={protocol} onSelect={setProtocol} user={user} onNewChat={handleNewChat} onLogout={handleLogout} refreshKey={0} onToggleSidebar={() => setSidebarOpen(false)} />
  <div style={{ flex: 1, overflowY: 'auto' }}>
      
      {/* Content */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Title with New chat button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '600', color: '#fff', margin: 0 }}>Chats</h1>
          <button onClick={() => navigate('/chat')} style={{ background: '#fff', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', padding: '8px 16px', cursor: 'pointer', fontWeight: '500' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            + New chat
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your chats..."
            style={{ width: '100%', background: '#252525', border: '1px solid #333', borderRadius: '10px', padding: '12px 14px 12px 40px', color: '#d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor = '#3b82f6'}
            onBlur={e => e.target.style.borderColor = '#333'} />
        </div>

        {/* Select mode bar */}
        {selectMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 4px', marginBottom: '4px' }}>
          <CustomCheckbox
  checked={selected.size === filtered.length && filtered.length > 0}
  indeterminate={selected.size > 0 && selected.size < filtered.length}
  onChange={() => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map(c => c.id))) }}
/>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>{selected.size} selected</span>
            <button onClick={handleDeleteSelected} disabled={selected.size === 0}
              style={{ background: 'none', border: 'none', color: selected.size > 0 ? '#6b7280' : '#4b5563', cursor: selected.size > 0 ? 'pointer' : 'default', padding: '4px', display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
            <button onClick={() => { setSelectMode(false); setSelected(new Set()) }}
              style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px', fontSize: '16px' }}>✕</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: '24px', height: '24px', border: '2px solid #333', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280', fontSize: '14px' }}>
            {search ? 'No chats match your search.' : 'No conversations yet.'}
          </div>
        )}

        {/* Chat list */}
        {!loading && filtered.length > 0 && (
          <div>
            {/* "Your chats with Claude  Select" row — hidden when in select mode */}
            {!selectMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 4px 8px 4px', marginBottom: '4px' }}>
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>Your chats with Claude</span>
                <button onClick={() => setSelectMode(true)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>Select</button>
              </div>
            )}

            {/* Items — no outer box, just dividers */}
            {filtered.map((chat, idx) => {
              const title = chat.lastMessage || 'New Chat'
              return (
                <div key={chat.id} style={{ borderTop: '1px solid #2a2a2a' }}>
                  {renamingId === chat.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 4px' }}>
                      <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(chat.id); if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') } }}
                        style={{ flex: 1, background: '#2a2a2a', border: '1px solid #3b82f6', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                      <button onClick={() => handleRename(chat.id)} style={{ background: '#3b82f6', border: 'none', borderRadius: '6px', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>Save</button>
                      <button onClick={() => { setRenamingId(null); setRenameValue('') }} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                    </div>
                  ) : (
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 4px', cursor: 'pointer', borderRadius: '6px', background: selected.has(chat.id) ? 'rgba(59,130,246,0.08)' : 'transparent', transition: 'background 0.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = selected.has(chat.id) ? 'rgba(59,130,246,0.12)' : '#252525'; setOpenMenu(chat.id + '_hover') }}
                      onMouseLeave={e => { e.currentTarget.style.background = selected.has(chat.id) ? 'rgba(59,130,246,0.08)' : 'transparent'; setOpenMenu(prev => prev === chat.id + '_hover' ? null : prev) }}
                      onClick={() => selectMode ? toggleSelect(chat.id) : navigate(`/chat?id=${chat.sessionId}`)}
                    >
                      {selectMode && (
                      <CustomCheckbox
  checked={selected.has(chat.id)}
  onClick={e => { e.stopPropagation(); toggleSelect(chat.id) }}
/>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '15px', color: '#e5e7eb', fontWeight: '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>Last message {formatTime(chat.timestamp)}</div>
                      </div>
                      {!selectMode && (
                        <div style={{ position: 'relative' }} ref={openMenu === chat.id ? menuRef : null}>
                          <button
                            onClick={e => { e.stopPropagation(); setOpenMenu(prev => prev === chat.id ? null : chat.id) }}
                            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px 6px', borderRadius: '6px', opacity: (openMenu === chat.id + '_hover' || openMenu === chat.id) ? 1 : 0, transition: 'opacity 0.15s', display: 'flex', alignItems: 'center' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                          </button>
                          {openMenu === chat.id && (
                            <div ref={menuRef} style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: '#1e1e1e', border: '1px solid #333', borderRadius: '10px', zIndex: 100, minWidth: '160px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden', padding: '4px' }}>
                              {[
                                { label: 'Select', icon: '✓', action: () => { setSelectMode(true); toggleSelect(chat.id); setOpenMenu(null) } },
                                { label: 'Rename', icon: '✎', action: () => { setRenamingId(chat.id); setRenameValue(chat.lastMessage || ''); setOpenMenu(null) } },
                                { label: 'Delete', icon: '🗑', action: () => handleDelete(chat.id), danger: true },
                              ].map(item => (
                                <button key={item.label} onClick={e => { e.stopPropagation(); item.action() }}
                                  style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: item.danger ? '#ef4444' : '#d1d5db', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '7px' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <span style={{ fontSize: '12px', width: '14px' }}>{item.icon}</span>{item.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
    </div>
  )
}