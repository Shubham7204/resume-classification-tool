// Kestrel Capital's sample roles, matching samples/*/job-descriptions. Rubrics are hand-reviewed
// versions of what the rubric agent drafts, so the demo is repeatable.

import { DEPTH_LEVELS, sanitiseRubric } from '@/lib/jev'
import type { Opening } from '@/lib/types'

type DemoOpening = Omit<Opening, 'id' | 'createdAt'>

const COMPANY = 'Kestrel Capital'
const CAMPUS = 'Freshers (2027 batch)'

const BUSINESS_ANALYST: DemoOpening = {
  reqId: 'KC-CAMP-27-BA',
  title: 'Business Analyst, Graduate Trainee',
  company: COMPANY,
  source: 'campus',
  location: 'Mumbai',
  experience: CAMPUS,
  ctc: '10 LPA',
  summary: 'Non-tech role: turn client and product questions into analysis, process changes and clear recommendations.',
  description: `Join the Strategy & Operations team. Start with a 6-month internship (Jan–Jun 2027, INR 40,000/month) and convert to full-time on graduation. This is a non-technical role open to all branches.

What you will do
- Break down business problems (onboarding drop-offs, support costs, partner performance) and recommend what to do.
- Pull and analyse data in Excel and SQL; build simple dashboards for weekly reviews.
- Map processes with operations teams and write clear requirement documents for product and engineering.
- Present findings to managers and senior leaders.

What we are looking for
- Structured problem solving: case competitions, consulting club work or analytical internships.
- Strong written and spoken communication; comfortable presenting.
- Working knowledge of Excel; SQL or a BI tool is a plus.
- Interest in financial markets or fintech.

Eligibility: 2027 batch; all branches; CGPA ≥ 6.5; no active backlogs.`,
  rules: { batch: 2027, minCgpa: 6.5, maxActiveBacklogs: 0 },
  rubric: sanitiseRubric([
    { type: 'score', label: 'Structured problem solving', weight: 5, mustHave: true, question: 'Rate the evidence of structured business problem solving: case competitions, consulting projects, or analytical internships with clear recommendations.', levels: ['No evidence.', 'Participated in a case competition or club, no outcome stated.', 'Solved a real business problem in an internship or project, or placed in a case competition.', 'Repeated wins or recommendations that were adopted with measurable impact.'] },
    { type: 'score', label: 'Communication & presenting', weight: 4, question: 'Rate the evidence of strong communication: presenting to stakeholders, writing reports, debating, or leading public-facing activities.', levels: ['No evidence.', 'Mentions communication skills only.', 'Presented work, wrote reports, or led events or teams.', 'Presented to senior leaders or clients, won debates or public-speaking awards.'] },
    { type: 'noul', label: 'Excel / SQL / BI', weight: 3, question: 'Does the resume show hands-on data analysis with Excel, SQL, Power BI or Tableau?' },
    { type: 'noul', label: 'Business internship', weight: 3, question: 'Does the candidate have an internship in operations, strategy, consulting, finance or business analysis?' },
    { type: 'noul', label: 'Interest in finance', weight: 2, question: 'Does the resume show interest in finance, investing or fintech (courses, clubs, certifications, projects)?' },
    { type: 'noul', label: 'Leadership', weight: 2, question: 'Does the resume show leading a team, club or event?' }
  ]),
  status: 'open'
}

