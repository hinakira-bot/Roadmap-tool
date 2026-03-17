'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Roadmap } from '@/lib/types'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function SelectRoadmapPage() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([])
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
        return
      }
      // ユーザー名取得
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .maybeSingle()
      setDisplayName(profile?.display_name || session.user.email?.split('@')[0] || '冒険者')

      const { data } = await supabase
        .from('roadmaps')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
      setRoadmaps(data || [])
      setLoading(false)
    }
    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a1a]">
        <div className="text-amber-300 text-lg animate-pulse">クエストボードを読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 背景マップ */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/map-bg.png"
          alt="冒険マップ"
          fill
          className="object-cover opacity-30"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1a]/80 via-[#0a0a1a]/50 to-[#0a0a1a]/90" />
      </div>

      <div className="relative z-10 p-6 max-w-3xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <Image src="/images/hero-avatar.png" alt="勇者" fill className="object-contain" />
            </div>
            <div>
              <p className="text-amber-400 text-sm">ようこそ、勇者</p>
              <p className="text-amber-100 font-bold">{displayName}</p>
            </div>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
            className="py-2 px-4 border border-amber-500/30 text-amber-300 rounded-lg text-sm hover:bg-amber-500/10 transition-all"
          >
            ログアウト
          </button>
        </div>

        {/* タイトル */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-amber-300 tracking-wider mb-2" style={{ fontFamily: 'serif' }}>
            Quest Board
          </h1>
          <p className="text-amber-100/50">挑戦するクエストを選んでください</p>
          <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent mx-auto mt-3" />
        </div>

        {roadmaps.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📜</div>
            <p className="text-amber-100/50 text-lg">まだクエストが掲示されていません</p>
            <p className="text-amber-100/30 text-sm mt-2">ギルドマスターの告知をお待ちください</p>
          </div>
        ) : (
          <div className="space-y-4">
            {roadmaps.map((rm, index) => (
              <button
                key={rm.id}
                onClick={() => router.push(`/roadmap/${rm.id}`)}
                className="w-full text-left group"
              >
                <div className="flex items-center gap-4 p-5 bg-[#1a1a2e]/80 backdrop-blur-sm border border-amber-500/20 rounded-xl hover:border-amber-400/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all duration-300">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <Image
                      src={`/images/stage-${(index % 7) + 1}.png`}
                      alt="ステージ"
                      fill
                      className="object-contain group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-amber-200 group-hover:text-amber-100 transition-colors">
                      {rm.title}
                    </h3>
                    <p className="text-amber-100/40 text-sm mt-1">{rm.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
                        {rm.total_days}日間の冒険
                      </span>
                    </div>
                  </div>
                  <span className="text-amber-500 text-2xl group-hover:translate-x-1 transition-transform duration-300">
                    ⚔️
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
