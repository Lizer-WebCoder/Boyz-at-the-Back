import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Chat from './components/Chat'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center stripe-bg">
        <div className="text-bat-orange font-bold tracking-widest text-sm">LOADING THE BOYZ...</div>
      </div>
    )
  }

  if (!session) return <Auth />
  return <Chat session={session} />
}