const SAMPLE_ROLES: DemoOpening[] = [
  {
    reqId: 'KC-CAMP-27-DS',
    title: 'Data Scientist, Graduate Trainee',
    company: COMPANY,
    source: 'campus',
    location: 'Bengaluru',
    experience: CAMPUS,
    ctc: '14 LPA',
    summary: 'Models behind fraud alerts, margin eligibility, churn and fund recommendations.',
    description: `Join the Client Intelligence team. Start with a 6-month internship (Jan–Jun 2027, INR 50,000/month) and convert to full-time on graduation.

What you will do
- Frame business questions with product managers and turn them into analyses or models.
- Clean and join large datasets (orders, KYC, app events) in SQL and Python.
- Build, validate and explain classification and forecasting models.
- Design and read A/B tests; report confidence intervals, not just point estimates.

What we are looking for
- Strong probability, statistics and linear algebra.
- Hands-on Python (pandas, scikit-learn) and SQL with joins and window functions.
- At least one end-to-end data project with a clear problem, method and result.
- Good to have: XGBoost/LightGBM, time series, causal inference, Spark, Kaggle or research.

Eligibility: 2027 batch; CSE, IT, AI & DS, AI & ML, Mathematics & Computing, ECE; CGPA ≥ 7.0; Class X and XII ≥ 70%; no active backlogs.`,
    rules: { batch: 2027, minCgpa: 7.0, minSchoolPct: 70, maxActiveBacklogs: 0, branches: ['CSE', 'IT', 'AI & DS', 'AI & ML', 'Mathematics & Computing', 'ECE'] },
    rubric: sanitiseRubric([
      { type: 'score', label: 'Statistical modelling', weight: 5, mustHave: true, question: "Rate the candidate's depth in statistics and predictive modelling (regression, classification, time series, model validation).", levels: ['No modelling evidence.', 'Coursework or tutorial-level models.', 'Validated models on real data in a project or internship.', 'Research, rigorous validation, or competition medals.'] },
      { type: 'score', label: 'End-to-end data project', weight: 4, question: 'Rate the strongest end-to-end data project: problem framing, data cleaning, modelling and a measurable result.', levels: ['No real data project.', 'Exploratory analysis only.', 'One complete project with a measurable result.', 'Several projects with business impact or production use.'] },
      { type: 'noul', label: 'Python data stack', weight: 4, mustHave: true, question: 'Does the resume show hands-on Python data work with pandas, NumPy or scikit-learn?' },
      { type: 'noul', label: 'SQL', weight: 3, question: 'Does the resume show the candidate writing SQL against real data?' },
      { type: 'noul', label: 'Experimentation', weight: 2, question: 'Does the resume show A/B testing, causal inference or experimental design?' },
      { type: 'noul', label: 'Explains models', weight: 2, question: 'Does the resume show explaining models or results to others, e.g. SHAP, reports or presentations to stakeholders?' }
    ]),
    status: 'open'
  },
  {
    reqId: 'KC-CAMP-27-AI',
    title: 'AI Engineer, Agentic Systems',
    company: COMPANY,
    source: 'campus',
    location: 'Bengaluru',
    experience: CAMPUS,
    ctc: '16 LPA',
    summary: 'Agents for client support, plain-English data questions, and MCP-connected internal tools.',
    description: `Join the Applied AI team. Start with a 6-month internship (Jan–Jun 2027, INR 60,000/month) and convert to full-time on graduation.

Problems you will work on
- Multi-agent systems that understand a client's question, look up orders through internal tools, act, and hand off to a human when needed.
- Agents that turn plain-English questions into SQL, charts and decisions.
- MCP servers that connect agents to internal systems with scoped permissions.
- Eval sets and regression tests so we know an agent got better, not just different.

You might be a fit if you
- Love building with Python and have used LLM APIs seriously.
- Have a project you are proud of: GitHub, demo or deployed link.
- Understand RAG, embeddings and tool calling, and where they fail.
- Bonus: FastAPI, SQL, LangGraph, Google ADK, MCP, n8n, AWS, Next.js.

Eligibility: 2027 batch; all branches; CGPA ≥ 7.0; no active backlogs.`,
    rules: { batch: 2027, minCgpa: 7.0, maxActiveBacklogs: 0 },
    rubric: sanitiseRubric([
      { type: 'score', label: 'Agent & LLM systems', weight: 5, mustHave: true, question: "Rate the candidate's hands-on depth building LLM applications or agents (tool calling, multi-agent orchestration, MCP).", levels: ['No LLM or agent work.', 'Simple API calls or a tutorial chatbot.', 'Real agent or LLM projects, or an internship building them.', 'Production agents, open-source tools, or notable wins.'] },
      { type: 'score', label: 'Software engineering', weight: 4, question: "Rate the candidate's general software engineering: building APIs, deploying services, testing.", levels: DEPTH_LEVELS },
      { type: 'noul', label: 'Retrieval / RAG', weight: 3, question: 'Does the resume show hands-on retrieval-augmented generation, embeddings or vector search?' },
      { type: 'noul', label: 'LLM evaluation', weight: 3, question: 'Does the resume show evaluating LLM or agent quality, such as eval sets, regression tests or tracing?' },
      { type: 'noul', label: 'Shipped project link', weight: 3, question: 'Does the resume link to a deployed project, demo or public repository the candidate built?' },
      { type: 'noul', label: 'Python', weight: 2, question: 'Does the resume show substantial hands-on Python?' }
    ]),
    status: 'open'
  },
  {
    reqId: 'KC-CAR-26-SDE2',
    title: 'Software Development Engineer 2, Backend',
    company: COMPANY,
    source: 'careers',
    location: 'Bengaluru',
    experience: '3–5 years',
    ctc: '35–45 LPA',
    summary: 'Own the hairiest paths in order and ledger services; design APIs and mentor engineers.',
    description: `What you will do
- Hands-on coding: own the most complicated paths and components.
- Contribute to the design and architecture of components across products.
- Craft APIs, RPCs and streaming topologies that are simple and efficient.
- Ensure engineering excellence and mentor engineers in the team.

Who you are
- Degree in computer science with 3–5 years building large, scalable systems.
- Excellent data structures and algorithms; hands-on Java, Python or Go for backend.
- Good understanding of distributed systems design.
- Low-latency, high-throughput system design (HLD and LLD).
- Familiar with twelve-factor app practices and metrics-driven engineering.`,
    rules: {},
    rubric: sanitiseRubric([
      { type: 'score', label: 'Distributed systems at scale', weight: 5, mustHave: true, question: "Rate the candidate's professional experience designing and running distributed backend systems at scale.", levels: ['None.', 'Worked on services but no evidence of scale or design ownership.', 'Built and operated high-throughput services with measurable scale.', 'Led architecture of large-scale, low-latency systems.'] },
      { type: 'noul', label: '3+ years backend', weight: 4, mustHave: true, question: 'Does the candidate have at least three years of full-time backend engineering experience?', yes: 'Full-time backend roles adding up to 36 months or more.', no: 'Less than three years, or mostly non-backend work.' },
      { type: 'noul', label: 'Java / Go / Python', weight: 3, question: 'Does the resume show production backend work in Java, Go or Python?' },
      { type: 'noul', label: 'Low-latency work', weight: 3, question: 'Does the resume show work on low-latency or high-throughput paths with numbers (latency, RPS, throughput)?' },
      { type: 'noul', label: 'Mentoring / design docs', weight: 2, question: 'Does the resume show mentoring engineers, leading designs or writing design documents?' }
    ]),
    status: 'open'
  },
  BUSINESS_ANALYST
]

/** Ready-made campus roles HR can copy into a drive and then edit for that college. */
export const CAMPUS_TEMPLATES = SAMPLE_ROLES.filter((o) => o.source === 'campus')

/** The sample careers-page role. */
export const CAREERS_SAMPLES = SAMPLE_ROLES.filter((o) => o.source === 'careers')
