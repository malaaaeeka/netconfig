import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, orderBy, limit, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const NewChatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
)

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="11" cy="11" r="7"/>
    <path d="M16.5 16.5L21 21"/>
  </svg>
)

const ChatsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

const StarIcon = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
  </svg>
)

const RenameIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const DeleteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <polyline points="3,6 5,6 21,6"/>
    <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
    <path d="M10,11v6M14,11v6"/>
    <path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/>
  </svg>
)

const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
  </svg>
)

const CollapseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)

const LogoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16,17 21,12 16,7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

// ─── Color system (matches Login.jsx + Chat.jsx exactly) ──────────────────────
// #0a0a0a — page / sidebar background
// #141414 — cards, inputs, hover surfaces, dropdowns
// #1a1a1a — dividers, subtle borders
// #262626 — input borders

// ─── Protocols ────────────────────────────────────────────────────────────────
const protocols = [
  { id: 'routing',    label: 'Routing',    desc: 'OSPF, EIGRP, BGP, RIP' },
  { id: 'switching',  label: 'Switching',  desc: 'VLANs, STP, Trunking' },
  { id: 'security',   label: 'ACLs',       desc: 'Standard, Extended' },
  { id: 'nat',        label: 'NAT',        desc: 'Static, Dynamic, PAT' },
  { id: 'redundancy', label: 'Redundancy', desc: 'HSRP, VRRP' },
  { id: 'general',    label: 'General',    desc: 'Interface, Banner' },
]

// ─── ChatItem ─────────────────────────────────────────────────────────────────
function ChatItem({ chat, onClick, onDelete, onRename, onStar }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(chat.lastMessage || '')
  const [hovered, setHovered] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const handleDelete = async (e) => {
    e.stopPropagation()
    try { await deleteDoc(doc(db, 'chats', chat.id)); onDelete(chat.id) } catch (err) { console.error(err) }
    setMenuOpen(false)
  }

  const handleRename = async () => {
    if (!renameValue.trim()) return
    try { await updateDoc(doc(db, 'chats', chat.id), { lastMessage: renameValue.trim() }); onRename(chat.id, renameValue.trim()) } catch (err) { console.error(err) }
    setRenaming(false)
  }

  const handleStar = async (e) => {
    e.stopPropagation()
    try { await updateDoc(doc(db, 'chats', chat.id), { starred: !chat.starred }); onStar(chat.id) } catch (err) { console.error(err) }
    setMenuOpen(false)
  }

  return (
    <div
      style={{ position: 'relative', marginBottom: '1px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {renaming ? (
        <div style={{ padding: '4px 6px' }} onClick={e => e.stopPropagation()}>
          <input
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') { setRenaming(false); setRenameValue(chat.lastMessage || '') }
            }}
            style={{
              width: '100%',
              background: '#141414',
              border: '1px solid #3b82f6',
              borderRadius: '6px',
              padding: '6px 8px',
              color: '#fff',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
            <button
              onClick={handleRename}
              style={{ flex: 1, background: '#3b82f6', border: 'none', borderRadius: '5px', color: '#fff', fontSize: '11px', padding: '5px', cursor: 'pointer', fontWeight: '500' }}
            >Save</button>
            <button
              onClick={() => { setRenaming(false); setRenameValue(chat.lastMessage || '') }}
              style={{ flex: 1, background: '#141414', border: '1px solid #262626', borderRadius: '5px', color: '#9ca3af', fontSize: '11px', padding: '5px', cursor: 'pointer' }}
            >Cancel</button>
          </div>
        </div>
      ) : (
        <div
          onClick={onClick}
          style={{
            display: 'flex', alignItems: 'center',
            padding: '5px 8px', borderRadius: '6px', cursor: 'pointer',
            background: hovered ? '#141414' : 'transparent',
            transition: 'background 0.12s',
          }}
        >
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{
              fontSize: '13.5px',
              color: '#ccc',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {chat.lastMessage?.slice(0, 34) || 'Chat'}
            </div>
          </div>
          {(hovered || menuOpen) && (
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(prev => !prev) }}
              style={{
                background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
                padding: '2px 4px', borderRadius: '4px', flexShrink: 0,
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
            >
              <DotsIcon />
            </button>
          )}
        </div>
      )}

      {menuOpen && (
        <div
          ref={menuRef}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', right: '0px', top: '32px',
            background: '#0a0a0a', border: '1px solid #262626',
            borderRadius: '10px', zIndex: 300, minWidth: '170px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)', overflow: 'hidden', padding: '4px',
          }}
        >
          {[
            { icon: <StarIcon filled={chat.starred} />, label: chat.starred ? 'Unstar' : 'Star', action: handleStar, color: '#e5e7eb' },
            { icon: <RenameIcon />, label: 'Rename', action: e => { e.stopPropagation(); setRenaming(true); setMenuOpen(false) }, color: '#e5e7eb' },
          ].map(({ icon, label, action, color }) => (
            <button key={label} onClick={action}
              style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', color, fontSize: '13px', borderRadius: '7px', transition: 'background 0.12s', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.background = '#141414'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >{icon}{label}</button>
          ))}
          <div style={{ borderTop: '1px solid #1a1a1a', margin: '3px 0' }} />
          <button onClick={handleDelete}
            style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', color: '#ef4444', fontSize: '13px', borderRadius: '7px', transition: 'background 0.12s', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = '#141414'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          ><DeleteIcon />Delete</button>
        </div>
      )}
    </div>
  )
}

