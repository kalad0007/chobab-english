export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type UserRole = 'teacher' | 'student'
export type QuestionType = 'multiple_choice' | 'short_answer' | 'essay'
export type QuestionCategory = 'grammar' | 'vocabulary' | 'reading' | 'writing' | 'cloze' | 'ordering'
export type QuestionSource = 'teacher' | 'ai_generated' | 'ksat'
export type ExamStatus = 'draft' | 'published' | 'closed'
export type SubmissionStatus = 'in_progress' | 'submitted' | 'graded'

export interface Profile {
  id: string
  email: string
  name: string
  role: UserRole
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Class {
  id: string
  teacher_id: string
  name: string
  grade: number | null
  invite_code: string
  description: string | null
  created_at: string
}

export interface ClassMember {
  id: string
  class_id: string
  student_id: string
  joined_at: string
}

export interface Question {
  id: string
  teacher_id: string
  type: QuestionType
  content: string
  passage: string | null
  options: { num: number; text: string }[] | null
  answer: string
  explanation: string | null
  category: QuestionCategory
  subcategory: string | null
  difficulty: number
  source: QuestionSource
  attempt_count: number
  correct_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Exam {
  id: string
  teacher_id: string
  class_id: string | null
  title: string
  description: string | null
  time_limit: number | null
  start_at: string | null
  end_at: string | null
  status: ExamStatus
  show_result_immediately: boolean
  total_points: number
  created_at: string
  updated_at: string
}

export interface ExamQuestion {
  id: string
  exam_id: string
  question_id: string
  order_num: number
  points: number
}

export interface Submission {
  id: string
  exam_id: string
  student_id: string
  score: number | null
  total_points: number | null
  percentage: number | null
  started_at: string
  submitted_at: string | null
  status: SubmissionStatus
}

export interface SubmissionAnswer {
  id: string
  submission_id: string
  question_id: string
  student_answer: string | null
  is_correct: boolean | null
  score: number
  teacher_feedback: string | null
}

export interface WrongAnswerQueue {
  id: string
  student_id: string
  original_question_id: string
  generated_question_id: string | null
  retry_count: number
  next_review_at: string
  mastered: boolean
  last_attempt_at: string | null
  created_at: string
}

export interface StudentSkillStats {
  id: string
  student_id: string
  category: QuestionCategory
  total_count: number
  correct_count: number
  accuracy: number
  updated_at: string
}

export interface StudentGamification {
  id: string
  student_id: string
  xp: number
  level: number
  streak_days: number
  last_activity_date: string | null
  total_questions_solved: number
  total_correct: number
  updated_at: string
}

export interface LearningContent {
  id: string
  teacher_id: string
  class_id: string | null
  title: string
  content: string
  category: string | null
  is_published: boolean
  created_at: string
  updated_at: string
}

// Supabase DB 타입 (자동 생성 대신 수동 정의)
type TableDef<T> = { Row: T; Insert: Partial<T>; Update: Partial<T> }

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<Profile>
      classes: TableDef<Class>
      class_members: TableDef<ClassMember>
      questions: TableDef<Question>
      exams: TableDef<Exam>
      exam_questions: TableDef<ExamQuestion>
      submissions: TableDef<Submission>
      submission_answers: TableDef<SubmissionAnswer>
      wrong_answer_queue: TableDef<WrongAnswerQueue>
      student_skill_stats: TableDef<StudentSkillStats>
      student_gamification: TableDef<StudentGamification>
      learning_contents: TableDef<LearningContent>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
