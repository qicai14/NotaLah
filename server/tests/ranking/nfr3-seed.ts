/*
 * NFR3 labelled seed (#77): 40 notes, 10 feed viewers and 6 search queries, all timed against one fixed ASOF so every run
 * scores the same. Labels: PROVISIONAL until #86 (the UAT label set replaces them).
 *
 * Label definitions (independent of the ranking code, so the measure cannot agree with it by construction):
 * - Subject: one of SUBJECTS. Lifestyle tags (#campuslife, #memes, ...) are not Subjects.
 * - Verified: Super Liked by an approved, active lecturer (`verified: true`). Global, the same for every viewer.
 * - Subject-relevant to a viewer: the note carries at least one hashtag in the viewer's `subjects`, i.e. a Subject the
 *   viewer has viewed, liked or commented on within the interest window (the seed's history notes). History notes
 *   themselves, which the viewer has already opened, are not counted as surfaced relevant notes.
 * - Relevant to a search query q: the note's `topic` (the Subject it is about) is q. A note that only mentions q in its
 *   text, however popular, is a distractor.
 */
import { createNote } from '../../src/features/notes/repository';
import { pool } from '../../src/lib/pool';
import { insertUser, textSlide } from '../helpers';

export const LABEL_STATUS = 'provisional (#86)';
export const ASOF = new Date('2026-09-01T00:00:00.000Z');
export const SUBJECTS = ['normalisation', 'recursion', 'subnetting', 'deadlock', 'encryption', 'uml'] as const;
type Subject = (typeof SUBJECTS)[number];

export interface SeedNote {
  title: string;
  text: string;
  tags: string[];
  hoursAgo: number;
  likes: number;
  topic: Subject | null;
  verified?: boolean;
  byLecturer?: boolean;
  history?: boolean;
}

const HISTORY_HOURS = 60 * 24;
const history = (s: Subject): SeedNote => ({
  title: `${s} lecture recap week 2`,
  text: `Recap of the ${s} lecture.`,
  tags: [s],
  hoursAgo: HISTORY_HOURS,
  likes: 0,
  topic: s,
  history: true,
});
const study = (
  topic: Subject,
  title: string,
  text: string,
  hoursAgo: number,
  likes: number,
  extra: Partial<SeedNote> = {},
) => ({ title, text, tags: [topic], hoursAgo, likes, topic, ...extra }) satisfies SeedNote;
const offTopic = (title: string, text: string, tag: string, hoursAgo: number, likes: number): SeedNote => ({
  title,
  text,
  tags: [tag],
  hoursAgo,
  likes,
  topic: null,
});

export const NOTES: SeedNote[] = [
  ...SUBJECTS.map(history),
  study(
    'normalisation',
    'Normalisation: 1NF to 3NF walkthrough',
    'Remove repeating groups, then partial and transitive dependencies.',
    120,
    3,
    { verified: true },
  ),
  study(
    'normalisation',
    'Normalisation exercise: splitting a sales table',
    'Split orders and customers into their own tables.',
    30,
    1,
  ),
  study(
    'normalisation',
    'BCNF vs 3NF normalisation cheat sheet',
    'Every determinant must be a candidate key in BCNF.',
    70,
    0,
  ),
  study(
    'normalisation',
    'Functional dependencies and normalisation',
    'Two transactions locking rows can deadlock, but that is another topic.',
    10,
    2,
    { tags: ['normalisation', 'sql'] },
  ),
  study(
    'recursion',
    'Recursion basics: base case and recursive case',
    'Every recursive function needs a base case.',
    20,
    2,
  ),
  study(
    'recursion',
    'Tracing recursion with the call stack',
    'Each call pushes a frame until the base case returns.',
    50,
    0,
  ),
  study('recursion', 'Tail recursion explained', 'The recursive call is the last thing the function does.', 90, 4),
  study('recursion', 'Recursion practice: factorial and Fibonacci', 'Write both, then compare with loops.', 8, 0),
  study('subnetting', 'Subnetting a /24 step by step', 'Borrow host bits to make subnets.', 48, 5, { verified: true }),
  study('subnetting', 'Subnetting quiz answers', 'Answers to the tutorial quiz on subnets.', 16, 1),
  study(
    'subnetting',
    'VLSM subnetting worked example',
    'Allocate the biggest subnet first; no encryption here, just maths.',
    60,
    0,
  ),
  study('subnetting', 'Subnet masks and CIDR subnetting', 'A /26 mask is 255.255.255.192.', 100, 2),
  study(
    'deadlock',
    'Deadlock: the four Coffman conditions',
    'Mutual exclusion, hold and wait, no preemption, circular wait.',
    36,
    1,
    { byLecturer: true },
  ),
  study(
    'deadlock',
    "Banker's algorithm for deadlock avoidance",
    'Grant a request only if the state stays safe.',
    12,
    0,
  ),
  study(
    'deadlock',
    'Deadlock detection with resource graphs',
    'A cycle means deadlock; unlike subnetting, no maths needed.',
    80,
    3,
  ),
  study('deadlock', 'Deadlock vs starvation', 'Starvation waits forever without a cycle.', 26, 0),
  study('encryption', 'Symmetric vs asymmetric encryption', 'One shared key versus a key pair.', 14, 2),
  study('encryption', 'RSA encryption worked example', 'Pick p and q; draw the handshake as a UML sequence.', 44, 0),
  study('encryption', 'AES encryption rounds summary', 'SubBytes, ShiftRows, MixColumns, AddRoundKey.', 75, 1),
  study(
    'encryption',
    'Encryption and hashing are not the same',
    'Encryption is reversible with the key; hashing is not.',
    6,
    0,
    { tags: ['encryption', 'hashing'] },
  ),
  study('uml', 'UML class diagram notation', 'Classes map to tables after normalisation.', 18, 1),
  study('uml', 'UML sequence diagram tips', 'For example a sequence diagram for a recursion call.', 40, 0),
  study('uml', 'UML use case diagram examples', 'Actors outside the system boundary.', 85, 3),
  study('uml', 'UML activity diagram swimlanes', 'One lane per actor.', 9, 0),
  offTopic(
    'Internship interview questions I got',
    'They asked about recursion, normalisation and subnetting.',
    'internship',
    4,
    38,
  ),
  offTopic('Best food near campus', 'Cheap lunch spots ranked.', 'campuslife', 2, 25),
  offTopic('Exam week survival memes', 'When the deadlock question appears.', 'memes', 6, 30),
  offTopic('My gaming setup tour', 'Monitor, keyboard and chair.', 'gaming', 10, 18),
  offTopic('Hostel room makeover', 'Fairy lights and a rug.', 'campuslife', 20, 22),
  offTopic(
    'Resume tips for tech internships',
    'List projects such as an encryption tool and UML diagrams.',
    'internship',
    8,
    15,
  ),
  offTopic('Club fair highlights', 'Photos from the club fair.', 'campuslife', 1, 12),
  offTopic('Coding memes compilation', 'To understand recursion you must first understand recursion.', 'memes', 3, 40),
  offTopic('Study playlist for late nights', 'Lo-fi beats.', 'campuslife', 14, 10),
  offTopic('Hackathon weekend recap', 'We built an encryption chat app with subnetting labs.', 'hackathon', 30, 20),
];

