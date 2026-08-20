// Topic buckets per role domain, most specific first — the first match wins.
// Only the matching bucket is injected into the prompt. Sending all of them
// every time roughly tripled the prompt size for no benefit, and Groq's free
// tier is 8,000 tokens/minute, so the waste directly cost interview starts.
const ROLE_TOPICS = [
  {
    name: "AI / ML Engineer",
    match: /\b(ai|ml|machine learning|deep learning|gen\s?ai|llm|nlp|computer vision|mlops|artificial intelligence)\b/i,
    topics: [
      "Machine learning fundamentals (bias-variance, overfitting, regularisation)",
      "Model evaluation (precision/recall, ROC-AUC, cross-validation)",
      "Deep learning (backpropagation, CNNs, RNNs, transformers, attention)",
      "NLP and embeddings",
      "LLMs, prompting, RAG, fine-tuning, vector databases",
      "Feature engineering and data pipelines",
      "Deploying and monitoring models in production"
    ],
  },
  {
    name: "Data Engineer",
    match: /\b(data engineer|etl|big data|spark|airflow|data pipeline)\b/i,
    topics: [
      "ETL / ELT pipelines",
      "SQL and data modelling (star schema, normalisation)",
      "Spark, Airflow, Kafka",
      "Batch vs streaming",
      "Data warehousing and partitioning"
    ],
  },
  {
    name: "Data Analyst",
    match: /\b(data analyst|business intelligence|bi analyst|analytics)\b/i,
    topics: [
      "SQL (joins, group by, window functions)",
      "Excel / Google Sheets",
      "Power BI / Tableau dashboards",
      "Descriptive statistics",
      "Data cleaning and handling missing values",
      "Translating a business question into a metric"
    ],
  },
  {
    name: "Data Science",
    match: /\b(data scien\w*|scientist)\b/i,
    topics: [
      "ML",
      "Python",
      "Statistics",
      "Experiment design and A/B testing"
    ],
  },
  {
    name: "QA / SDET / Testing",
    match: /\b(qa|sdet|tester|testing|quality assurance|automation engineer)\b/i,
    topics: [
      "Test case design and boundary value analysis",
      "Manual vs automation trade-offs",
      "Selenium / Playwright / Appium",
      "API testing (Postman, REST assured)",
      "Regression vs smoke vs sanity",
      "Bug lifecycle, severity vs priority, STLC"
    ],
  },
  {
    name: "Cyber Security",
    match: /\b(cyber|security|infosec|soc analyst|penetration|pentest|vapt)\b/i,
    topics: [
      "OWASP Top 10",
      "Encryption vs hashing vs encoding",
      "SQL injection, XSS, CSRF",
      "Firewalls, IDS/IPS, VPN",
      "Authentication vs authorisation",
      "Incident response and vulnerability assessment"
    ],
  },
  {
    name: "Cloud Engineer",
    match: /\b(cloud|aws|azure|gcp|sre|site reliability)\b/i,
    topics: [
      "Core services (EC2/S3/IAM or Azure equivalents)",
      "VPC, subnets, security groups",
      "Load balancing and autoscaling",
      "High availability and disaster recovery",
      "Cost optimisation"
    ],
  },
  {
    name: "DevOps",
    match: /\b(devops|ci\/cd|kubernetes|docker|platform engineer)\b/i,
    topics: [
      "Docker",
      "Kubernetes",
      "AWS",
      "CI/CD"
    ],
  },
  {
    name: "Embedded / VLSI / Core Electronics",
    match: /\b(embedded|vlsi|firmware|iot|electronics|ece|verilog|rtos)\b/i,
    topics: [
      "Microcontrollers and interrupts",
      "RTOS concepts",
      "Communication protocols (I2C, SPI, UART, CAN)",
      "Verilog / VHDL basics",
      "Memory types and timing"
    ],
  },
  {
    name: "Database / SQL Developer",
    match: /\b(dba|database developer|sql developer|plsql|oracle developer)\b/i,
    topics: [
      "Normalisation and denormalisation",
      "Indexing and query optimisation",
      "Transactions and ACID",
      "Stored procedures and triggers",
      "Joins and subqueries"
    ],
  },
  {
    name: "Full Stack Developer",
    match: /\b(full.?stack|mern|mean)\b/i,
    topics: [
      "REST API design and contracts",
      "Authentication and sessions (JWT, cookies)",
      "Frontend state management",
      "Database modelling",
      "Deployment and environment configuration"
    ],
  },
  {
    name: "Java Developer",
    match: /\b(java|spring boot)\b/i,
    topics: [
      "OOP (inheritance, polymorphism, abstraction)",
      "Collections framework",
      "Multithreading and concurrency",
      "Exception handling",
      "Spring / Spring Boot",
      "JVM internals and garbage collection"
    ],
  },
  {
    name: "Mobile Developer",
    match: /\b(mobile|android|ios|flutter|react native|app developer)\b/i,
    topics: [
      "Android activity/fragment lifecycle",
      "Flutter widgets and state, or React Native bridge",
      "Navigation and routing",
      "Local storage and offline behaviour",
      "App performance and memory"
    ],
  },
  {
    name: "Frontend",
    match: /\b(front.?end|react|angular|vue|javascript|ui developer|web developer)\b/i,
    topics: [
      "React",
      "JavaScript",
      "HTML",
      "CSS",
      "Performance",
      "State Management"
    ],
  },
  {
    name: "Backend",
    match: /\b(back.?end|node|express|api developer|server side)\b/i,
    topics: [
      "Node.js",
      "Express",
      "MongoDB",
      "SQL",
      "API",
      "Authentication",
      "Redis",
      "System Design"
    ],
  },
  {
    name: "Business Analyst",
    match: /\b(business analyst|requirement|functional consultant)\b/i,
    topics: [
      "Requirement gathering and elicitation",
      "BRD / FRD / user stories",
      "Stakeholder management",
      "UML, flowcharts, process mapping",
      "SQL and reporting basics"
    ],
  },
  {
    name: "UI / UX Designer",
    match: /\b(ux|ui.?ux|designer|product design|interaction design)\b/i,
    topics: [
      "Design systems and component libraries",
      "Accessibility (WCAG, contrast, keyboard nav)",
      "Usability heuristics",
      "Wireframing vs prototyping",
      "User research and usability testing"
    ],
  },
  {
    name: "Product Manager",
    match: /\b(product manager|product owner)\b/i,
    topics: [
      "Prioritisation frameworks (RICE, MoSCoW)",
      "Defining success metrics",
      "Roadmapping and trade-offs",
      "Writing a PRD",
      "Working with engineering and design"
    ],
  },
  {
    name: "Support / Service Desk Engineer",
    match: /\b(support|service desk|help.?desk)\b/i,
    topics: [
      "Ticket triage and prioritisation",
      "SLA and escalation",
      "Root cause analysis",
      "Reading logs and basic troubleshooting",
      "Customer communication"
    ],
  },
  {
    name: "Network Engineer",
    match: /\b(network|ccna|routing|switching)\b/i,
    topics: [
      "OSI and TCP/IP models",
      "Routing and switching",
      "Subnetting",
      "DNS, DHCP, NAT",
      "Network troubleshooting"
    ],
  },
  {
    name: "HR",
    match: /\b(hr|human resource|recruit\w*|talent acquisition)\b/i,
    topics: [
      "Recruitment lifecycle",
      "Screening and sourcing",
      "Employee engagement and retention",
      "Payroll and compliance basics",
      "Handling conflict"
    ],
  },
  {
    name: "Sales",
    match: /\b(sales|business development|account executive)\b/i,
    topics: [
      "Sales funnel and pipeline",
      "Lead qualification",
      "Objection handling",
      "CRM usage",
      "Negotiation and closing"
    ],
  },
  {
    name: "Marketing",
    match: /\b(marketing|seo|sem|brand|growth)\b/i,
    topics: [
      "Segmentation, targeting, positioning",
      "Digital channels (SEO, SEM, social)",
      "Campaign metrics (CTR, CAC, ROAS)",
      "Content strategy",
      "Market research"
    ],
  },
];

