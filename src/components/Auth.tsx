import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)

    try {
      if (mode === 'signup') {
        if (!username.trim()) throw new Error('Username required')
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: username.trim() } },
        })
        if (err) throw err
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            username: username.trim(),
            status: 'online',
          })
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      }
    } catch (err: any) {
      setError(err.message || 'Something broke')
    }
    setBusy(false)
  }

  return (
    <div className="h-full flex items-center justify-center stripe-bg p-4">
      <div className="w-full max-w-sm">
        {/* hazard top bar */}
        <div className="h-2 orange-bar rounded-t-xl" />
        <div className="bg-bat-surface border border-bat-border border-t-0 rounded-b-xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-bat-orange text-black font-black text-2xl mb-3 shadow-lg shadow-orange-900/40">
              B
            </div>
            <h1 className="text-xl font-black tracking-tight text-bat-text">BOYZ AT THE BACK</h1>
            <p className="text-xs text-bat-muted mt-1 uppercase tracking-widest">private hangout · no girls allowed (jk)</p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-bat-elevated border border-bat-border outline-none focus:border-bat-orange text-sm"
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-bat-elevated border border-bat-border outline-none focus:border-bat-orange text-sm"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-bat-elevated border border-bat-border outline-none focus:border-bat-orange text-sm"
              required
              minLength={6}
            />
            {error && <p className="text-bat-danger text-xs text-center">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-lg bg-bat-orange hover:bg-bat-orangeHot text-black font-bold text-sm disabled:opacity-50 transition"
            >
              {busy ? '...' : mode === 'signup' ? 'JOIN THE BOYZ' : 'LOG IN'}
            </button>
          </form>

          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
            className="w-full mt-4 text-xs text-bat-muted hover:text-bat-orange transition"
          >
            {mode === 'login' ? "New here? Sign up" : 'Already a boy? Log in'}
          </button>
        </div>
      </div>
    </div>
  )
}
