// Rule-based resume parsing: contact details, skills, sections and the academic
// claims a resume makes (which we later check against the college's record).

import type { Academics, Opening, ResumeProfile, SkillCategory } from '@/lib/types'

const SKILLS: Record<SkillCategory, string[]> = {
  languages: ['python', 'java', 'javascript', 'typescript', 'go', 'golang', 'rust', 'c\\+\\+', 'c#', 'scala', 'kotlin', 'sql', 'php', 'ruby'],
  ai: ['llm', 'rag', 'langchain', 'langgraph', 'llamaindex', 'google adk', 'mcp', 'openai', 'gemini', 'claude', 'hugging\\s*face', 'transformers?', 'bert', 'embeddings?', 'vector\\s*(db|database|search)', 'pgvector', 'faiss', 'chromadb', 'pinecone', 'ai agents?', 'multi-agent', 'agentic', 'fine-tun\\w*', 'evals?', 'nlp', 'pytorch', 'tensorflow', 'deep learning'],
  data: ['pandas', 'numpy', 'scikit-learn', 'xgboost', 'lightgbm', 'statsmodels', 'pymc', 'spark', 'pyspark', 'databricks', 'airflow', 'mlflow', 'power bi', 'tableau', 'statistics', 'hypothesis testing', 'a/b test\\w*', 'time series', 'causal inference', 'bigquery'],
  backend: ['node\\.js', 'express', 'fastapi', 'django', 'flask', 'spring boot', 'grpc', 'rest(ful)? apis?', 'kafka', 'redis', 'postgresql', 'postgres', 'mysql', 'mongodb', 'cassandra', 'microservices', 'distributed systems', 'raft'],
  frontend: ['react', 'next\\.js', 'vue', 'angular', 'tailwind', 'html', 'css', 'redux'],
  infra: ['docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform', 'linux', 'ci/cd', 'github actions', 'jenkins', 'prometheus', 'grafana', 'vercel'],
  tools: ['git', 'n8n', 'postman', 'jest', 'pytest', 'streamlit', 'jupyter', 'langfuse']
}

const SECTIONS: Array<[keyof Pick<ResumeProfile, 'education' | 'experience' | 'projects'> | 'other', RegExp]> = [
  ['education', /^(education|academics?|academic (background|qualifications?|details))\b/i],
  ['experience', /^((work|professional|internship) experience|experience|employment|internships?|research experience)\b/i],
  ['projects', /^((technical|personal|academic|key) )?projects\b/i],
  ['other', /^(skills|technical skills|skills summary|achievements|certifications?|activities|extra[- ]?curricular|objective|career objective|(profile )?summary|about me|positions? of responsibility|languages|interests|hobbies)\b/i]
]

