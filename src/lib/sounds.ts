'use client'

class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map()
  private bgm: HTMLAudioElement | null = null
  private _muted: boolean = false
  private _volume: number = 0.5
  private initialized: boolean = false

  constructor() {
    if (typeof window !== 'undefined') {
      this._muted = localStorage.getItem('sound_muted') === 'true'
      const savedVolume = localStorage.getItem('sound_volume')
      if (savedVolume) this._volume = parseFloat(savedVolume)
      this.initialized = true
    }
  }

  get muted() { return this._muted }
  get volume() { return this._volume }

  setMuted(muted: boolean) {
    this._muted = muted
    if (typeof window !== 'undefined') {
      localStorage.setItem('sound_muted', String(muted))
    }
    if (this.bgm) {
      this.bgm.muted = muted
    }
  }

  setVolume(volume: number) {
    this._volume = Math.max(0, Math.min(1, volume))
    if (typeof window !== 'undefined') {
      localStorage.setItem('sound_volume', String(this._volume))
    }
    if (this.bgm) {
      this.bgm.volume = this._volume * 0.3 // BGMは控えめ
    }
  }

  toggleMute() {
    this.setMuted(!this._muted)
    return this._muted
  }

  private getOrCreateAudio(path: string): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null

    if (this.sounds.has(path)) {
      return this.sounds.get(path)!
    }

    const audio = new Audio(path)
    audio.volume = this._volume

    // エラー時はスキップ（ファイルが存在しない場合）
    audio.addEventListener('error', () => {
      // 音源ファイルがない場合は静かにスキップ
    })

    this.sounds.set(path, audio)
    return audio
  }

  play(name: 'task-complete' | 'stage-clear' | 'quest-complete' | 'click') {
    if (this._muted || typeof window === 'undefined') return

    const path = `/sounds/${name}.mp3`
    const audio = this.getOrCreateAudio(path)
    if (audio) {
      audio.currentTime = 0
      audio.volume = this._volume
      audio.play().catch(() => {
        // autoplay制限時はスキップ
      })
    }
  }

  playBGM() {
    if (typeof window === 'undefined') return

    if (!this.bgm) {
      this.bgm = new Audio('/sounds/bgm.mp3')
      this.bgm.loop = true
      this.bgm.volume = this._volume * 0.3
      this.bgm.muted = this._muted
      this.bgm.addEventListener('error', () => {
        // BGMファイルがない場合はスキップ
      })
    }

    this.bgm.play().catch(() => {
      // autoplay制限時はスキップ
    })
  }

  stopBGM() {
    if (this.bgm) {
      this.bgm.pause()
      this.bgm.currentTime = 0
    }
  }
}

// シングルトン
let soundManager: SoundManager | null = null

export function getSoundManager(): SoundManager {
  if (!soundManager) {
    soundManager = new SoundManager()
  }
  return soundManager
}