// ─── Nav Row ──────────────────────────────────────────────────────────────────
function NavRow({ icon, label, onClick, badge }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '7px 10px', borderRadius: '7px', border: 'none',
        background: hovered ? '#141414' : 'transparent',
        cursor: 'pointer', color: '#ccc', fontSize: '14px',
        transition: 'background 0.12s', textAlign: 'left',
      }}
    >
      <span style={{ color: '#aaa', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{ fontSize: '11px', color: '#6b7280', background: '#141414', padding: '1px 7px', borderRadius: '10px', border: '1px solid #262626' }}>{badge}</span>
      )}
    </button>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export default function ProtocolSidebar({ selected, onSelect, user, onNewChat, onLogout, refreshKey, onToggleSidebar }) {
  const navigate = useNavigate()
  const [recentChats, setRecentChats] = useState([])
  const [showProtocols, setShowProtocols] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    if (!user) return
    const fetchChats = async () => {
      try {
        const q = query(collection(db, 'chats'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'), limit(20))
        const snapshot = await getDocs(q)
        const chats = snapshot.docs.map(d => {
          const data = d.data()
          return { id: d.id, sessionId: data.sessionId, lastMessage: data.lastMessage || data.message || 'Chat', protocol: data.protocol || 'general', timestamp: data.timestamp, starred: data.starred || false }
        })
        chats.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0))
        setRecentChats(chats)
      } catch (e) { console.log('Could not load chats:', e) }
    }
    fetchChats()
  }, [user, refreshKey])

  const handleChatClick = (sessionId) => { if (sessionId) navigate(`/chat?id=${sessionId}`) }

  const starredChats = recentChats.filter(c => c.starred)
  const unstarredChats = recentChats.filter(c => !c.starred)

  return (
    <div style={{
      width: '260px',
      background: '#0a0a0a',
      borderRight: '1px solid #1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      height: '100vh',
    }}>

      {/* ── Logo row ── */}
      <div style={{ padding: '14px 12px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#fff', fontWeight: '600', fontSize: '15px', letterSpacing: '-0.2px' }}>
          AI Network Chatbot
        </span>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title="Close sidebar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center', transition: 'color 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ccc'}
            onMouseLeave={e => e.currentTarget.style.color = '#555'}
          >
            <CollapseIcon />
          </button>
        )}
      </div>

      {/* ── Top nav items ── */}
      <div style={{ padding: '0 8px 6px' }}>
        <NavRow icon={<NewChatIcon />} label="New chat" onClick={onNewChat} />
        <NavRow icon={<SearchIcon />} label="Search" onClick={() => navigate('/history')} />
        <NavRow icon={<ChatsIcon />} label="Chats" onClick={() => navigate('/chat')} />

        {/* Protocol mode row */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowProtocols(!showProtocols)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '7px 10px', borderRadius: '7px', border: 'none',
              background: showProtocols ? '#141414' : 'transparent',
              cursor: 'pointer', color: '#ccc', fontSize: '14px',
              transition: 'background 0.12s', textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#141414'}
            onMouseLeave={e => { if (!showProtocols) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ color: '#aaa', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </span>
            <span style={{ flex: 1 }}>{protocols.find(p => p.id === selected)?.label} Mode</span>
            <span style={{ fontSize: '10px', color: '#555' }}>{showProtocols ? '▲' : '▼'}</span>
          </button>

          {showProtocols && (
            <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: '8px', overflow: 'hidden', marginTop: '2px', marginBottom: '2px' }}>
              {protocols.map((p) => (
                <button key={p.id} onClick={() => { onSelect(p.id); setShowProtocols(false) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '7px 12px',
                    border: 'none',
                    background: selected === p.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (selected !== p.id) e.currentTarget.style.background = '#1a1a1a' }}
                  onMouseLeave={e => { if (selected !== p.id) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: '13px', color: selected === p.id ? '#93c5fd' : '#d1d5db' }}>{p.label}</span>
                  <span style={{ fontSize: '10px', color: '#555' }}>{p.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: '#1a1a1a', margin: '0 0 4px' }} />

      {/* ── Chat list ── */}
      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 4px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: #262626; border-radius: 10px; }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: #333; }
        .sidebar-scroll { scrollbar-width: thin; scrollbar-color: #262626 transparent; }
      `}</style>
      <div className="sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
        {starredChats.length > 0 && (
          <>
            <p style={{ color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 8px 3px', margin: 0 }}>Starred</p>
            {starredChats.map(chat => (
              <ChatItem key={chat.id} chat={chat} onClick={() => handleChatClick(chat.sessionId)}
                onDelete={(id) => setRecentChats(prev => prev.filter(c => c.id !== id))}
                onRename={(id, newName) => setRecentChats(prev => prev.map(c => c.id === id ? { ...c, lastMessage: newName } : c))}
                onStar={(id) => setRecentChats(prev => {
  const updated = prev.map(c => c.id === id ? { ...c, starred: !c.starred } : c)
  return [...updated.filter(c => c.starred), ...updated.filter(c => !c.starred)]
})}
              />
            ))}
          </>
        )}

        {unstarredChats.length > 0 && (
          <>
            <p style={{ color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 8px 3px', margin: 0 }}>Recents</p>
            {unstarredChats.map(chat => (
              <ChatItem key={chat.id} chat={chat} onClick={() => handleChatClick(chat.sessionId)}
                onDelete={(id) => setRecentChats(prev => prev.filter(c => c.id !== id))}
                onRename={(id, newName) => setRecentChats(prev => prev.map(c => c.id === id ? { ...c, lastMessage: newName } : c))}
                onStar={(id) => setRecentChats(prev => {
  const updated = prev.map(c => c.id === id ? { ...c, starred: !c.starred } : c)
  return [...updated.filter(c => c.starred), ...updated.filter(c => !c.starred)]
})}
              />
            ))}
          </>
        )}

        {recentChats.length === 0 && (
          <p style={{ color: '#444', fontSize: '12px', padding: '8px 8px' }}>No recent chats</p>
        )}
      </div>

      {/* ── User Profile (bottom) ── */}
      <div style={{ padding: '8px', borderTop: '1px solid #1a1a1a', position: 'relative' }}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '7px 10px', borderRadius: '8px', transition: 'background 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#141414'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="avatar" style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0 }} />
          ) : (
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: '600', flexShrink: 0 }}>
              {user?.displayName?.[0] || 'U'}
            </div>
          )}
          <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
            <div style={{ fontSize: '13.5px', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.displayName || user?.email}
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        {showUserMenu && (
          <div style={{
            position: 'absolute', bottom: '56px', left: '8px', right: '8px',
            background: '#0a0a0a', border: '1px solid #262626', borderRadius: '10px',
            overflow: 'hidden', boxShadow: '0 -4px 24px rgba(0,0,0,0.6)', zIndex: 100, padding: '4px',
          }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="avatar" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: '600' }}>
                    {user?.displayName?.[0] || 'U'}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '13px', color: '#fff', fontWeight: '500' }}>{user?.displayName}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>{user?.email}</div>
                </div>
              </div>
            </div>
            <button onClick={onLogout}
              style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', borderRadius: '7px', transition: 'background 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#141414'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <LogoutIcon /> Log out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}