// Canonical branch names. Patterns tolerate "&"/"and", abbreviations and common typos ("Artifcial").
const AI = String.raw`artifi?ci?al\s+intelligence`
const BRANCHES: Array<[string, RegExp]> = [
  ['Artificial Intelligence and Machine Learning', new RegExp(String.raw`${AI}\s*(&|and)\s*machine\s+learning|\bai\s*(&|and|\/)?\s*ml\b|\baiml\b`, 'i')],
  ['Artificial Intelligence and Data Science', new RegExp(String.raw`${AI}\s*(&|and)\s*data\s+science|\bai\s*(&|and|\/)\s*ds\b|\baids\b`, 'i')],
  ['Computer Science (Data Science)', /computer (science|engineering)\s*\(?\s*(\(|-|with|in)?\s*data science/i],
  ['Data Science', /\bdata science\b/i],
  ['Artificial Intelligence', new RegExp(AI, 'i')],
  ['Mathematics and Computing', /mathematics\s*(&|and)\s*computing/i],
  ['Computer Science and Engineering', /computer (science|engineering)|\bcse\b|\bcomps?\b/i],
  ['Information Technology', /information technology|\bb\.?\s?tech\.?\s*(\(|in\s+)?it\b/i],
  ['Electronics and Telecommunication', /electronics\s*(&|and)\s*tele\s*-?\s*communication|\bextc\b/i],
  ['Electronics and Communication Engineering', /electronics\s*(&|and)\s*communication|\bece\b/i],
  ['Electrical and Electronics Engineering', /electrical\s*(&|and)\s*electronics|\beee\b/i],
  ['Electronics Engineering', /electronics engineering/i],
  ['Mechanical Engineering', /mechanical engineering|\bmech\b/i],
  ['Civil Engineering', /civil engineering/i],
  ['Chemical Engineering', /chemical engineering/i]
]

export function parseResume(rawText: string, fileName: string): ResumeProfile {
  const text = rawText.replace(/\r\n?/g, '\n')
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const sections = splitSections(lines)

  return {
    name: findName(lines) ?? nameFromFile(fileName),
    email: text.match(/[\w.%+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0],
    phone: findPhone(text),
    usn: text.match(/\b[A-Z]{3,5}\d{2}[A-Z]{2}\d{3}\b/)?.[0],
    links: {
      github: text.match(/github\.com\/[\w-]+/i)?.[0],
      linkedin: text.match(/linkedin\.com\/in\/[\w-]+/i)?.[0],
      website: text.match(/\b(?!github|linkedin|kaggle)[\w-]+\.(dev|blog|me|io)\b/i)?.[0]
    },
    skills: findSkills(text),
    ...sections,
    declared: findAcademics(text, sections.education),
    text: text.slice(0, 8000)
  }
}

// Words that open a resume but are never a person's name.
const NOT_A_NAME = /\b(resume|curriculum|vitae|cv|summary|profile|objective|education|skills|experience|contact|phone|mobile|email|address|journal|portfolio|technical|projects?|intern(ship)?|analyst|engineer|developer|designer|manager|student)\b/i

/**
 * The name is usually the first short line of 1-4 capitalised words. PDF text sometimes glues
 * contact details onto it ("Utsav Mehta+91-...", "Riya Sadrani Email: ..."), so those are cut off first.
 */
function findName(lines: string[]) {
  for (const raw of lines.slice(0, 8)) {
    const line = raw.split(/[|•@+:]|\d|\s{3,}|\b(?:email|e-mail|mobile|phone|linkedin|github)\b/i)[0].trim()
    const words = line.split(/\s+/)
    if (
      words.length <= 4 &&
      line.length >= 3 &&
      /^[\p{L} .'-]+$/u.test(line) &&
      words.every((w) => /^\p{Lu}/u.test(w)) &&
      !NOT_A_NAME.test(line)
    ) {
      return toDisplayCase(line)
    }
  }
  return undefined
}

/** "NAMAN SAPRA" -> "Naman Sapra"; mixed-case names are left as written. */
export function toDisplayCase(name: string) {
  return name === name.toUpperCase() ? name.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase()) : name
}

function nameFromFile(fileName: string) {
  // Shared-drive downloads look like "Resume1 - Pradnesh Sawatkhedkar.pdf": prefer the part after " - ".
  const base = fileName.replace(/\.pdf$/i, '')
  const owner = base.includes(' - ') ? base.split(' - ').pop()! : base
  return owner
    .replace(/[-_]+/g, ' ')
    .replace(/\b(resume|cv|new|final)\b|\d+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function findPhone(text: string) {
  const match = text.match(/(?:\+?91[-\s]?)?[6-9]\d{4}[-\s]?\d{5}\b/)
  return match ? normalisePhone(match[0]) : undefined
}

export function normalisePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

function findSkills(text: string) {
  const found = {} as Record<SkillCategory, string[]>
  for (const [category, patterns] of Object.entries(SKILLS) as [SkillCategory, string[]][]) {
    found[category] = patterns
      .map((p) => text.match(new RegExp(`(?<![\\w])${p}(?![\\w])`, 'i'))?.[0])
      .filter((m): m is string => Boolean(m))
  }
  return found
}

function splitSections(lines: string[]) {
  const buckets: Record<string, string[]> = { education: [], experience: [], projects: [], other: [] }
  let current = 'other'
  for (const line of lines) {
    const heading = SECTIONS.find(([, re]) => re.test(line) && line.length < 40)
    if (heading) current = heading[0]
    else buckets[current].push(line)
  }
  return {
    education: buckets.education.slice(0, 20),
    experience: buckets.experience.slice(0, 30),
    projects: buckets.projects.slice(0, 25)
  }
}

// "B.E." / "BE" only as written abbreviations (case-sensitive), so the word "be" never matches;
// "master" only as a degree ("Master of…"), never "mastered".
const DEGREE_WORDS = /\b(b\.?\s?tech|bachelor|b\.?\s?sc|bca|b\.?\s?com|bba|m\.?\s?tech|m\.?\s?sc|mca|mba|masters?\s+(of|in|degree))\b/i
const DEGREE_BE = /\bB\.\s?E\.?(?=\s|$|,)|\bBE\b/
const DEGREE = { test: (line: string) => DEGREE_WORDS.test(line) || DEGREE_BE.test(line) }
const ONGOING = /present|current|ongoing|now|till date|pursuing|\*/i

/**
 * Rule-based academics, used when the LLM extraction is unavailable. Looks at the education
 * section (or the whole text if none was found) and ignores Class X entirely.
 */
function findAcademics(text: string, education: string[]): Academics {
  const scope = (education.length ? education.join('\n') : text).replace(/\s+/g, ' ')
  const cgpa = scope.match(/(?:c\.?g\.?p\.?a|cgpi|\bcpi\b|\bgpa\b|pointer)[^\d\n]{0,25}(\d{1,2}(?:\.\d{1,2})?)/i)?.[1]
  // "HSC 81.50%", or without the sign when labelled: "HSC Percentage: 80.33".
  const XII = /(?:hsc|class\s*xii|\bxii\b|12th|higher secondary|junior college|\bpuc\b|\bisc\b|intermediate)/.source
  const xii =
    scope.match(new RegExp(`${XII}[^%]{0,80}?(\\d{2}(?:\\.\\d+)?)\\s*%`, 'i'))?.[1] ??
    scope.match(new RegExp(`${XII}[^\\n]{0,60}?(?:percentage|marks|score|aggregate)\\s*[:\\-–]?\\s*(\\d{2}(?:\\.\\d+)?)(?!\\d)`, 'i'))?.[1]
  const diploma = scope.match(/diploma[^%]{0,80}?(\d{2}(?:\.\d+)?)\s*%/i)?.[1]
  const backlogs = text.match(/(\d+)\s+(?:active\s+)?(?:backlogs?|kts?)\b/i)?.[1]

  return {
    cgpa: cgpa && Number(cgpa) > 0 && Number(cgpa) <= 10 ? Number(cgpa) : undefined,
    classXII: xii ? Number(xii) : undefined,
    diplomaPct: diploma ? Number(diploma) : undefined,
    branch: BRANCHES.find(([, re]) => re.test(scope))?.[0] ?? BRANCHES.find(([, re]) => re.test(text))?.[0],
    batch: graduationYear(text, education),
    activeBacklogs: backlogs ? Number(backlogs) : undefined
  }
}

/**
 * The end year of the degree, from the lines around it: "2022 - 2026", "Nov 2022 - May 2026",
 * "B.Tech in AIML - 2026". An ongoing degree ("2022 - Present") is the start year plus its usual
 * length. Internship and school dates are never used.
 */
function graduationYear(text: string, education: string[]): number | undefined {
  const lines = education.length ? education : text.split('\n')
  const now = new Date().getFullYear()
  const plausible = (y: number) => y >= 2000 && y <= now + 6
  const degreeAt = lines.findIndex((l) => DEGREE.test(l))
  if (degreeAt < 0) return undefined
  const degreeLine = lines[degreeAt]
  const length = /\b(m\.?\s?tech|m\.?\s?sc|mca|mba|master)/i.test(degreeLine) ? 2 : /\b(b\.?\s?sc|bca|b\.?\s?com|bba)\b/i.test(degreeLine) ? 3 : 4

  // Two-column templates put the dates a few lines away, often next to internship dates, so look
  // around the degree and keep only ranges shaped like a degree: ongoing, or 2+ years long.
  // The optional word before the end year must be a month ("Nov 2022 – May 2026"); a looser
  // pattern swallowed "Present" in "2022 – Present 2020 – 2021" and read it as 2022–2020.
  const RANGE = /(20\d{2})\s*(?:-|–|—|to)+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(20\d{2}|present|current|ongoing|now|till date|\*)/gi
  const degreeShaped = (block: string) =>
    [...block.matchAll(RANGE)]
      .map(([, from, to]) => {
        const start = Number(from)
        if (ONGOING.test(to)) return start + length
        const end = Number(to)
        return end - start >= 2 ? end : undefined
      })
      .filter((y): y is number => y !== undefined && plausible(y))

  const near = degreeShaped(lines.slice(Math.max(0, degreeAt - 2), degreeAt + 5).join(' '))
  if (near.length) return Math.max(...near)

  // "B.Tech in AIML – 2026" or "Expected 2026": a lone year on the degree line itself.
  const onLine = [...degreeLine.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1])).filter(plausible)
  if (onLine.length) return Math.max(...onLine)

  // Scrambled two-column text can put the degree's dates far from it. An ongoing range that
  // started earliest is the degree (school years are never ongoing; a current internship starts
  // later); failing that, the latest end of any range 2+ years long.
  const all = text.split('\n').join(' ')
  const ongoingStarts = [...all.matchAll(RANGE)].filter(([, , to]) => ONGOING.test(to)).map(([, from]) => Number(from))
  if (ongoingStarts.length && plausible(Math.min(...ongoingStarts) + length)) return Math.min(...ongoingStarts) + length
  const anywhere = degreeShaped(all)
  return anywhere.length ? Math.max(...anywhere) : undefined
}

/** What the resume says about notice period or joining date, if anything. */
export function availabilityOf(profile?: ResumeProfile): string | undefined {
  const line = profile?.text
    .split('\n')
    .find((l) => /notice period|immediate joiner|join(ing)? immediately|available to join/i.test(l))
  return line?.trim().replace(/^notice period:\s*/i, '').slice(0, 60)
}

/** The first line under Experience, usually "Title  Dates". */
export function latestRole(profile?: ResumeProfile): string | undefined {
  return profile?.experience[0]?.replace(/\s+(\w{3}\s+)?20\d{2}\s*[–-].*$/, '').trim() || undefined
}

export function allSkills(profile?: ResumeProfile): string[] {
  if (!profile) return []
  return [...new Set(Object.values(profile.skills).flat().map((s) => s.toLowerCase()))]
}

/**
 * The `state` Jev evaluates: a named object holding the role and the resume as written.
 * We send the resume text itself rather than our regex-extracted skills, so Jev judges
 * the actual evidence. https://docs.typesafe.ai/concepts/state.md
 */
export function buildJevState(resumeText: string, opening: Pick<Opening, 'title' | 'company' | 'experience'>) {
  return {
    // Jev has no clock; without this, "Present" and years-of-experience checks are guesses.
    today: new Date().toISOString().slice(0, 10),
    role: { title: opening.title, company: opening.company, experience_level: opening.experience },
    resume: resumeText
  }
}
