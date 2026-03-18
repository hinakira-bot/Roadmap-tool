'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getSoundManager } from '@/lib/sounds'

interface HeaderProps {
  onAvatarRef?: (el: HTMLDivElement | null) => void
}

export default function Header({ onAvatarRef }: HeaderProps) {
  const [profile, setProfile] = useState<{
    display_name: string
    avatar_id: string | null
    is_admin: boolean
  } | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string>('/images/hero-avatar.png')
  const [muted, setMuted] = useState(true)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const loadProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
      return
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('display_name, avatar_id, is_admin')
      .eq('id', session.user.id)
      .maybeSingle()

    if (prof) {
      setProfile(prof)

      // アバター画像URL取得
      if (prof.avatar_id) {
        const { data: avatar } = await supabase
          .from('avatars')
          .select('image_url')
          .eq('id', prof.avatar_id)
          .maybeSingle()
        if (avatar?.image_url) {
          setAvatarUrl(avatar.image_url)
        }
      }
    }

    // サウンド状態を復元
    const sm = getSoundManager()
    setMuted(sm.muted)

    setLoading(false)
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleLogout = async () => {
    getSoundManager().stopBGM()
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleToggleMute = () => {
    const sm = getSoundManager()
    const nowMuted = sm.toggleMute()
    setMuted(nowMuted)
    if (!nowMuted) {
      sm.playBGM()
    } else {
      sm.stopBGM()
    }
  }

  if (loading) {
    return (
      <header className="sticky top-0 z-40 bg-[#0a0a1a]/95 backdrop-blur-md border-b border-amber-500/20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 animate-pulse" />
            <div className="h-4 w-24 bg-amber-500/10 rounded animate-pulse" />
          </div>
        </div>
      </header>
    )
  }

  if (!profile) return null

  return (
    <header className="sticky top-0 z-40 bg-[#0a0a1a]/95 backdrop-blur-md border-b border-amber-500/20">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
        {/* 左: アバター + 名前 */}
        <div className="flex items-center gap-3">
          <div
            ref={onAvatarRef}
            className="header-avatar relative w-10 h-10 rounded-full overflow-hidden border-2 border-amber-500/40"
          >
            {avatarUrl.startsWith('/') ? (
              <Image
                src={avatarUrl}
                alt="アバター"
                fill
                className="object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="アバター"
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div>
            <p className="text-amber-400 text-xs">ようこそ、勇者</p>
            <p className="text-amber-100 font-bold text-sm">{profile.display_name}</p>
          </div>
        </div>

        {/* 右: ミュート + ログアウト */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleMute}
            className="p-2 text-amber-500/60 hover:text-amber-300 transition-colors"
            title={muted ? '音をONにする' : '音をOFFにする'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={handleLogout}
            className="py-1.5 px-3 border border-amber-500/30 text-amber-300 rounded-lg text-xs hover:bg-amber-500/10 transition-all"
          >
            ログアウト
          </button>
        </div>
      </div>
    </header>
  )
}
