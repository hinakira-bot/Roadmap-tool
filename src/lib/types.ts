export interface Database {
  public: {
    Tables: {
      roadmaps: {
        Row: Roadmap
        Insert: Omit<Roadmap, 'id' | 'created_at'>
        Update: Partial<Omit<Roadmap, 'id' | 'created_at'>>
      }
      roadmap_days: {
        Row: RoadmapDay
        Insert: Omit<RoadmapDay, 'id'>
        Update: Partial<Omit<RoadmapDay, 'id'>>
      }
      day_tasks: {
        Row: DayTask
        Insert: Omit<DayTask, 'id'>
        Update: Partial<Omit<DayTask, 'id'>>
      }
      user_progress: {
        Row: UserProgress
        Insert: Omit<UserProgress, 'id' | 'completed_at'>
        Update: Partial<Omit<UserProgress, 'id'>>
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Profile>
      }
    }
  }
}

export interface Roadmap {
  id: string
  title: string
  description: string
  total_days: number
  created_by: string
  created_at: string
  is_published: boolean
}

export interface RoadmapDay {
  id: string
  roadmap_id: string
  day_number: number
  title: string
  description: string
}

export interface DayTask {
  id: string
  day_id: string
  title: string
  description: string
  order_index: number
}

export interface UserProgress {
  id: string
  user_id: string
  roadmap_id: string
  task_id: string
  completed_at: string
}

export interface Profile {
  id: string
  email: string
  display_name: string
  is_admin: boolean
  created_at: string
}
