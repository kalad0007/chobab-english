export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type UserRole = 'teacher' | 'student'
export type QuestionType = 'multiple_choice' | 'short_answer' | 'essay'
export type QuestionCategory = 'reading' | 'listening' | 'speaking' | 'writing'
export type ToeflSection = 'reading' | 'listening' | 'speaking' | 'writing'
export type QuestionSource = 'teacher' | 'ai_generated' | 'toefl_official'
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
  target_band: number | null  // 기본 목표 Band (DB difficulty 1-5)
  created_at: string
}

export interface ClassMember {
  id: string
  class_id: string
  student_id: string
  joined_at: string
}

// TOEFL 문제 세부 유형
export type ReadingSubtype = 'factual' | 'negative_factual' | 'inference' | 'rhetorical_purpose' | 'vocabulary' | 'reference' | 'sentence_simplification' | 'insert_text' | 'prose_summary' | 'fill_table'
export type ListeningSubtype = 'gist_content' | 'gist_purpose' | 'detail' | 'function' | 'attitude' | 'organization' | 'connecting_content' | 'inference'
export type SpeakingSubtype = 'independent' | 'integrated_read_listen' | 'integrated_read_listen_academic' | 'integrated_listen'
export type WritingSubtype = 'integrated_writing' | 'academic_discussion'

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
  // 리스닝/스피킹 필드
  audio_url: string | null
  audio_script: string | null
  audio_play_limit: number | null
  speaking_prompt: string | null
  // TOEFL 전용 필드
  question_subtype: string | null
  preparation_time: number | null   // Speaking 준비시간(초)
  response_time: number | null      // Speaking 응답시간(초)
  word_limit: number | null         // Writing 최소 단어수
  task_number: number | null        // Speaking Task 1-4, Writing Task 1-2
  // 스마트 테스트 빌더용
  passage_id: string | null         // 같은 지문 문제 그룹핑 (Reading)
  audio_id: string | null           // 같은 오디오 문제 그룹핑 (Listening)
  passage_group_id: string | null   // 지문 세트 그룹 ID
  // 검색/분류용
  summary: string | null            // 지문/음성 내용 요약 (교사 검색용)
  // subcategory = topic (환경, IT, 경제 등 주제 키워드)
  // 시간 제한
  time_limit: number | null         // 문제당 제한시간(초)
  // 핵심단어 영역
  vocab_words: { word: string; pos?: string; def: string; example?: string }[] | null
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
  exam_type: 'full_test' | 'section_test' | 'practice'
  sections: ToeflSection[] | null
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
