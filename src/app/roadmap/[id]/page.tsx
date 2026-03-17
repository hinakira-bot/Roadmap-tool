'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Roadmap, RoadmapDay, DayTask, UserProgress } from '@/lib/types'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'

interface DayWithTasks extends RoadmapDay {
  tasks: DayTask[]
}

export default function RoadmapPage() {
  const params = useParams()
  const router = useRouter()
  const roadmapId = params.id as string

  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [days, setDays] = useState<DayWithTasks[]>([])
  const [progress, setProgress] = useState<UserProgress[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<DayWithTasks | null>(null)
  const [selectedTask, setSelectedTask] = useState<DayTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCelebration, setShowCelebration] = useState(false)

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }
    setUserId(session.user.id)

    const { data: rm } = await supabase.from('roadmaps').select('*').eq('id', roadmapId).single()
    setRoadmap(rm)

    const { data: daysData } = await supabase
      .from('roadmap_days').select('*').eq('roadmap_id', roadmapId).order('day_number')

    if (daysData) {
      const daysWithTasks: DayWithTasks[] = []
      for (const day of daysData) {
        const { data: tasks } = await supabase
          .from('day_tasks').select('*').eq('day_id', day.id).order('order_index')
        daysWithTasks.push({ ...day, tasks: tasks || [] })
      }
      setDays(daysWithTasks)
    }

    const { data: prog } = await supabase
      .from('user_progress').select('*').eq('user_id', session.user.id).eq('roadmap_id', roadmapId)
    setProgress(prog || [])
    setLoading(false)
  }, [roadmapId, router])

  useEffect(() => { loadData() }, [loadData])

  const isTaskCompleted = (taskId: string) => progress.some((p) => p.task_id === taskId)
  const isDayCompleted = (day: DayWithTasks) => day.tasks.length > 0 && day.tasks.every((t) => isTaskCompleted(t.id))
  const isDayUnlocked = (dayIndex: number) => dayIndex === 0 || isDayCompleted(days[dayIndex - 1])
  const getDayStatus = (day: DayWithTasks, index: number): 'completed' | 'active' | 'locked' => {
    if (isDayCompleted(day)) return 'completed'
    if (isDayUnlocked(index)) return 'active'
    return 'locked'
  }
  const getCompletedTaskCount = (day: DayWithTasks) => day.tasks.filter((t) => isTaskCompleted(t.id)).length

  const totalTasks = days.reduce((sum, d) => sum + d.tasks.length, 0)
  const completedTasks = progress.length
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const currentLevel = days.filter((d) => isDayCompleted(d)).length + 1

  const toggleTask = async (taskId: string) => {
    if (!userId) return
    const completed = isTaskCompleted(taskId)
    if (completed) {
      await supabase.from('user_progress').delete().eq('user_id', userId).eq('task_id', taskId)
      setProgress((prev) => prev.filter((p) => p.task_id !== taskId))
    } else {
      const { data } = await supabase
        .from('user_progress').insert({ user_id: userId, roadmap_id: roadmapId, task_id: taskId }).select().single()
      if (data) {
        setProgress((prev) => [...prev, data])
        // Day完了チェック
        if (selectedDay) {
          const updatedProgress = [...progress, data]
          const allDone = selectedDay.tasks.every((t) => t.id === taskId || updatedProgress.some((p) => p.task_id === t.id))
          if (allDone) {
            setShowCelebration(true)
            setTimeout(() => setShowCelebration(false), 3000)
          }
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a1a]">
        <div className="text-amber-300 text-lg animate-pulse">ダンジョンに入っています...</div>
      </div>
    )
  }

  if (!roadmap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a1a]">
        <div className="text-center">
          <div className="text-5xl mb-4">💀</div>
          <p className="text-amber-300">このクエストは存在しません</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 背景 */}
      <div className="absolute inset-0 z-0">
        <Image src="/images/map-bg.png" alt="マップ" fill className="object-cover opacity-20" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1a]/90 via-[#0a0a1a]/60 to-[#0a0a1a]/95" />
      </div>

      <div className="relative z-10 p-4 md:p-8 max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => router.push('/roadmap/select')}
            className="py-2 px-4 border border-amber-500/30 text-amber-300 rounded-lg text-sm hover:bg-amber-500/10 transition-all"
          >
            ← クエストボード
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">
              Lv.{currentLevel}
            </span>
          </div>
        </div>

        {/* タイトル */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-amber-200 mb-2" style={{ fontFamily: 'serif' }}>
            {roadmap.title}
          </h1>
          <p className="text-amber-100/40 text-sm mb-6">{roadmap.description}</p>

          {/* EXPバー */}
          <div className="max-w-sm mx-auto">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-amber-400 font-semibold">EXP</span>
              <span className="text-amber-300">{completedTasks}/{totalTasks} ({overallProgress}%)</span>
            </div>
            <div className="h-3 bg-[#1a1a2e] rounded-full border border-amber-500/20 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* ステージマップ */}
        <div className="space-y-3">
          {days.map((day, index) => {
            const status = getDayStatus(day, index)
            const completedCount = getCompletedTaskCount(day)
            const stageNum = ((day.day_number - 1) % 7) + 1

            return (
              <div
                key={day.id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                  status === 'completed'
                    ? 'bg-green-900/20 border-green-500/30 hover:border-green-400/50'
                    : status === 'active'
                    ? 'bg-amber-900/20 border-amber-500/30 hover:border-amber-400/50 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                    : 'bg-[#1a1a2e]/40 border-gray-700/30 opacity-60'
                }`}
                onClick={() => {
                  if (status !== 'locked') setSelectedDay(day)
                }}
              >
                <div className="relative w-14 h-14 flex-shrink-0">
                  {status === 'locked' ? (
                    <Image src="/images/locked-stage.png" alt="ロック" fill className="object-contain opacity-50" />
                  ) : (
                    <Image
                      src={`/images/stage-${stageNum}.png`}
                      alt={`ステージ${day.day_number}`}
                      fill
                      className={`object-contain ${status === 'completed' ? 'brightness-110' : ''}`}
                    />
                  )}
                  {status === 'completed' && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs text-white font-bold shadow-[0_0_8px_rgba(34,197,94,0.5)]">
                      ✓
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold ${
                      status === 'completed' ? 'text-green-300' : status === 'active' ? 'text-amber-200' : 'text-gray-500'
                    }`}>
                      Stage {day.day_number}
                    </h3>
                    {status === 'locked' && <span className="text-sm">🔒</span>}
                    {status === 'completed' && <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full">CLEAR</span>}
                  </div>
                  <p className={`font-semibold text-sm ${
                    status === 'completed' ? 'text-green-200/70' : status === 'active' ? 'text-amber-400' : 'text-gray-600'
                  }`}>{day.title}</p>
                  <p className={`text-xs truncate mt-0.5 ${
                    status === 'locked' ? 'text-gray-600' : 'text-amber-100/30'
                  }`}>{day.description}</p>
                </div>

                <div className="text-right flex-shrink-0">
                  {status !== 'locked' && (
                    <>
                      <span className="text-xs text-amber-100/50">{completedCount}/{day.tasks.length}</span>
                      <div className="h-1.5 w-12 bg-[#0d0d20] rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            status === 'completed' ? 'bg-green-400' : 'bg-amber-400'
                          }`}
                          style={{ width: day.tasks.length > 0 ? `${(completedCount / day.tasks.length) * 100}%` : '0%' }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 全クリア */}
        {overallProgress === 100 && (
          <div className="mt-8 text-center p-8 bg-gradient-to-b from-amber-900/30 to-transparent border border-amber-500/30 rounded-2xl">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <Image src="/images/quest-complete.png" alt="クリア" fill className="object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-amber-300 mb-2" style={{ fontFamily: 'serif' }}>
              Quest Complete!
            </h2>
            <p className="text-amber-100/50">全てのステージをクリアしました！おめでとうございます！</p>
          </div>
        )}
      </div>

      {/* クエスト一覧モーダル */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedDay(null)}>
          <div className="bg-[#1a1a2e] border border-amber-500/30 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-[0_0_40px_rgba(245,158,11,0.1)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12">
                  <Image src={`/images/stage-${((selectedDay.day_number - 1) % 7) + 1}.png`} alt="ステージ" fill className="object-contain" />
                </div>
                <div>
                  <p className="text-amber-500 text-xs font-semibold tracking-wider">STAGE {selectedDay.day_number}</p>
                  <h2 className="text-xl font-bold text-amber-200">{selectedDay.title}</h2>
                  <p className="text-amber-100/40 text-sm mt-0.5">{selectedDay.description}</p>
                </div>
              </div>
              <button onClick={() => setSelectedDay(null)} className="text-amber-500/50 text-2xl hover:text-amber-300">×</button>
            </div>

            <div className="space-y-2">
              {selectedDay.tasks.map((task) => {
                const completed = isTaskCompleted(task.id)
                return (
                  <div key={task.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    completed
                      ? 'bg-green-900/20 border-green-500/20'
                      : 'bg-[#0d0d20]/50 border-amber-500/10 hover:border-amber-500/30'
                  }`}>
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                        completed
                          ? 'bg-green-500 border-green-400 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                          : 'border-amber-500/30 hover:border-amber-400'
                      }`}
                    >
                      {completed && <span className="text-white text-xs font-bold">✓</span>}
                    </button>
                    <div className="flex-1 cursor-pointer" onClick={() => setSelectedTask(task)}>
                      <p className={`font-medium text-sm ${completed ? 'line-through text-green-300/50' : 'text-amber-100'}`}>
                        {task.title}
                      </p>
                      <p className="text-amber-100/20 text-xs mt-0.5">タップで詳細</p>
                    </div>
                    {completed && <span className="text-green-400 text-xs">+EXP</span>}
                  </div>
                )
              })}
            </div>

            {selectedDay.tasks.length > 0 && selectedDay.tasks.every((t) => isTaskCompleted(t.id)) && (
              <div className="mt-6 text-center p-4 rounded-xl bg-green-900/20 border border-green-500/30">
                <p className="text-green-300 font-bold">
                  Stage {selectedDay.day_number} Clear! 次のステージが解放されました！
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* タスク詳細モーダル */}
      {selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedTask(null)}>
          <div className="bg-[#1a1a2e] border border-amber-500/30 rounded-2xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(245,158,11,0.1)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold text-amber-200">📜 {selectedTask.title}</h2>
              <button onClick={() => setSelectedTask(null)} className="text-amber-500/50 text-2xl hover:text-amber-300">×</button>
            </div>
            <div className="text-amber-100/60 whitespace-pre-wrap leading-relaxed text-sm bg-[#0d0d20]/50 p-4 rounded-lg border border-amber-500/10">
              {selectedTask.description || 'クエストの詳細はまだ設定されていません。'}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { toggleTask(selectedTask.id); setSelectedTask(null) }}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                  isTaskCompleted(selectedTask.id)
                    ? 'border border-amber-500/30 text-amber-300 hover:bg-amber-500/10'
                    : 'bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:from-amber-500 hover:to-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                }`}
              >
                {isTaskCompleted(selectedTask.id) ? '未完了に戻す' : 'クエスト達成！ ⚔️'}
              </button>
              <button onClick={() => setSelectedTask(null)} className="py-3 px-4 border border-amber-500/30 text-amber-300 rounded-lg text-sm hover:bg-amber-500/10">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ステージクリア演出 */}
      {showCelebration && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
          <div className="text-center animate-bounce">
            <div className="relative w-40 h-40 mx-auto">
              <Image src="/images/quest-complete.png" alt="クリア" fill className="object-contain" />
            </div>
            <p className="text-3xl font-bold text-amber-300 mt-4" style={{ fontFamily: 'serif' }}>
              Stage Clear!
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
