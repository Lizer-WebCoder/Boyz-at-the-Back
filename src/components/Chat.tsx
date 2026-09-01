import { Session } from '@supabase/supabase-js'
import { useState, useEffect, useRef } from 'react'
import { Hash, Users, LogOut, Send, Menu, X, MessageCircle, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

interface Props { session: Session }
interface Channel { id: string; name: string }
interface Profile { id: string; username: string; avatar_url: string | null; status: string }
interface Msg {
  id: string
  content: string | null
  author_id: string
  created_at: string
  image_url?: string | null
  profiles?: { username: string; avatar_url: string | null } | null
}

export default function Chat({ session }: Props) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeCh, setActiveCh] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState('')
  const [needsInvite, setNeedsInvite] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState<'channel' | 'dm'>('channel')
  const [dmId, setDmId] = useState<string | null>(null)
  const [dmOther, setDmOther] = useState<Profile | null>(null)
  const [dmMsgs, setDmMsgs] = useState<Msg[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const username = session.user.user_metadata?.username || 'Boy'

  const ensureProfile = async () => {
    const { data } = await supabase.from('profiles').select('id').eq('id', session.user.id).maybeSingle()
    if (!data) {
      await supabase.from('profiles').upsert({ id: session.user.id, username, status: 'online' })
    } else {
      await supabase.from('profiles').update({ status: 'online' }).eq('id', session.user.id)
    }
  }

  const loadGroup = async (gId: string) => {
    setGroupId(gId)
    const { data: g } = await supabase.from('groups').select('invite_code').eq('id', gId).single()
    if (g) setInvite(g.invite_code)

    const { data: chs } = await supabase.from('channels').select('id, name').eq('group_id', gId).order('position')
    if (chs?.length) {
      setChannels(chs)
      setActiveCh(prev => prev || chs[0].id)
    }

    const { data: mems } = await supabase.from('group_members').select('user_id').eq('group_id', gId)
    if (mems) {
      const ids = mems.map(m => m.user_id)
      const { data: prows } = await supabase.from('profiles').select('*').in('id', ids)
      setMembers((prows || []) as Profile[])
    }
  }

  useEffect(() => {
    async function init() {
      await ensureProfile()
      const { data: groups } = await supabase.from('groups').select('*').limit(1)

      if (!groups?.length) {
        const code = Math.random().toString(36).slice(2, 10).toUpperCase()
        const { data: g, error } = await supabase
          .from('groups')
          .insert({ name: 'Boyz at the Back', invite_code: code, created_by: session.user.id })
          .select().single()
        if (error || !g) { console.error(error); setLoading(false); return }
        await supabase.from('group_members').insert({ group_id: g.id, user_id: session.user.id, role: 'owner' })
        await supabase.from('channels').insert(
          ['general', 'gaming', 'memes', 'music', 'random'].map((name, i) => ({ group_id: g.id, name, position: i }))
        )
        await loadGroup(g.id)
        setNeedsInvite(false)
      } else {
        const gId = groups[0].id
        const { data: mem } = await supabase.from('group_members')
          .select('*').eq('group_id', gId).eq('user_id', session.user.id).maybeSingle()
        if (mem) {
          await loadGroup(gId)
          setNeedsInvite(false)
        } else {
          setGroupId(gId)
          setInvite(groups[0].invite_code)
          setNeedsInvite(true)
        }
      }
      setLoading(false)
    }
    init()
    return () => { supabase.from('profiles').update({ status: 'offline' }).eq('id', session.user.id).then() }
  }, [session.user.id])

  // Channel messages + realtime
  useEffect(() => {
    if (!activeCh || needsInvite || mode !== 'channel') return

    async function load() {
      const { data } = await supabase.from('messages')
        .select('id, content, author_id, created_at, image_url')
        .eq('channel_id', activeCh!).order('created_at').limit(200)
      if (!data) return
      const ids = [...new Set(data.map(m => m.author_id).filter(Boolean))]
      const { data: prows } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids)
      const map: Record<string, any> = {}
      prows?.forEach(p => { map[p.id] = p })
      setMessages(data.map(m => ({ ...m, profiles: map[m.author_id] || { username: '?', avatar_url: null } })))
    }
    load()

    const ch = supabase.channel(`ch:${activeCh}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${activeCh}` }, async (p) => {
        const n = p.new as any
        setMessages(prev => {
          if (prev.some(m => m.id === n.id)) return prev
          return [...prev.filter(m => !m.id.startsWith('temp-') || m.content !== n.content), {
            ...n,
            profiles: { username: n.author_id === session.user.id ? username : '?', avatar_url: null },
          }]
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [activeCh, needsInvite, mode])

  // DM messages
  useEffect(() => {
    if (!dmId || mode !== 'dm') return
    async function load() {
      const { data } = await supabase.from('dm_messages')
        .select('id, content, author_id, created_at, image_url')
        .eq('conversation_id', dmId!).order('created_at').limit(200)
      if (!data) return
      const ids = [...new Set(data.map(m => m.author_id).filter(Boolean))]
      const { data: prows } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids)
      const map: Record<string, any> = {}
      prows?.forEach(p => { map[p.id] = p })
      setDmMsgs(data.map(m => ({ ...m, profiles: map[m.author_id] || { username: '?', avatar_url: null } })))
    }
    load()
    const ch = supabase.channel(`dm:${dmId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${dmId}` }, (p) => {
        const n = p.new as any
        setDmMsgs(prev => prev.some(m => m.id === n.id) ? prev : [...prev, { ...n, profiles: { username: n.author_id === session.user.id ? username : (dmOther?.username || '?'), avatar_url: null } }])
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [dmId, mode])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, dmMsgs])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    const content = text.trim()
    setText('')

    if (mode === 'dm' && dmId) {
      const temp = 'temp-' + Date.now()
      setDmMsgs(prev => [...prev, { id: temp, content, author_id: session.user.id, created_at: new Date().toISOString(), profiles: { username, avatar_url: null } }])
      const { data, error } = await supabase.from('dm_messages')
        .insert({ conversation_id: dmId, author_id: session.user.id, content })
        .select().single()
      if (error) {
        alert(error.message)
        setDmMsgs(prev => prev.filter(m => m.id !== temp))
        setText(content)
      } else if (data) {
        setDmMsgs(prev => prev.map(m => m.id === temp ? { ...data, profiles: { username, avatar_url: null } } : m))
      }
    } else if (activeCh) {
      const temp = 'temp-' + Date.now()
      setMessages(prev => [...prev, { id: temp, content, author_id: session.user.id, created_at: new Date().toISOString(), profiles: { username, avatar_url: null } }])
      const { data, error } = await supabase.from('messages')
        .insert({ channel_id: activeCh, author_id: session.user.id, content })
        .select().single()
      if (error) {
        alert(error.message)
        setMessages(prev => prev.filter(m => m.id !== temp))
        setText(content)
      } else if (data) {
        setMessages(prev => prev.map(m => m.id === temp ? { ...data, profiles: { username, avatar_url: null } } : m))
      }
    }
  }

  const startDm = async (other: Profile) => {
    if (other.id === session.user.id) return
    const { data: mine } = await supabase.from('dm_participants').select('conversation_id').eq('user_id', session.user.id)
    if (mine) {
      for (const p of mine) {
        const { data: match } = await supabase.from('dm_participants')
          .select('conversation_id').eq('conversation_id', p.conversation_id).eq('user_id', other.id).maybeSingle()
        if (match) {
          setDmId(match.conversation_id)
          setDmOther(other)
          setMode('dm')
          setSidebarOpen(false)
          return
        }
      }
    }
    const { data: convo, error } = await supabase.from('dm_conversations').insert({}).select().single()
    if (error || !convo) { alert('DM failed: ' + (error?.message || 'unknown')); return }
    await supabase.from('dm_participants').insert([
      { conversation_id: convo.id, user_id: session.user.id },
      { conversation_id: convo.id, user_id: other.id },
    ])
    setDmId(convo.id)
    setDmOther(other)
    setMode('dm')
    setSidebarOpen(false)
  }

  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupId) return
    const { data: g } = await supabase.from('groups').select('invite_code').eq('id', groupId).single()
    if (!g || g.invite_code.toUpperCase() !== joinCode.trim().toUpperCase()) {
      alert('Wrong invite code')
      return
    }
    await ensureProfile()
    await supabase.from('group_members').insert({ group_id: groupId, user_id: session.user.id, role: 'member' })
    await loadGroup(groupId)
    setNeedsInvite(false)
  }

  const logout = async () => {
    await supabase.from('profiles').update({ status: 'offline' }).eq('id', session.user.id)
    await supabase.auth.signOut()
  }

  const display = mode === 'dm' ? dmMsgs : messages
  const activeName = mode === 'dm' ? (dmOther?.username || 'DM') : (channels.find(c => c.id === activeCh)?.name || 'general')

  if (loading) {
    return <div className="h-full flex items-center justify-center stripe-bg"><span className="text-bat-orange font-bold tracking-widest text-sm">LOADING...</span></div>
  }

  if (needsInvite) {
    return (
      <div className="h-full flex items-center justify-center stripe-bg p-4">
        <div className="w-full max-w-sm bg-bat-surface border border-bat-border rounded-xl p-8">
          <div className="h-1.5 orange-bar rounded-full mb-6" />
          <h2 className="text-lg font-black text-center mb-1">ENTER THE CODE</h2>
          <p className="text-xs text-bat-muted text-center mb-6">Ask the boys for the invite</p>
          <form onSubmit={join} className="space-y-3">
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="INVITE CODE" className="w-full px-4 py-3 rounded-lg bg-bat-elevated border border-bat-border text-center tracking-widest font-mono outline-none focus:border-bat-orange" />
            <button type="submit" className="w-full py-3 rounded-lg bg-bat-orange text-black font-bold">JOIN</button>
          </form>
          <button onClick={logout} className="w-full mt-4 text-xs text-bat-muted">Log out</button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex bg-bat-bg relative">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <div className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-bat-surface border-r border-bat-border flex flex-col transition-transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="h-12 px-4 flex items-center gap-2 border-b border-bat-border">
          <div className="w-8 h-8 rounded-lg bg-bat-orange text-black font-black flex items-center justify-center text-sm">B</div>
          <span className="font-black text-sm tracking-tight flex-1">BOYZ AT THE BACK</span>
          <button className="md:hidden p-1" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-[10px] font-bold text-bat-muted uppercase tracking-widest px-2 mb-1">Channels</div>
          {channels.map(c => (
            <button key={c.id}
              onClick={() => { setActiveCh(c.id); setMode('channel'); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm ${
                mode === 'channel' && activeCh === c.id ? 'bg-bat-elevated text-bat-orange' : 'text-bat-muted hover:bg-bat-elevated/50 hover:text-bat-text'
              }`}>
              <Hash size={14} />{c.name}
            </button>
          ))}

          <div className="text-[10px] font-bold text-bat-muted uppercase tracking-widest px-2 mt-4 mb-1">Invite</div>
          <div className="mx-2 flex items-center gap-1 bg-bat-elevated rounded-lg px-2 py-1.5">
            <code className="flex-1 text-xs font-mono text-bat-orange">{invite}</code>
            <button onClick={() => { navigator.clipboard.writeText(invite); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
              className="p-1 text-bat-muted hover:text-bat-text">
              {copied ? <Check size={14} className="text-bat-success" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        <div className="h-14 border-t border-bat-border px-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-bat-orange/20 text-bat-orange font-bold flex items-center justify-center text-sm">
            {username[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{username}</div>
            <div className="text-[10px] text-bat-success">● online</div>
          </div>
          <button onClick={logout} className="p-1.5 text-bat-muted hover:text-bat-text" title="Log out"><LogOut size={16} /></button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 px-3 md:px-4 flex items-center gap-2 border-b border-bat-border">
          <button className="md:hidden p-1.5" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          {mode === 'dm' ? <MessageCircle size={16} className="text-bat-muted" /> : <Hash size={16} className="text-bat-muted" />}
          <span className="font-semibold text-sm">{activeName}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          {display.length === 0 && (
            <div className="text-center text-bat-muted text-sm py-12">
              {mode === 'dm' ? 'Say something stupid' : `Welcome to #${activeName}. Don't be weird.`}
            </div>
          )}
          {display.map(m => (
            <div key={m.id} className="flex gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-bat-orange/20 text-bat-orange font-bold flex items-center justify-center text-sm flex-shrink-0">
                {(m.profiles?.username || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm">{m.profiles?.username || '?'}</span>
                  <span className="text-[10px] text-bat-muted">{format(new Date(m.created_at), 'h:mm a')}</span>
                </div>
                <div className="text-[15px] leading-relaxed break-words">{m.content}</div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="p-3 md:p-4 pt-0">
          <div className="bg-bat-elevated rounded-xl px-4 py-3 flex items-center gap-2 border border-bat-border">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={mode === 'dm' ? `Message ${dmOther?.username}...` : `Message #${activeName}`}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-bat-muted"
              autoComplete="off"
            />
            <button type="submit" disabled={!text.trim()} className="p-2 rounded-lg bg-bat-orange text-black disabled:opacity-30">
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>

      {/* Members - desktop */}
      <div className="hidden lg:flex w-48 bg-bat-surface border-l border-bat-border flex-col">
        <div className="h-12 px-3 flex items-center gap-2 border-b border-bat-border">
          <Users size={14} className="text-bat-muted" />
          <span className="text-xs font-bold text-bat-muted uppercase tracking-wider">Boyz</span>
        </div>
        <div className="flex-1 p-2 overflow-y-auto">
          {members.map(m => (
            <button key={m.id} onClick={() => startDm(m)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bat-elevated/50 text-left"
              title={m.id !== session.user.id ? 'DM' : ''}>
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-bat-orange/20 text-bat-orange text-xs font-bold flex items-center justify-center">
                  {(m.username || '?')[0].toUpperCase()}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bat-surface ${
                  m.status === 'online' ? 'bg-bat-success' : 'bg-bat-muted'
                }`} />
              </div>
              <span className="text-xs truncate">{m.username}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