const fmt = (b) => `Examples for ${b.name}\n\n${b.topics.map((t) => "- " + t).join("\n")}`;

// Exported for tests: which bucket (if any) a free-text role resolves to.
export const matchRoleTopics = (role = "") =>
  ROLE_TOPICS.find((b) => b.match.test(String(role))) || null;

const topicBlockFor = (role) => {
  const bucket = matchRoleTopics(role);
  if (bucket) return fmt(bucket);
  return `This role is not in the reference list. Infer its domain from the role
title and ask the standard, well-known interview questions for that domain.`;
};

const technicalInterviewPrompt = ({
  role,
  useResume,
  resume,
  roleFromResume = false,
}) => `

You are a Senior Technical Interviewer.

Generate realistic technical interview questions.

Return VALID JSON only.

Candidate Role:

${role}

Resume Available:

${useResume ? "YES" : "NO"}

${
useResume
? `
Resume

Summary:
${resume?.summary}

Skills:
${resume?.skills?.join(", ")}

Projects:
${resume?.projects?.join(", ")}

Strengths:
${resume?.strengths?.join(", ")}

Weaknesses:
${resume?.weaknesses?.join(", ")}

Missing Skills:
${resume?.missingSkills?.join(", ")}

Recommendations:
${resume?.recommendations?.join(", ")}
`
: ""
}

=========================
RULES
=========================

Generate EXACTLY 6 questions.

Each object must contain ONLY:

- question
- difficulty
- timer

Difficulty must be ONLY:

- easy
- medium
- hard

Never use

- coding
- practical
- technical
- hr

as difficulty.

Difficulty Order

Q1 -> easy

Q2 -> easy

Q3 -> medium

Q4 -> hard

Q5 -> hard

Q6 -> hard

=========================
Question Rules
=========================

Question 1-4

Generate conceptual and technical interview questions for the CANDIDATE ROLE
stated at the top of this prompt.

=========================
ROLE AUTHORITY (READ CAREFULLY)
=========================
${roleFromResume ? `
THIS INTERVIEW IS RESUME-DRIVEN.

