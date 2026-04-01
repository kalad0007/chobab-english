export type WordLevel = 'elem_1_2' | 'elem_3_4' | 'elem_5_6' | 'middle' | 'toefl'

export const WORD_LEVEL_CONFIG: Record<WordLevel, {
  label: string
  color: string
  textColor: string
  difficulty: number
  cefr: string
}> = {
  elem_1_2: { label: '초1-2', color: 'bg-emerald-500', textColor: 'text-white', difficulty: 0.5, cefr: 'A1' },
  elem_3_4: { label: '초3-4', color: 'bg-emerald-500', textColor: 'text-white', difficulty: 1.0, cefr: 'A1-A2' },
  elem_5_6: { label: '초5-6', color: 'bg-emerald-500', textColor: 'text-white', difficulty: 1.5, cefr: 'A2' },
  middle:   { label: '중학교', color: 'bg-amber-500',   textColor: 'text-white', difficulty: 2.0, cefr: 'B1' },
  toefl:    { label: 'TOEFL', color: 'bg-blue-600',    textColor: 'text-white', difficulty: 3.0, cefr: 'B2-C1' },
}

export const ELEM_TOPICS: { value: string; label: string; emoji: string }[] = [
  { value: 'daily_life', label: '일상생활', emoji: '🏠' },
  { value: 'food',       label: '음식',     emoji: '🍎' },
  { value: 'animals',    label: '동물',     emoji: '🐶' },
  { value: 'nature',     label: '자연',     emoji: '🌳' },
  { value: 'school',     label: '학교',     emoji: '✏️' },
  { value: 'family',     label: '가족',     emoji: '👨‍👩‍👧' },
  { value: 'body',       label: '신체',     emoji: '🧍' },
  { value: 'colors',     label: '색깔/모양',emoji: '🎨' },
  { value: 'sports',     label: '스포츠',   emoji: '⚽' },
  { value: 'transport',  label: '교통',     emoji: '🚌' },
  { value: 'weather',    label: '날씨',     emoji: '☀️' },
  { value: 'numbers',    label: '숫자/시간',emoji: '🔢' },
  { value: 'feelings',   label: '감정',     emoji: '😊' },
  { value: 'hobbies',    label: '취미',     emoji: '🎮' },
  { value: 'general',    label: '일반',     emoji: '📝' },
]

export const MIDDLE_TOPICS: { value: string; label: string; emoji: string }[] = [
  { value: 'daily_life',  label: '일상생활', emoji: '🏠' },
  { value: 'feelings',    label: '감정/심리',emoji: '😊' },
  { value: 'society',     label: '사회/문화',emoji: '🌍' },
  { value: 'environment', label: '환경',     emoji: '🌿' },
  { value: 'technology',  label: '기술',     emoji: '💻' },
  { value: 'health',      label: '건강',     emoji: '🏥' },
  { value: 'sports',      label: '스포츠',   emoji: '⚽' },
  { value: 'media',       label: '미디어',   emoji: '📱' },
  { value: 'travel',      label: '여행',     emoji: '✈️' },
  { value: 'school',      label: '학교/교육',emoji: '📚' },
  { value: 'general',     label: '일반',     emoji: '📝' },
]

export const TOEFL_TOPICS: { value: string; label: string; emoji: string }[] = [
  { value: 'biology',       label: '생물학',    emoji: '🧬' },
  { value: 'chemistry',     label: '화학',      emoji: '⚗️' },
  { value: 'physics',       label: '물리학',    emoji: '⚛️' },
  { value: 'astronomy',     label: '천문학',    emoji: '🔭' },
  { value: 'geology',       label: '지질학',    emoji: '🪨' },
  { value: 'ecology',       label: '생태학',    emoji: '🌿' },
  { value: 'history_us',    label: '미국사',    emoji: '🗽' },
  { value: 'history_world', label: '세계사',    emoji: '🌍' },
  { value: 'anthropology',  label: '인류학',    emoji: '🏺' },
  { value: 'psychology',    label: '심리학',    emoji: '🧠' },
  { value: 'sociology',     label: '사회학',    emoji: '👥' },
  { value: 'economics',     label: '경제학',    emoji: '📊' },
  { value: 'art_music',     label: '예술/음악', emoji: '🎨' },
  { value: 'literature',    label: '문학',      emoji: '📚' },
  { value: 'architecture',  label: '건축학',    emoji: '🏛️' },
  { value: 'environmental', label: '환경과학',  emoji: '🌊' },
  { value: 'linguistics',        label: '언어학',    emoji: '🗣️' },
  { value: 'philosophy',         label: '철학',      emoji: '🧭' },
  { value: 'political_science',  label: '정치학',    emoji: '🏛️' },
  { value: 'medicine',           label: '의학',      emoji: '🏥' },
  { value: 'technology',         label: '기술/공학', emoji: '⚙️' },
  { value: 'general',            label: '일반',      emoji: '📝' },
]

export function getTopicsForLevel(level: WordLevel) {
  if (level === 'toefl') return TOEFL_TOPICS
  if (level === 'middle') return MIDDLE_TOPICS
  return ELEM_TOPICS
}
