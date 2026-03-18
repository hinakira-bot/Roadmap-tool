'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Roadmap, RoadmapDay, DayTask } from '@/lib/types'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import RichTextEditor from '@/components/RichTextEditor'

interface DayWithTasks extends RoadmapDay {
  tasks: DayTask[]
}

export default function EditRoadmapPage() {
  const params = useParams()
  const router = useRouter()
  const roadmapId = params.id as string

  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [days, setDays] = useState<DayWithTasks[]>([])
  const [selectedDay, setSelectedDay] = useState<DayWithTasks | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingTask, setEditingTask] = useState<DayTask | null>(null)
  const [uploadingBg, setUploadingBg] = useState(false)
  const [uploadingStage, setUploadingStage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_admin) {
      router.push('/')
      return
    }

    const { data: rm } = await supabase
      .from('roadmaps')
      .select('*')
      .eq('id', roadmapId)
      .single()
    setRoadmap(rm)

    const { data: daysData } = await supabase
      .from('roadmap_days')
      .select('*')
      .eq('roadmap_id', roadmapId)
      .order('day_number')

    if (daysData) {
      const daysWithTasks: DayWithTasks[] = []
      for (const day of daysData) {
        const { data: tasks } = await supabase
          .from('day_tasks')
          .select('*')
          .eq('day_id', day.id)
          .order('order_index')
        daysWithTasks.push({ ...day, tasks: tasks || [] })
      }
      setDays(daysWithTasks)
    }
    setLoading(false)
  }, [roadmapId, router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateRoadmap = async (field: string, value: string | boolean | null) => {
    await supabase.from('roadmaps').update({ [field]: value }).eq('id', roadmapId)
    setRoadmap((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const updateDay = async (dayId: string, field: string, value: string | null) => {
    setSaving(true)
    await supabase.from('roadmap_days').update({ [field]: value }).eq('id', dayId)
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, [field]: value } : d))
    )
    if (selectedDay?.id === dayId) {
      setSelectedDay((prev) => (prev ? { ...prev, [field]: value } : prev))
    }
    setSaving(false)
  }

  const addTask = async (dayId: string) => {
    const day = days.find((d) => d.id === dayId)
    const orderIndex = day ? day.tasks.length : 0

    const { data } = await supabase
      .from('day_tasks')
      .insert({
        day_id: dayId,
        title: '新しいタスク',
        description: '',
        order_index: orderIndex,
      })
      .select()
      .single()

    if (data) {
      setDays((prev) =>
        prev.map((d) => (d.id === dayId ? { ...d, tasks: [...d.tasks, data] } : d))
      )
      if (selectedDay?.id === dayId) {
        setSelectedDay((prev) =>
          prev ? { ...prev, tasks: [...prev.tasks, data] } : prev
        )
      }
      setEditingTask(data)
    }
  }

  const updateTask = async (taskId: string, field: string, value: string) => {
    await supabase.from('day_tasks').update({ [field]: value }).eq('id', taskId)
    const updateTasks = (tasks: DayTask[]) =>
      tasks.map((t) => (t.id === taskId ? { ...t, [field]: value } : t))

    setDays((prev) =>
      prev.map((d) => ({ ...d, tasks: updateTasks(d.tasks) }))
    )
    if (selectedDay) {
      setSelectedDay((prev) =>
        prev ? { ...prev, tasks: updateTasks(prev.tasks) } : prev
      )
    }
    if (editingTask?.id === taskId) {
      setEditingTask((prev) => (prev ? { ...prev, [field]: value } : prev))
    }
  }

  const deleteTask = async (taskId: string) => {
    await supabase.from('day_tasks').delete().eq('id', taskId)
    const filterTasks = (tasks: DayTask[]) => tasks.filter((t) => t.id !== taskId)

    setDays((prev) =>
      prev.map((d) => ({ ...d, tasks: filterTasks(d.tasks) }))
    )
    if (selectedDay) {
      setSelectedDay((prev) =>
        prev ? { ...prev, tasks: filterTasks(prev.tasks) } : prev
      )
    }
    setEditingTask(null)
  }

  // 背景画像アップロード
  const uploadBackgroundImage = async (file: File) => {
    setUploadingBg(true)
    const ext = file.name.split('.').pop()
    const filePath = `${roadmapId}/background-${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('roadmap-backgrounds')
      .upload(filePath, file, { upsert: true })

    if (!error) {
      const { data: { publicUrl } } = supabase.storage
        .from('roadmap-backgrounds')
        .getPublicUrl(filePath)
      await updateRoadmap('background_image_url', publicUrl)
    } else {
      alert('アップロードに失敗しました: ' + error.message)
    }
    setUploadingBg(false)
  }

  const removeBackgroundImage = async () => {
    await updateRoadmap('background_image_url', null)
  }

  // ステージ画像アップロード
  const uploadStageImage = async (dayId: string, file: File) => {
    setUploadingStage(dayId)
    const ext = file.name.split('.').pop()
    const filePath = `${roadmapId}/${dayId}/stage-${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('stage-images')
      .upload(filePath, file, { upsert: true })

    if (!error) {
      const { data: { publicUrl } } = supabase.storage
        .from('stage-images')
        .getPublicUrl(filePath)
      await updateDay(dayId, 'stage_image_url', publicUrl)
    } else {
      alert('アップロードに失敗しました: ' + error.message)
    }
    setUploadingStage(null)
  }

  const removeStageImage = async (dayId: string) => {
    await updateDay(dayId, 'stage_image_url', null)
  }

  if (loading || !roadmap) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => router.push('/admin')} className="btn-secondary text-sm">
            ← ダッシュボードに戻る
          </button>
          <div className="flex gap-2 items-center">
            {saving && <span className="text-[var(--text-secondary)] text-sm">保存中...</span>}
            <span
              className={`text-xs px-3 py-1 rounded-full ${
                roadmap.is_published
                  ? 'bg-[var(--success)]/20 text-[var(--success)]'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {roadmap.is_published ? '公開中' : '下書き'}
            </span>
            <button
              onClick={() => updateRoadmap('is_published', !roadmap.is_published)}
              className="btn-primary text-sm py-2"
            >
              {roadmap.is_published ? '非公開にする' : '公開する'}
            </button>
          </div>
        </div>

        {/* ロードマップ基本情報 */}
        <div className="day-card mb-8">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">タイトル</label>
              <input
                type="text"
                defaultValue={roadmap.title}
                onBlur={(e) => updateRoadmap('title', e.target.value)}
                className="input-field text-xl font-bold"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">説明</label>
              <textarea
                defaultValue={roadmap.description}
                onBlur={(e) => updateRoadmap('description', e.target.value)}
                className="input-field"
                rows={2}
              />
            </div>

            {/* 背景画像 */}
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">🖼️ 背景画像</label>
              {roadmap.background_image_url ? (
                <div className="flex items-center gap-4">
                  <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-[var(--border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={roadmap.background_image_url}
                      alt="背景"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="btn-secondary text-xs py-1 px-3 cursor-pointer text-center">
                      差し替え
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) uploadBackgroundImage(file)
                        }}
                      />
                    </label>
                    <button
                      onClick={removeBackgroundImage}
                      className="btn-secondary text-xs py-1 px-3 text-red-400 border-red-400/30"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ) : (
                <label className="block w-full p-4 border-2 border-dashed border-[var(--border)] rounded-lg text-center cursor-pointer hover:border-[var(--accent)] transition-colors">
                  <span className="text-[var(--text-secondary)] text-sm">
                    {uploadingBg ? 'アップロード中...' : 'クリックして背景画像をアップロード'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingBg}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadBackgroundImage(file)
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* 日一覧 */}
        <h2 className="text-xl font-bold mb-4">📅 日程編集</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {days.map((day) => (
            <div
              key={day.id}
              className={`day-card cursor-pointer ${
                selectedDay?.id === day.id ? 'day-active' : ''
              }`}
              onClick={() => setSelectedDay(day)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="day-dot day-dot-active text-sm">{day.day_number}</div>
                <div className="flex-1">
                  <input
                    type="text"
                    defaultValue={day.title}
                    onBlur={(e) => updateDay(day.id, 'title', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="input-field py-1 px-2 text-sm font-bold"
                    placeholder="テーマを入力..."
                  />
                </div>
              </div>
              <textarea
                defaultValue={day.description}
                onBlur={(e) => updateDay(day.id, 'description', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="input-field py-1 px-2 text-xs"
                rows={2}
                placeholder="この日の説明..."
              />

              {/* ステージ画像 */}
              <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {day.stage_image_url ? (
                  <>
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-[var(--border)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={day.stage_image_url} alt="ステージ" className="w-full h-full object-cover" />
                    </div>
                    <label className="text-[var(--accent)] text-xs hover:underline cursor-pointer">
                      差替
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) uploadStageImage(day.id, file)
                        }}
                      />
                    </label>
                    <button
                      onClick={() => removeStageImage(day.id)}
                      className="text-red-400 text-xs hover:underline"
                    >
                      リセット
                    </button>
                  </>
                ) : (
                  <label className="text-[var(--text-secondary)] text-xs hover:text-[var(--accent)] cursor-pointer">
                    {uploadingStage === day.id ? '📤 アップロード中...' : '🖼️ ステージ画像を設定'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingStage === day.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadStageImage(day.id, file)
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="flex justify-between items-center mt-3">
                <span className="text-[var(--text-secondary)] text-xs">
                  タスク: {day.tasks.length}個
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedDay(day)
                  }}
                  className="text-[var(--accent)] text-xs hover:underline"
                >
                  タスクを編集 →
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* タスク編集モーダル */}
        {selectedDay && (
          <div className="modal-overlay" onClick={() => { setSelectedDay(null); setEditingTask(null) }}>
            <div
              className="modal-content max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[var(--accent)] text-sm font-semibold">
                    Day {selectedDay.day_number}
                  </p>
                  <h2 className="text-xl font-bold">{selectedDay.title}</h2>
                </div>
                <button
                  onClick={() => { setSelectedDay(null); setEditingTask(null) }}
                  className="text-[var(--text-secondary)] text-2xl hover:text-white"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3 mb-4">
                {selectedDay.tasks.map((task, i) => (
                  <div key={task.id} className="task-item flex-col">
                    <div className="flex items-center gap-3 w-full">
                      <span className="text-[var(--text-secondary)] text-sm w-6">{i + 1}.</span>
                      <input
                        type="text"
                        defaultValue={task.title}
                        onBlur={(e) => updateTask(task.id, 'title', e.target.value)}
                        className="input-field py-1 px-2 text-sm flex-1"
                        placeholder="タスク名..."
                      />
                      <button
                        onClick={() =>
                          setEditingTask(editingTask?.id === task.id ? null : task)
                        }
                        className="text-[var(--accent)] text-xs hover:underline flex-shrink-0"
                      >
                        {editingTask?.id === task.id ? '閉じる' : '詳細'}
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-red-400 text-xs hover:underline flex-shrink-0"
                      >
                        削除
                      </button>
                    </div>
                    {editingTask?.id === task.id && (
                      <div className="w-full mt-2 pl-9">
                        <RichTextEditor
                          content={task.description || ''}
                          onChange={(html) => updateTask(task.id, 'description', html)}
                          placeholder="タスクの詳細説明を入力...（画像・表・リンクも挿入できます）"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => addTask(selectedDay.id)}
                className="btn-secondary w-full text-sm"
              >
                ＋ タスクを追加
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
