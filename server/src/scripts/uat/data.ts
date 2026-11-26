import type { Deck } from '@notalah/shared';

export type UatRole = 'admin' | 'lecturer' | 'student';
/** Public per-role defaults (admin123, lecturer123, student123), for a local demo only. */
export const defaultUatPassword = (role: UatRole): string => `${role}123`;
export const uatPassword = (role: UatRole): string => {
  if (process.env.NODE_ENV === 'production' && !process.env.UAT_PASSWORD) {
    throw new Error('UAT_PASSWORD is required in production: the default passwords are public');
  }
  const p = process.env.UAT_PASSWORD || defaultUatPassword(role);
  if (p.length < 8) throw new Error('UAT_PASSWORD must be at least 8 characters');
  if (Buffer.byteLength(p, 'utf8') > 72) throw new Error('UAT_PASSWORD must be at most 72 bytes');
  return p;
};

export const USER_PROGRAMME = 'BSc (Hons) Software Engineering';

export const USERS = [
  { email: 'admin@gmail.com', name: 'NotaLah Admin', role: 'admin', staffId: null },
  { email: 'aisha@gmail.com', name: 'Dr Aisha Rahman', role: 'lecturer', staffId: 'UATL01' },
  { email: 'daniel@gmail.com', name: 'Daniel Tan', role: 'student', staffId: null },
  { email: 'priya@gmail.com', name: 'Priya Nair', role: 'student', staffId: null },
  { email: 'weijie@gmail.com', name: 'Wei Jie Lim', role: 'student', staffId: null },
] as const;

export const MODULES = [
  { code: 'UAT101-3-2', name: 'Database Systems', programme: USER_PROGRAMME },
  { code: 'UAT102-3-2', name: 'Operating Systems and Networks', programme: USER_PROGRAMME },
  { code: 'UAT103-3-2', name: 'Agile Software Development', programme: USER_PROGRAMME },
] as const;

interface Page {
  title: string;
  points: string[];
  code?: string;
}
export interface UatNote {
  title: string;
  author: (typeof USERS)[number]['email'];
  module: (typeof MODULES)[number]['code'];
  theme: Deck['theme'];
  tags: string[];
  pages: Page[];
  /** Hidden by moderation: the admin's suspend step targets its author. */
  hidden?: true;
}

export interface UatReport {
  reporter: (typeof USERS)[number]['email'];
  title: string;
  reason: 'inaccurate' | 'inappropriate' | 'spam' | 'plagiarism' | 'copyright' | 'other';
  details: string;
}

const box = { x: 60, rotation: 0, opacity: 1, locked: false };

const text = (id: string, y: number, h: number, html: string, size: number, weight: 400 | 700) => ({
  ...box,
  id,
  type: 'text' as const,
  y,
  w: 880,
  h,
  html,
  font: 'source-sans-3' as const,
  size,
  weight,
  color: '#111827',
  align: 'left' as const,
  lineHeight: 1.4,
  letterSpacing: 0,
  padding: 0,
});

const codeBlock = (id: string, y: number, code: string) => ({
  ...box,
  id,
  type: 'code' as const,
  y,
  w: 880,
  h: 300,
  code,
  language: 'plaintext' as const,
  theme: 'dark' as const,
  size: 28,
});

export const toDeck = (n: UatNote): Deck => ({
  aspect: '4:5',
  theme: n.theme,
  music: null,
  slides: n.pages.map((p, i) => ({
    background: { kind: 'color', color: '#ffffff' },
    notes: '',
    elements: [
      text(`slide${i + 1}-heading`, 60, 120, `<h1>${p.title}</h1>`, 56, 700),
      text(`slide${i + 1}-body`, 220, 500, `<ul>${p.points.map((x) => `<li>${x}</li>`).join('')}</ul>`, 36, 400),
      ...(p.code ? [codeBlock(`slide${i + 1}-code`, 760, p.code)] : []),
    ],
  })),
});

const L = 'aisha@gmail.com';
const S1 = 'daniel@gmail.com';
const S2 = 'priya@gmail.com';
const S3 = 'weijie@gmail.com';
const [DB, OS, AG] = ['UAT101-3-2', 'UAT102-3-2', 'UAT103-3-2'] as const;