export const VIEWERS: { subjects: Subject[]; history: ['view' | 'like' | 'comment', number][] }[] = [
  { subjects: ['recursion'], history: [['comment', 2]] },
  { subjects: ['normalisation'], history: [['like', 1]] },
  { subjects: ['subnetting'], history: [['view', 3]] },
  { subjects: ['deadlock'], history: [['comment', 5]] },
  { subjects: ['encryption'], history: [['like', 2]] },
  { subjects: ['uml'], history: [['view', 1]] },
  {
    subjects: ['recursion', 'deadlock'],
    history: [
      ['comment', 1],
      ['like', 4],
    ],
  },
  {
    subjects: ['encryption', 'subnetting'],
    history: [
      ['like', 3],
      ['view', 1],
    ],
  },
  {
    subjects: ['uml', 'normalisation'],
    history: [
      ['comment', 10],
      ['view', 2],
    ],
  },
  {
    subjects: ['deadlock', 'encryption', 'uml'],
    history: [
      ['view', 1],
      ['view', 3],
      ['view', 6],
    ],
  },
];

const at = (hoursAgo: number) => new Date(ASOF.getTime() - hoursAgo * 3_600_000);

export async function seedNfr3(): Promise<{ noteIds: number[]; viewerIds: number[] }> {
  const author = await insertUser();
  const lecturerAuthor = await insertUser({ role: 'lecturer', lecturerStatus: 'approved', staffId: 'S-NFR3-A' });
  const verifier = await insertUser({ role: 'lecturer', lecturerStatus: 'approved', staffId: 'S-NFR3-V' });
  const likers: number[] = [];
  for (let i = 0; i < Math.max(...NOTES.map((n) => n.likes)); i++) likers.push(await insertUser());
  const moduleId = (await pool.query<{ mod_id: number }>(`SELECT mod_id FROM "MODULE_T" WHERE mod_code = 'CT030-3-2'`))
    .rows[0].mod_id;
  const noteIds: number[] = [];
  for (const n of NOTES) {
    const id = await createNote(n.byLecturer ? lecturerAuthor : author, {
      title: n.title,
      theme: 'plain',
      aspect: '4:5',
      slides: [textSlide(`<p>${n.text}</p>`)],
      music: null,
      hashtags: n.tags,
      moduleId,
      status: 'published',
      visibility: 'public',
    });
    const published = at(n.hoursAgo);
    await pool.query(`UPDATE "POST_T" SET pst_published_at = $2 WHERE pst_id = $1`, [id, published]);
    await pool.query(`INSERT INTO "LIKE_T" (lik_usr_id, lik_pst_id, lik_created_at) SELECT unnest($1::INT[]), $2, $3`, [
      likers.slice(0, n.likes),
      id,
      published,
    ]);
    if (n.verified)
      await pool.query(`INSERT INTO "VERIFICATION_T" (ver_pst_id, ver_usr_id, ver_created_at) VALUES ($1, $2, $3)`, [
        id,
        verifier,
        published,
      ]);
    noteIds.push(id);
  }
  const viewerIds: number[] = [];
  for (const v of VIEWERS) {
    const uid = await insertUser();
    for (const [i, s] of v.subjects.entries()) {
      const [type, daysAgo] = v.history[i];
      await pool.query(
        `INSERT INTO "INTERACTION_T" (int_usr_id, int_pst_id, int_type, int_created_at) VALUES ($1, $2, $3, $4)`,
        [uid, noteIds[NOTES.findIndex((n) => n.history && n.topic === s)], type, at(daysAgo * 24)],
      );
    }
    viewerIds.push(uid);
  }
  return { noteIds, viewerIds };
}