The candidate did NOT type a target role. The role above was inferred from
their resume, so the resume — not the role label — is the source of truth.

For this interview:

1. Draw the questions DIRECTLY from the resume above.
2. Ask about their OWN listed projects by name. Probe the decisions behind
   them: why that approach, what broke, what they would change.
3. Ask about the specific technologies in their Skills list.
4. Use the Missing Skills only as the occasional stretch question.
5. Do NOT ask generic questions for the role label that could be asked of
   any candidate — the whole point is that these are about THEIR work.

Ignore the "never switch domains because of the resume" rule below; it applies
only when the candidate typed a role of their own.
` : `
The Candidate Role is the role the candidate is TARGETING. It is the single
source of truth for WHICH TOPICS to ask about.`}

The resume describes what the candidate has done SO FAR. It may be from a
completely different domain than the target role. That is normal and expected —
a candidate targeting a new role will have a resume full of their old stack.

Therefore:

1. ALWAYS ask questions from the Candidate Role's domain.
2. NEVER switch domains because the resume uses a different technology stack.
   If the role is "AI Engineer" and the resume is full of Node.js, Express and
   MongoDB, you STILL ask AI / ML questions. Do NOT ask Node.js questions.
3. Use the resume ONLY to personalise WITHIN the role's domain:
   - calibrate difficulty to the candidate's apparent level,
   - reference their projects when a project is relevant to the target role,
   - probe the Missing Skills that matter for the target role.
4. If the resume shares no overlap with the target role, ignore the resume
   content entirely and ask standard questions for the target role.


${topicBlockFor(role)}

=========================
UNLISTED ROLES (IMPORTANT)
=========================

The list above is NOT exhaustive. The Candidate Role is free text, so the
candidate may enter a role that does not appear anywhere above — for example
"GenAI Engineer", "MLOps Engineer", "SDE-1", "Salesforce Developer",
"SAP Consultant", ".NET Developer", "Site Reliability Engineer",
"Mechanical Design Engineer" or any other title.

When the role is not listed:

1. Infer the domain from the role title itself.
2. Generate the standard, well-known interview questions for that domain.
3. NEVER fall back to the resume's technology stack to decide the topic.
4. If the title is genuinely ambiguous, ask broadly applicable questions for
   the closest matching domain — never questions from an unrelated domain.

=========================
Question 5 & Question 6
=========================

If the candidate belongs to a SOFTWARE DEVELOPMENT role such as:

- Software Engineer
- Backend Developer
- Frontend Developer
- Full Stack Developer
- MERN Developer
- Java Developer
- Python Developer
- Node.js Developer
- React Developer
- Mobile Developer
- AI Engineer

Generate CODING questions.

Coding is ONLY a question type.

Difficulty remains HARD.

The question should be solvable during a live interview.

Examples

- Implement LRU Cache
- Reverse Linked List
- Debounce Function
- Design Rate Limiter
- Build REST API
- Binary Tree Traversal

Timer should be decided according to the coding complexity.

Usually between

600-1800 seconds.

Do NOT always use the same timer.

----------------------------

If the candidate belongs to ANY NON-CODING role such as

- HR
- Sales
- Marketing
- Accountant
- Business Analyst
- UI/UX
- Product Manager
- QA
- Network Engineer
- Support Engineer
- Data Analyst
- Cyber Security
- Cloud Engineer
- Mechanical Engineer
- Civil Engineer

Generate PRACTICAL ROLE-SPECIFIC interview questions.

These should simulate real interview scenarios.

Examples

Sales

"Sell me this laptop."

Marketing

"How would you launch a new product?"

UI/UX

"Improve this login page experience."

Cloud

"Your production server suddenly crashes. What will you do?"

Cyber Security

"User credentials are leaked. Explain your response."

QA

"How would you test this e-commerce checkout flow?"

The timer should be based on the complexity.

Generally between

180-600 seconds.

=========================
Timer Rules
=========================

The interview should feel like a real live technical interview.

Give slightly less time to create realistic interview pressure.

Minimum timer = 60 seconds.

Do NOT assign fixed timers.

Choose the timer according to the expected complexity.

Recommended ranges:

Basic definition
60-75 sec

Concept explanation
75-120 sec

Comparison questions
90-120 sec

Architecture / Design discussion
120-180 sec

Debugging scenarios
120-240 sec

Practical role-based scenarios
180-300 sec

Coding Questions

Easy coding
300-420 sec

Medium coding
420-600 sec

Hard coding
600-900 sec

Do NOT always use the maximum time.

The timer should feel challenging but achievable in a live interview.

=========================

Return ONLY JSON.

Example

[
  {
    "question":"Explain event loop.",
    "difficulty":"easy",
    "timer":90
  },
  {
    "question":"Implement an LRU Cache.",
    "difficulty":"hard",
    "timer":1200
  }
]

No markdown.

No explanation.

No extra text.

`;

export default technicalInterviewPrompt;