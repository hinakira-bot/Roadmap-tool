'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Roadmap, Profile } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface RoadmapWithStats extends Roadmap {
  user_count: number
  completion_rate: number
}

interface UserWithProgress extends Profile {
  progress: { roadmap_title: string; completed: number; total: number }[]
}

export default function AdminPage() {
  const [roadmaps, setRoadmaps] = useState<RoadmapWithStats[]>([])
  const [users, setUsers] = useState<UserWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserWithProgress | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'roadmaps' | 'users'>('roadmaps')
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDays, setNewDays] = useState(7)
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const router = useRouter()

  const loadData = useCallback(async () => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    setDebugInfo(prev => prev + `\nSession: ${session ? 'あり (user: ' + session.user.id + ')' : 'なし'} Error: ${sessionError?.message || 'なし'}`)

    if (!session) {
      setDebugInfo(prev => prev + '\n→ セッションなし、リダイレクト')
      setLoading(false)
      return
    }

    // 管理者チェック
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, display_name, is_admin, created_at')
      .eq('id', session.user.id)
      .maybeSingle()

    setDebugInfo(prev => prev + `\nProfile: ${JSON.stringify(profile)} Error: ${profileError?.message || 'なし'}`)

    if (!profile) {
      setDebugInfo(prev => prev + '\n→ プロフィールなし')
      setLoading(false)
      return
    }

    if (!profile.is_admin) {
      setDebugInfo(prev => prev + '\n→ 管理者ではない')
      setLoading(false)
      return
    }

    setDebugInfo(prev => prev + '\n→ 管理者確認OK！')

    // ロードマップ一覧
    const { data: rms } = await supabase
      .from('roadmaps')
      .select('*')
      .order('created_at', { ascending: false })

    const roadmapsWithStats: RoadmapWithStats[] = []
    for (const rm of rms || []) {
      const { count: userCount } = await supabase
        .from('user_progress')
        .select('user_id', { count: 'exact', head: true })
        .eq('roadmap_id', rm.id)

      roadmapsWithStats.push({
        ...rm,
        user_count: userCount || 0,
        completion_rate: 0,
      })
    }
    setRoadmaps(roadmapsWithStats)

    // ユーザー一覧（進捗付き）
    const { data: allUsers } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    const usersWithProgress: UserWithProgress[] = []
    for (const user of allUsers || []) {
      const progressList: { roadmap_title: string; completed: number; total: number }[] = []
      for (const rm of rms || []) {
        const { count: completedCount } = await supabase
          .from('user_progress')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('roadmap_id', rm.id)

        // 全タスク数を取得
        const { data: rmDays } = await supabase
          .from('roadmap_days')
          .select('id')
          .eq('roadmap_id', rm.id)

        let totalTasks = 0
        if (rmDays) {
          for (const day of rmDays) {
            const { count } = await supabase
              .from('day_tasks')
              .select('id', { count: 'exact', head: true })
              .eq('day_id', day.id)
            totalTasks += count || 0
          }
        }

        if (completedCount && completedCount > 0) {
          progressList.push({
            roadmap_title: rm.title,
            completed: completedCount,
            total: totalTasks,
          })
        }
      }
      usersWithProgress.push({ ...user, progress: progressList })
    }
    setUsers(usersWithProgress)

    setLoading(false)
  }, [router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const createRoadmap = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: rm } = await supabase
      .from('roadmaps')
      .insert({
        title: newTitle,
        description: newDesc,
        total_days: newDays,
        created_by: session.user.id,
        is_published: false,
      })
      .select()
      .single()

    if (rm) {
      // 日を自動生成
      const daysToInsert = Array.from({ length: newDays }, (_, i) => ({
        roadmap_id: rm.id,
        day_number: i + 1,
        title: `Day ${i + 1}`,
        description: '',
      }))
      await supabase.from('roadmap_days').insert(daysToInsert)

      router.push(`/admin/edit/${rm.id}`)
    }
  }

  const togglePublish = async (rm: Roadmap) => {
    await supabase
      .from('roadmaps')
      .update({ is_published: !rm.is_published })
      .eq('id', rm.id)
    loadData()
  }

  const deleteRoadmap = async (id: string) => {
    if (!confirm('このロードマップを削除しますか？')) return
    await supabase.from('roadmaps').delete().eq('id', id)
    loadData()
  }

  const handleResetPassword = async () => {
    if (!resetUserId || !newPassword) return
    setResetMsg('')
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: resetUserId, newPassword }),
    })
    const data = await res.json()
    if (data.success) {
      setResetMsg('✅ パスワードを変更しました')
      setNewPassword('')
      setTimeout(() => { setResetUserId(null); setResetMsg('') }, 2000)
    } else {
      setResetMsg('❌ ' + data.error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">⚙️ 管理者ダッシュボード</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">ロードマップの管理・ユーザー進捗確認</p>
        </div>
        <button onClick={handleLogout} className="btn-secondary text-sm">
          ログアウト
        </button>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="day-card text-center">
          <div className="text-3xl font-bold text-[var(--accent)]">{roadmaps.length}</div>
          <div className="text-[var(--text-secondary)] text-sm">ロードマップ</div>
        </div>
        <div className="day-card text-center">
          <div className="text-3xl font-bold text-[var(--success)]">
            {roadmaps.filter((r) => r.is_published).length}
          </div>
          <div className="text-[var(--text-secondary)] text-sm">公開中</div>
        </div>
        <div className="day-card text-center">
          <div className="text-3xl font-bold text-[var(--accent)]">{users.length}</div>
          <div className="text-[var(--text-secondary)] text-sm">ユーザー数</div>
        </div>
        <div className="day-card text-center">
          <div className="text-3xl font-bold text-[var(--success)]">
            {users.filter((u) => !u.is_admin).length}
          </div>
          <div className="text-[var(--text-secondary)] text-sm">参加者</div>
        </div>
      </div>

      {/* タブ */}
      <div className="flex mb-6 rounded-xl overflow-hidden border border-[var(--border)]">
        <button
          onClick={() => setActiveTab('roadmaps')}
          className={`flex-1 py-3 text-center font-semibold transition-all ${
            activeTab === 'roadmaps'
              ? 'bg-[var(--accent)] text-white'
              : 'bg-transparent text-[var(--text-secondary)]'
          }`}
        >
          🗺️ ロードマップ管理
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-3 text-center font-semibold transition-all ${
            activeTab === 'users'
              ? 'bg-[var(--accent)] text-white'
              : 'bg-transparent text-[var(--text-secondary)]'
          }`}
        >
          👥 ユーザー管理
        </button>
      </div>

      {/* ロードマップ管理 */}
      {activeTab === 'roadmaps' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">ロードマップ一覧</h2>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              ＋ 新規作成
            </button>
          </div>

          {roadmaps.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-[var(--text-secondary)]">ロードマップがまだありません</p>
              <button onClick={() => setShowCreate(true)} className="btn-primary mt-4">
                最初のロードマップを作成
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {roadmaps.map((rm) => (
                <div key={rm.id} className="day-card">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-lg">{rm.title}</h3>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            rm.is_published
                              ? 'bg-[var(--success)]/20 text-[var(--success)]'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}
                        >
                          {rm.is_published ? '公開中' : '下書き'}
                        </span>
                      </div>
                      <p className="text-[var(--text-secondary)] text-sm mt-1">
                        {rm.total_days}日間 ・ 参加者 {rm.user_count}人
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/admin/edit/${rm.id}`)}
                        className="btn-secondary text-sm py-2 px-4"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => togglePublish(rm)}
                        className="btn-secondary text-sm py-2 px-4"
                      >
                        {rm.is_published ? '非公開' : '公開'}
                      </button>
                      <button
                        onClick={() => deleteRoadmap(rm.id)}
                        className="btn-secondary text-sm py-2 px-4 text-red-400 border-red-400/30 hover:bg-red-400/10"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ユーザー管理 */}
      {activeTab === 'users' && (
        <div>
          <h2 className="text-xl font-bold mb-4">ユーザー一覧</h2>
          {users.length === 0 ? (
            <p className="text-[var(--text-secondary)] text-center py-16">ユーザーはまだいません</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>名前</th>
                    <th>メール</th>
                    <th>進捗</th>
                    <th>権限</th>
                    <th>登録日</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="font-medium">{user.display_name || '未設定'}</td>
                      <td className="text-[var(--text-secondary)] text-sm">{user.email}</td>
                      <td>
                        {user.progress.length > 0 ? (
                          <div className="space-y-1">
                            {user.progress.map((p, i) => {
                              const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0
                              return (
                                <div key={i} className="text-xs">
                                  <span className="text-[var(--text-secondary)]">{p.roadmap_title}</span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <div className="progress-bar flex-1" style={{ height: 6 }}>
                                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className={`font-bold ${pct === 100 ? 'text-[var(--success)]' : 'text-[var(--accent)]'}`}>
                                      {pct}%
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <span className="text-[var(--text-secondary)] text-xs">未参加</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            user.is_admin
                              ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                              : 'bg-[var(--border)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {user.is_admin ? '管理者' : 'ユーザー'}
                        </span>
                      </td>
                      <td className="text-[var(--text-secondary)] text-sm">
                        {new Date(user.created_at).toLocaleDateString('ja-JP')}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="text-[var(--accent)] text-xs hover:underline"
                          >
                            詳細
                          </button>
                          <button
                            onClick={() => { setResetUserId(user.id); setNewPassword(''); setResetMsg('') }}
                            className="text-[var(--text-secondary)] text-xs hover:underline"
                          >
                            PW変更
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 新規作成モーダル */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-6">🗺️ 新規ロードマップ作成</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">タイトル</label>
                <input
                  type="text"
                  placeholder="例：Threads 7日間チャレンジ"
                  defaultValue=""
                  onBlur={(e) => setNewTitle(e.target.value)}
                  onKeyUp={(e) => { if (e.key !== 'Process') setNewTitle((e.target as HTMLInputElement).value) }}
                  className="input-field"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">説明</label>
                <textarea
                  placeholder="ロードマップの説明..."
                  defaultValue=""
                  onBlur={(e) => setNewDesc(e.target.value)}
                  onKeyUp={(e) => { if (e.key !== 'Process') setNewDesc((e.target as HTMLTextAreaElement).value) }}
                  className="input-field"
                  rows={3}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">日数</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  defaultValue={7}
                  onBlur={(e) => setNewDays(Number(e.target.value))}
                  onChange={(e) => setNewDays(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={createRoadmap}
                  disabled={!newTitle}
                  className="btn-primary flex-1"
                >
                  作成して編集へ →
                </button>
                <button onClick={() => setShowCreate(false)} className="btn-secondary">
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ユーザー詳細モーダル */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold">👤 {selectedUser.display_name || '未設定'}</h2>
                <p className="text-[var(--text-secondary)] text-sm">{selectedUser.email}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-[var(--text-secondary)] text-2xl hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">権限</span>
                <span>{selectedUser.is_admin ? '管理者' : 'ユーザー'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">登録日</span>
                <span>{new Date(selectedUser.created_at).toLocaleDateString('ja-JP')}</span>
              </div>
            </div>

            <h3 className="font-bold mb-3">📊 ロードマップ進捗</h3>
            {selectedUser.progress.length > 0 ? (
              <div className="space-y-4">
                {selectedUser.progress.map((p, i) => {
                  const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0
                  return (
                    <div key={i} className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-sm">{p.roadmap_title}</span>
                        <span className={`text-sm font-bold ${pct === 100 ? 'text-[var(--success)]' : 'text-[var(--accent)]'}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[var(--text-secondary)] text-xs mt-2">
                        {p.completed} / {p.total} タスク完了
                        {pct === 100 && ' 🎉'}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[var(--text-secondary)] text-sm py-4 text-center">
                まだロードマップに参加していません
              </p>
            )}

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => { setSelectedUser(null); setResetUserId(selectedUser.id); setNewPassword(''); setResetMsg('') }}
                className="btn-secondary text-sm flex-1"
              >
                🔑 パスワード変更
              </button>
              <button onClick={() => setSelectedUser(null)} className="btn-secondary text-sm">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* パスワードリセットモーダル */}
      {resetUserId && (
        <div className="modal-overlay" onClick={() => setResetUserId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">🔑 パスワード変更</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-4">
              {users.find(u => u.id === resetUserId)?.email} のパスワード
            </p>
            {resetMsg && (
              <div className="mb-4 p-3 rounded-xl text-sm bg-[var(--bg-primary)] border border-[var(--border)]">
                {resetMsg}
              </div>
            )}
            <div className="space-y-4">
              <input
                type="text"
                placeholder="新しいパスワード（6文字以上）"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleResetPassword}
                  disabled={!newPassword || newPassword.length < 6}
                  className="btn-primary flex-1"
                >
                  パスワードを変更
                </button>
                <button onClick={() => setResetUserId(null)} className="btn-secondary">
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
