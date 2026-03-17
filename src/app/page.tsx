'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showReset, setShowReset] = useState(false)
  const [resetNewPw, setResetNewPw] = useState('')
  const [loginFailed, setLoginFailed] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .maybeSingle()
        if (profile?.is_admin) {
          router.push('/admin')
        } else {
          router.push('/roadmap/select')
        }
      } else {
        setChecking(false)
      }
    }
    checkSession()
  }, [router])

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoginFailed(true)
    } else {
      if (isAdmin) {
        router.push('/admin')
      } else {
        router.push('/roadmap/select')
      }
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    if (password.length < 6) {
      setError('パスワードは6文字以上にしてください')
      setLoading(false)
      return
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || email.split('@')[0] } },
    })
    if (error) {
      if (error.message.includes('already registered')) {
        setError('このメールアドレスは既に登録されています。ログインしてください。')
      } else {
        setError(error.message)
      }
    } else if (data.user) {
      await supabase
        .from('profiles')
        .update({ display_name: displayName || email.split('@')[0] })
        .eq('id', data.user.id)
      router.push('/roadmap/select')
    }
    setLoading(false)
  }

  const handleResetPassword = async () => {
    setError('')
    setSuccess('')
    if (!email) { setError('メールアドレスを入力してください'); return }
    if (resetNewPw.length < 6) { setError('新しいパスワードは6文字以上にしてください'); return }
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword: resetNewPw }),
    })
    const data = await res.json()
    if (data.success) {
      setSuccess('パスワードをリセットしました！新しいパスワードでログインしてください。')
      setPassword(resetNewPw)
      setResetNewPw('')
      setShowReset(false)
      setLoginFailed(false)
    } else {
      setError('リセットに失敗しました: ' + data.error)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a1a]">
        <div className="text-amber-300 text-lg animate-pulse">冒険の準備中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* 背景画像 */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/login-bg.png"
          alt="背景"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1a] via-transparent to-transparent" />
      </div>

      {/* ログインカード */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-[#1a1a2e]/90 backdrop-blur-md border-2 border-amber-500/30 rounded-2xl p-8 shadow-[0_0_40px_rgba(245,158,11,0.15)]">
          {/* ヒーローアバター */}
          <div className="text-center mb-6">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <Image
                src="/images/hero-avatar.png"
                alt="勇者"
                fill
                className="object-contain drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]"
              />
            </div>
            <h1 className="text-3xl font-bold text-amber-300 tracking-wider" style={{ fontFamily: 'serif' }}>
              Quest Roadmap
            </h1>
            <p className="text-amber-100/60 text-sm mt-1">
              冒険の旅に出よう
            </p>
          </div>

          {/* ユーザー / 管理者 タブ */}
          <div className="flex mb-6 rounded-lg overflow-hidden border border-amber-500/30">
            <button
              onClick={() => { setIsAdmin(false); setError(''); setSuccess('') }}
              className={`flex-1 py-2.5 text-center font-semibold text-sm transition-all ${
                !isAdmin
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-inner'
                  : 'bg-transparent text-amber-300/50 hover:text-amber-300'
              }`}
            >
              ユーザー
            </button>
            <button
              onClick={() => { setIsAdmin(true); setIsRegister(false); setError(''); setSuccess('') }}
              className={`flex-1 py-2.5 text-center font-semibold text-sm transition-all ${
                isAdmin
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-inner'
                  : 'bg-transparent text-amber-300/50 hover:text-amber-300'
              }`}
            >
              管理者
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/40 rounded-lg text-red-300 text-sm">
              {error}
              {loginFailed && !showReset && (
                <button
                  onClick={() => { setShowReset(true); setError(''); setResetNewPw('') }}
                  className="block mt-2 text-amber-400 hover:text-amber-300 hover:underline"
                >
                  パスワードを忘れた方はこちら →
                </button>
              )}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-900/30 border border-green-500/40 rounded-lg text-green-300 text-sm">
              {success}
            </div>
          )}

          {/* パスワードリセット */}
          {showReset && (
            <div className="mb-6 p-4 rounded-lg border border-amber-500/30 bg-amber-900/20">
              <h3 className="font-bold mb-2 text-amber-300 text-sm">パスワードをリセット</h3>
              <p className="text-amber-100/40 text-xs mb-3">メールアドレスを入力し、新しいパスワードを設定</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="新しいパスワード（6文字以上）"
                  value={resetNewPw}
                  onChange={(e) => setResetNewPw(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0d0d20] border border-amber-500/20 rounded-lg text-amber-100 placeholder-amber-100/30 focus:border-amber-400 focus:outline-none transition-colors"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleResetPassword}
                    disabled={!email || resetNewPw.length < 6}
                    className="flex-1 py-2 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-lg font-semibold text-sm hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 transition-all"
                  >
                    リセット
                  </button>
                  <button
                    onClick={() => { setShowReset(false); setLoginFailed(false) }}
                    className="py-2 px-4 border border-amber-500/30 text-amber-300 rounded-lg text-sm hover:bg-amber-500/10 transition-all"
                  >
                    戻る
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {!isAdmin && isRegister && (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500/50">⚔️</span>
                <input
                  type="text"
                  placeholder="表示名（ニックネーム）"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#0d0d20] border border-amber-500/20 rounded-lg text-amber-100 placeholder-amber-100/30 focus:border-amber-400 focus:outline-none transition-colors"
                />
              </div>
            )}

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500/50">📧</span>
              <input
                type="email"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#0d0d20] border border-amber-500/20 rounded-lg text-amber-100 placeholder-amber-100/30 focus:border-amber-400 focus:outline-none transition-colors"
              />
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500/50">🔑</span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="パスワード（6文字以上）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-[#0d0d20] border border-amber-500/20 rounded-lg text-amber-100 placeholder-amber-100/30 focus:border-amber-400 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500/50 hover:text-amber-400 text-sm"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            <button
              onClick={isRegister ? handleRegister : handleLogin}
              disabled={loading || !email || !password}
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-lg font-bold text-lg hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)]"
            >
              {loading ? '準備中...' : isRegister ? '新規登録' : 'ログイン'}
            </button>
          </div>

          {!isAdmin && (
            <div className="text-center mt-4">
              <button
                onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess('') }}
                className="text-amber-400/70 text-sm hover:text-amber-300 hover:underline transition-colors"
              >
                {isRegister ? 'アカウントをお持ちの方はこちら（ログイン）' : '初めての方はこちら（新規登録）'}
              </button>
            </div>
          )}

          {isAdmin && (
            <p className="text-amber-100/40 text-sm text-center mt-4">
              管理者専用入口
            </p>
          )}
        </div>

        {/* 装飾テキスト */}
        <p className="text-center text-amber-500/30 text-xs mt-4 tracking-widest">
          — YOUR QUEST AWAITS —
        </p>
      </div>
    </div>
  )
}