export const NOTES: UatNote[] = [
  {
    title: 'Database normalisation in 3 steps',
    author: L,
    module: DB,
    theme: 'lecture',
    tags: ['uat', 'database', 'normalisation'],
    pages: [
      {
        title: 'Why normalise?',
        points: ['Remove duplicated facts', 'Avoid update, insert and removal anomalies', 'Keep one fact in one place'],
      },
      {
        title: 'First to third normal form',
        points: [
          '1NF: atomic values, no repeating groups',
          '2NF: no partial dependency on a composite key',
          '3NF: no transitive dependency between non-key columns',
        ],
      },
      {
        title: 'Worked example',
        points: [
          'ORDER(order_id, customer_id, customer_name)',
          'customer_name depends on customer_id, not the key',
          'Split it into CUSTOMER and ORDER',
        ],
      },
    ],
  },
  {
    title: 'SQL joins cheat sheet',
    author: L,
    module: DB,
    theme: 'howto',
    tags: ['uat', 'database', 'sql'],
    pages: [
      {
        title: 'INNER and LEFT JOIN',
        points: [
          'INNER keeps only matching rows',
          'LEFT keeps every left row, NULL when no match',
          'Filter on the right table in ON, not WHERE',
        ],
        code: 'SELECT s.name, m.mod_name\nFROM student s\nLEFT JOIN module m ON m.id = s.module_id;',
      },
      {
        title: 'Choosing a join',
        points: [
          'Need every customer, even without orders: LEFT',
          'Need only customers who ordered: INNER',
          'Check row counts before and after',
        ],
      },
    ],
  },
  {
    title: 'Transactions and ACID',
    author: S1,
    module: DB,
    theme: 'revision',
    tags: ['uat', 'database', 'transactions'],
    pages: [
      {
        title: 'ACID in one line each',
        points: [
          'Atomicity: all or nothing',
          'Consistency: constraints always hold',
          'Isolation: concurrent work does not interfere',
          'Durability: committed data survives a crash',
        ],
      },
      {
        title: 'Deadlock',
        points: [
          'Two transactions each wait for the other',
          'Detect with a wait-for graph',
          'Prevent by locking in a fixed order',
        ],
      },
    ],
  },
  {
    title: 'Indexes and query speed',
    author: S2,
    module: DB,
    theme: 'plain',
    tags: ['uat', 'database', 'index'],
    pages: [
      {
        title: 'What an index does',
        points: [
          'A sorted lookup structure beside the table',
          'Turns a full scan into a tree search',
          'Costs space and slows writes',
        ],
      },
      {
        title: 'When to add one',
        points: [
          'Columns in WHERE, JOIN and ORDER BY',
          'High selectivity columns first',
          'Check the plan with EXPLAIN',
        ],
        code: 'CREATE INDEX idx_post_author ON post (author_id);\nEXPLAIN SELECT * FROM post WHERE author_id = 7;',
      },
    ],
  },
  {
    title: 'Process scheduling algorithms',
    author: L,
    module: OS,
    theme: 'lecture',
    tags: ['uat', 'os', 'scheduling'],
    pages: [
      {
        title: 'Why schedule?',
        points: ['Many processes share few CPU cores', 'Goals: throughput, fairness, low response time'],
      },
      {
        title: 'Common algorithms',
        points: [
          'FCFS: simple, convoy effect',
          'SJF: optimal average wait, needs run times',
          'Round robin: fair, depends on the time quantum',
        ],
      },
      {
        title: 'Worked example',
        points: ['P1 = 6 ms, P2 = 3 ms, P3 = 1 ms', 'FCFS average wait = 3.0 ms', 'SJF average wait = 1.3 ms'],
      },
    ],
  },
  {
    title: 'Virtual memory and paging',
    author: S3,
    module: OS,
    theme: 'revision',
    tags: ['uat', 'os', 'memory'],
    pages: [
      {
        title: 'Paging basics',
        points: [
          'Memory split into fixed-size pages and frames',
          'The page table maps pages to frames',
          'A TLB caches recent translations',
        ],
      },
      {
        title: 'Page faults',
        points: [
          'Page not in memory triggers a fault',
          'OS loads it from disk, may evict another page',
          'Replacement policies: FIFO, LRU',
        ],
      },
    ],
  },
  {
    title: 'TCP versus UDP',
    author: S1,
    module: OS,
    theme: 'howto',
    tags: ['uat', 'network', 'protocol'],
    pages: [
      {
        title: 'TCP',
        points: [
          'Connection set up with a three-way handshake',
          'Ordered, reliable, retransmits lost packets',
          'Used for web pages and email',
        ],
      },
      {
        title: 'UDP',
        points: [
          'No connection, no delivery guarantee',
          'Low overhead and latency',
          'Used for streaming, DNS and games',
        ],
      },
    ],
  },
  {
    title: 'Subnetting made simple',
    author: S2,
    module: OS,
    theme: 'journal',
    tags: ['uat', 'network', 'subnet'],
    pages: [
      {
        title: 'Reading a prefix',
        points: [
          '192.168.1.0/24 means 24 network bits',
          '8 host bits give 256 addresses',
          'Usable hosts = 256 - 2 = 254',
        ],
      },
      {
        title: 'Splitting a network',
        points: [
          'Borrow bits from the host part',
          '/25 gives two subnets of 126 hosts',
          '/26 gives four subnets of 62 hosts',
        ],
      },
    ],
  },
  {
    title: 'Threads and race conditions',
    author: L,
    module: OS,
    theme: 'midnight',
    tags: ['uat', 'os', 'concurrency'],
    pages: [
      {
        title: 'A race condition',
        points: [
          'Two threads update shared data at once',
          'The result depends on timing',
          'counter++ is read, add, write: not atomic',
        ],
      },
      {
        title: 'Fixes',
        points: [
          'Mutex: one thread in the critical section',
          'Atomic operations for simple counters',
          'Prefer immutable data where possible',
        ],
        code: 'lock.acquire()\ncounter += 1\nlock.release()',
      },
    ],
  },
  {
    title: 'Scrum roles and events',
    author: L,
    module: AG,
    theme: 'lecture',
    tags: ['uat', 'agile', 'scrum'],
    pages: [
      {
        title: 'Three roles',
        points: [
          'Product Owner: value and backlog order',
          'Scrum Master: removes impediments',
          'Developers: build the increment',
        ],
      },
      {
        title: 'Five events',
        points: [
          'Sprint, Sprint Planning, Daily Scrum',
          'Sprint Review shows the increment',
          'Retrospective improves the way of working',
        ],
      },
    ],
  },
  {
    title: 'Writing good user stories',
    author: S3,
    module: AG,
    theme: 'howto',
    tags: ['uat', 'agile', 'requirements'],
    pages: [
      {
        title: 'The template',
        points: [
          'As a (role), I want (goal), so that (benefit)',
          'Keep each story small and testable',
          'Check with INVEST: independent, negotiable, valuable',
        ],
      },
      {
        title: 'Acceptance criteria',
        points: [
          'Given a context, when an action, then an outcome',
          'Two to five criteria per story',
          'They become the test cases',
        ],
      },
    ],
  },
  {
    title: 'Sprint planning checklist',
    author: S1,
    module: AG,
    theme: 'plain',
    tags: ['uat', 'agile', 'sprint'],
    pages: [
      {
        title: 'Before the meeting',
        points: ['Backlog refined and ordered', 'Team capacity known', 'Sprint goal drafted'],
      },
      {
        title: 'In the meeting',
        points: ['Pick stories that fit the capacity', 'Break them into tasks', 'Agree a definition of done'],
      },
    ],
  },
  {
    title: 'Testing levels at a glance',
    author: S2,
    module: AG,
    theme: 'revision',
    tags: ['uat', 'testing', 'quality'],
    pages: [
      {
        title: 'The pyramid',
        points: [
          'Many unit tests: fast and cheap',
          'Fewer integration tests',
          'Few end-to-end tests: slow, high value',
        ],
      },
      {
        title: 'Acceptance testing',
        points: [
          'Done by real users on real tasks',
          'Checks the system meets the need',
          'Record task time, errors and a SUS score',
        ],
      },
    ],
  },
  {
    title: 'Risk management basics',
    author: L,
    module: AG,
    theme: 'journal',
    tags: ['uat', 'project', 'risk'],
    pages: [
      {
        title: 'Identify and rate',
        points: ['List what could go wrong', 'Rate likelihood and impact', 'Rank by exposure = likelihood x impact'],
      },
      {
        title: 'Respond',
        points: ['Avoid, reduce, transfer or accept', 'Assign an owner to each risk', 'Review every sprint'],
      },
    ],
  },
  {
    title: 'Copied exam answers (hidden)',
    author: S1,
    module: DB,
    theme: 'plain',
    hidden: true,
    tags: ['uat', 'moderation'],
    pages: [
      {
        title: 'Past exam answers',
        points: [
          'Answers copied from a past paper',
          'Reported by two students',
          'Hidden by moderation, reports still open',
        ],
      },
    ],
  },
];

/** Three open reports: two on the hidden note, one on a published note. Reporters are never the author. */
export const REPORTS: UatReport[] = [
  {
    reporter: S2,
    title: 'Copied exam answers (hidden)',
    reason: 'plagiarism',
    details: 'These are answers from the 2025 final exam paper.',
  },
  {
    reporter: S3,
    title: 'Copied exam answers (hidden)',
    reason: 'copyright',
    details: 'Copied from the marking scheme of the lecturer.',
  },
  {
    reporter: S1,
    title: 'Subnetting made simple',
    reason: 'inaccurate',
    details: 'The /26 host count looks wrong to me.',
  },
];
