// Renders the 25 low-fidelity PARP wireframes (Chapter 4.4) to png/.
// Usage: node build.mjs   (needs `npm i` and `npx playwright install chromium` once)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = `
*{box-sizing:border-box;margin:0;padding:0}
html{filter:grayscale(1)}
body{font:14px/1.4 Arial,sans-serif;color:#222;background:#fff}
.frame{border:2px solid #555;min-height:100vh;display:flex;flex-direction:column}
.top{display:flex;align-items:center;gap:16px;padding:10px 18px;border-bottom:2px solid #555;background:#eee}
.logo{font-weight:bold;border:2px solid #555;padding:4px 10px;background:#fff}
.search{flex:1;border:2px solid #777;border-radius:18px;padding:6px 14px;color:#777;background:#fff;max-width:460px}
.icons{margin-left:auto;display:flex;gap:10px}
.ic{width:30px;height:30px;border:2px solid #777;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11px}
.body{flex:1;display:flex}
.side{width:190px;border-right:2px solid #999;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f6f6f6}
.side div{padding:7px 10px;border:1px solid #bbb;background:#fff}
.side .on{background:#ccc;font-weight:bold}
.main{flex:1;padding:18px;display:flex;flex-direction:column;gap:12px;overflow:hidden}
.right{width:250px;border-left:2px solid #999;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f6f6f6}
.box{border:2px solid #777;padding:12px;background:#fff}
.dash{border:2px dashed #888;padding:12px}
.img{background:#ddd;border:2px solid #999;position:relative;display:flex;align-items:center;justify-content:center;color:#666}
.line{height:10px;background:#ccc;margin:6px 0;border-radius:2px}
.btn{display:inline-block;border:2px solid #444;padding:6px 14px;background:#ddd;font-weight:bold;text-align:center}
.btn.p{background:#444;color:#fff}
.inp{border:2px solid #888;padding:7px 10px;color:#777;background:#fff}
.lbl{font-size:12px;font-weight:bold;margin-top:6px}
.row{display:flex;gap:10px;align-items:center}
.col{display:flex;flex-direction:column;gap:8px}
.av{width:36px;height:36px;border-radius:50%;background:#bbb;border:2px solid #777;flex:none}
.tag{border:1px solid #777;border-radius:10px;padding:1px 8px;font-size:12px;background:#eee}
.badge{border:2px solid #222;border-radius:50%;width:16px;height:16px;font-size:10px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold}
.ver{border:4px double #222}
h1{font-size:20px} h2{font-size:16px} h3{font-size:14px}
.muted{color:#777;font-size:12px}
.tabs{display:flex;border-bottom:2px solid #777}
.tabs div{padding:6px 16px;border:2px solid #777;border-bottom:none;margin-right:4px;background:#eee}
.tabs .on{background:#fff;font-weight:bold}
table{border-collapse:collapse;width:100%}
td,th{border:1px solid #888;padding:6px 8px;text-align:left;font-size:13px}
th{background:#ddd}
.modal-bg{position:absolute;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center}
.modal{background:#fff;border:3px solid #333;padding:18px;width:440px;display:flex;flex-direction:column;gap:10px}
.note{border:2px solid #333;padding:4px 8px;background:#fffbe0;font-size:12px}
.bubble{border:2px solid #888;border-radius:10px;padding:8px 12px;max-width:60%;background:#fff}
.bubble.me{margin-left:auto;background:#ddd}
.mob{width:390px;margin:0 auto}
`;

const L = (n = 3, w = [100, 92, 70]) =>
  Array.from({ length: n }, (_, i) => `<div class="line" style="width:${w[i % w.length]}%"></div>`).join('');
const img = (h, label = 'image') => `<div class="img" style="height:${h}px">${label}</div>`;
const top = (q = 'Search modules, #hashtags, notes, people') =>
  `<div class="top"><div class="logo">PARP</div><div class="search">&#128269; ${q}</div><div class="icons"><div class="ic">+</div><div class="ic">&#9993;</div><div class="ic">&#128276;</div><div class="ic">Me</div></div></div>`;
const nav = (on) =>
  `<div class="side">${['Feed', 'Create Note', 'Drafts', 'Saved', 'Messages', 'Message Requests', 'Profile']
    .map((x) => `<div class="${x === on ? 'on' : ''}">${x}</div>`).join('')}<div style="margin-top:auto">Log Out</div></div>`;
const adminNav = (on) =>
  `<div class="side">${['Reports', 'Users', 'Lecturer Applications', 'Search']
    .map((x) => `<div class="${x === on ? 'on' : ''}">${x}</div>`).join('')}<div style="margin-top:auto">Log Out</div></div>`;
const app = (on, main, right = '', q) =>
  `<div class="frame">${top(q)}<div class="body">${nav(on)}<div class="main">${main}</div>${right ? `<div class="right">${right}</div>` : ''}</div></div>`;
const admin = (on, main) =>
  `<div class="frame"><div class="top"><div class="logo">PARP Admin</div><div class="search">&#128269; Search users or posts by name or #hashtag</div><div class="icons"><div class="ic">A</div></div></div><div class="body">${adminNav(on)}<div class="main">${main}</div></div></div>`;
const actions = `<div class="row" style="justify-content:space-around"><span>&#9825; Like 24</span><span>&#128172; Comment 6</span><span>&#9733; Super Like</span><span>&#128278; Save</span><span>&#9993; Message author</span><span>&#8942;</span></div>`;
const noteCard = (title, verified = false, lecturer = false) => `
  <div class="box ${verified ? 'ver' : ''}" style="padding:0">
    <div class="row" style="padding:10px 12px"><div class="av"></div><div><b>Aina Rahman</b> ${lecturer ? '<span class="badge">&#10003;</span> Lecturer' : ''}<div class="muted">CT046-3-M Software Architecture · 36 h ago · Public</div></div>
    ${verified ? '<div style="margin-left:auto" class="note">&#10003; Verified by Dr Tan</div>' : ''}</div>
    <div style="padding:0 12px"><h2>${title}</h2></div>
    <div style="padding:10px 12px">${img(260, 'Slide 1 of 6 &nbsp; &#8592; swipe &#8594;')}</div>
    <div style="padding:0 12px 6px" class="row"><span class="tag">#software_architecture</span><span class="tag">#design_patterns</span><span class="tag">#mvc</span></div>
    <div style="padding:8px 12px;border-top:2px solid #999">${actions}</div>
  </div>`;
const modal = (inner, under) => `<div style="position:relative;height:100vh">${under}<div class="modal-bg"><div class="modal">${inner}</div></div></div>`;

const screens = [
  ['01_landing', 'Landing page', `<div class="frame"><div class="top"><div class="logo">PARP</div><div class="icons"><span class="btn">Log In</span><span class="btn p">Register</span></div></div>
    <div class="body" style="padding:40px;gap:40px;align-items:center"><div class="col" style="flex:1"><h1 style="font-size:30px">Share notes. Get them verified. Find them fast.</h1>${L(3)}<div class="row"><span class="btn p">Get started</span><span class="btn">Log In</span></div></div><div style="flex:1">${img(380, 'feed preview illustration')}</div></div>
    <div class="row" style="padding:20px 40px;gap:20px">${['Lecturer-verified notes', 'Search by module code', 'Message about a note'].map((t) => `<div class="box" style="flex:1"><h3>${t}</h3>${L(2)}</div>`).join('')}</div></div>`],
  ['02_register', 'Register', `<div class="frame"><div class="top"><div class="logo">PARP</div></div><div class="body" style="justify-content:center;align-items:center"><div class="box col" style="width:440px">
    <h1>Create account</h1><div class="lbl">Display name</div><div class="inp">e.g. Lim Qi Cai</div><div class="lbl">Email</div><div class="inp">name@mail.apu.edu.my</div>
    <div class="row"><div class="col" style="flex:1"><div class="lbl">Password</div><div class="inp">min. 8 characters</div></div><div class="col" style="flex:1"><div class="lbl">Confirm password</div><div class="inp">••••••••</div></div></div>
    <div class="lbl">Programme</div><div class="inp">Select programme &#9662;</div><div class="lbl">I am a</div><div class="row"><span class="btn p">( • ) Student</span><span class="btn">( ) Lecturer</span></div>
    <div class="dash muted">Lecturer: Staff ID [__________] — lecturer features unlock after admin approval</div><span class="btn p">Register</span><div class="muted">Already have an account? <u>Log in</u></div></div></div></div>`],
  ['03_login', 'Log In', `<div class="frame"><div class="top"><div class="logo">PARP</div></div><div class="body" style="justify-content:center;align-items:center"><div class="box col" style="width:380px">
    <h1>Log in</h1><div class="lbl">Email</div><div class="inp">name@mail.apu.edu.my</div><div class="lbl">Password</div><div class="inp">••••••••</div>
    <div class="note">! Incorrect email or password (error state)</div><span class="btn p">Log In</span><div class="muted">No account? <u>Register</u></div></div></div></div>`],
  ['04_feed', 'Ranked feed (desktop)', app('Feed', `<div class="tabs"><div class="on">For you (ranked)</div><div>Contacts</div></div>${noteCard('MVC vs MVP vs MVVM — summary with examples', true)}`,
    `<h3>Why am I seeing this?</h3><div class="box muted">Verified by a lecturer · matches #software_architecture · 24 likes</div><h3>Your modules</h3>${['CT046-3-M', 'CT071-3-3', 'CT095-3-M'].map((m) => `<div class="tag">${m}</div>`).join('')}<h3>Trending hashtags</h3><div class="row" style="flex-wrap:wrap"><span class="tag">#sql</span><span class="tag">#normalisation</span><span class="tag">#react</span></div>`)],
  ['05_feed_mobile', 'Ranked feed (mobile)', `<div class="frame mob"><div class="top"><div class="logo">PARP</div><div class="icons"><div class="ic">&#128269;</div><div class="ic">&#9993;</div></div></div>
    <div class="col" style="padding:10px;flex:1"><div class="row"><div class="av"></div><div><b>Aina Rahman</b><div class="muted">CT046-3-M · 36 h</div></div><div class="note" style="margin-left:auto">&#10003; Verified</div></div>
    <h3>MVC vs MVP vs MVVM</h3>${img(420, 'Slide 1 / 6 &#8592; &#8594;')}<div class="row"><span class="tag">#mvc</span><span class="tag">#design_patterns</span></div>
    <div class="row" style="justify-content:space-around"><span>&#9825; 24</span><span>&#128172; 6</span><span>&#128278;</span><span>&#9993;</span></div><div class="muted" style="text-align:center">&#8593; swipe up for next note &#8593;</div></div>
    <div class="row" style="justify-content:space-around;border-top:2px solid #555;padding:10px;background:#eee"><b>Feed</b><span>Search</span><span>+</span><span>Saved</span><span>Me</span></div></div>`],
  ['06_note_detail', 'Note detail with comments', app('Feed', `<div class="row" style="align-items:flex-start;gap:16px"><div style="flex:3">${noteCard('Normalisation 1NF–3NF worked example', false)}</div>
    <div class="box col" style="flex:2"><h3>Comments (6)</h3><div class="dash"><div class="row"><div class="av"></div><b>Dr Tan</b> <span class="badge">&#10003;</span> <span class="muted">Pinned · lecturer</span></div><div class="muted">Slide 3:</div>${L(2)}</div>
    ${[1, 2, 3].map(() => `<div><div class="row"><div class="av"></div><b>Student name</b><span class="muted">&#9825; 4 · 2 h</span></div>${L(1)}<div class="muted">Reply</div></div>`).join('')}
    <div style="margin-left:30px" class="muted">&#8627; 1 reply</div><div class="row"><div class="inp" style="flex:1">Add a comment… (slide # optional)</div><span class="btn p">Post</span></div></div></div>`)],
  ['07_editor', 'Slide note editor', app('Create Note', `<div class="row"><div class="inp" style="flex:1">Note title</div><span class="btn">Save Draft</span><span class="btn p">Publish</span></div>
    <div class="row" style="align-items:stretch;gap:12px;flex:1"><div class="col" style="width:130px">${[1, 2, 3].map((n) => `<div class="img" style="height:70px">${n}</div>`).join('')}<div class="dash" style="text-align:center">+ slide</div></div>
    <div class="col" style="flex:1"><div class="row box" style="padding:6px"><b>H1</b><b>B</b><i>I</i><span>&bull; list</span><span>1. list</span><span>&lt;/&gt; code</span><span style="margin-left:auto">Template: Plain &#9662;</span></div><div class="box" style="flex:1">${L(6)}</div></div></div>
    <div class="row"><div class="lbl">Module</div><div class="inp" style="width:300px">CT046-3-M Software Architecture &#9662;</div><div class="lbl">Hashtags (1–5)</div><div class="inp" style="flex:1"><span class="tag">#mvc &times;</span> <span class="tag">#design_patterns &times;</span> type and press Enter</div></div>`)],
  ['08_publish_dialog', 'Publish visibility dialog', modal(`<h2>Publish note</h2><div class="muted">Who can see this note?</div>
    ${['Public — everyone; appears in the ranked feed and search', 'Contacts only — people you have accepted message requests from', 'Keep as private draft — only you'].map((t, i) => `<div class="box row"><span>${i === 0 ? '(•)' : '( )'}</span>${t}</div>`).join('')}
    <div class="muted">All three options are shown at the same size (FR10).</div><div class="row" style="justify-content:flex-end"><span class="btn">Cancel</span><span class="btn p">Publish</span></div>`, app('Create Note', `${img(500, 'editor (dimmed)')}`))],
  ['09_drafts', 'Drafts', app('Drafts', `<h1>Drafts</h1><table><tr><th>Title</th><th>Module</th><th>Slides</th><th>Last saved</th><th></th></tr>
    ${['Database indexing notes', 'React hooks cheat sheet', '(untitled)'].map((t) => `<tr><td>${t}</td><td>CT071-3-3</td><td>4</td><td>Today 14:20</td><td><u>Edit</u> · <u>Delete</u></td></tr>`).join('')}</table><div class="muted">Drafts are visible only to you and never appear in the feed or search.</div>`)],
  ['10_my_profile', 'My profile', app('Profile', `<div class="row box"><div class="av" style="width:80px;height:80px"></div><div class="col" style="flex:1"><h1>Lim Qi Cai</h1><div class="muted">BSc (Hons) Software Engineering · 18 notes · 42 contacts</div>${L(1)}</div><span class="btn">Edit Profile</span></div>
    <div class="tabs"><div class="on">Notes</div><div>Verified</div></div><div class="row" style="flex-wrap:wrap;gap:12px">${[1, 2, 3, 4, 5, 6].map((n) => `<div style="width:31%">${img(120, n === 2 ? '&#10003; verified' : 'cover')}<div class="muted">Note title ${n}</div></div>`).join('')}</div>`)],
  ['11_user_profile', "Another user's profile", app('Feed', `<div class="row box"><div class="av" style="width:80px;height:80px"></div><div class="col" style="flex:1"><h1>Dr Tan Wei Ming <span class="badge">&#10003;</span></h1><div class="muted">Lecturer · School of Computing · 9 notes</div>${L(1)}</div><span class="btn p">&#9993; Message</span></div>
    <div class="row" style="flex-wrap:wrap;gap:12px">${[1, 2, 3].map((n) => `<div style="width:31%">${img(120, 'cover')}<div class="muted">Public note ${n}</div></div>`).join('')}</div><div class="muted">Contacts-only notes appear here once you are contacts.</div>`)],
  ['12_edit_profile', 'Edit profile', app('Profile', `<h1>Edit profile</h1><div class="box col" style="width:520px"><div class="row"><div class="av" style="width:70px;height:70px"></div><span class="btn">Change picture (max 2 MB)</span></div>
    <div class="lbl">Display name</div><div class="inp">Lim Qi Cai</div><div class="lbl">Programme</div><div class="inp">BSc (Hons) Software Engineering &#9662;</div><div class="lbl">Bio (300 characters)</div><div class="inp" style="height:80px"></div><div class="row"><span class="btn">Cancel</span><span class="btn p">Save</span></div></div>`)],
  ['13_search_notes', 'Search results — notes with filters', app('Feed', `<div class="tabs"><div class="on">Notes (14)</div><div>People (2)</div></div>
    <div class="row box"><b>Filters:</b><span>[&#10003;] Lecturer content only</span><span>Published from [01/09/2026] to [13/10/2026]</span><span class="muted" style="margin-left:auto">14 results in 0.21 s</span></div>
    ${[1, 2, 3, 4].map((n) => `<div class="box row">${img(70, '').replace('class="img"', 'class="img" style="width:110px;height:70px"')}<div class="col" style="flex:1"><b>Result title ${n} ${n === 1 ? '<span class="note">&#10003; Verified</span>' : ''}</b><div class="muted">CT071-3-3 Database Systems · #normalisation · by Author</div>${L(1)}</div></div>`).join('')}`, '', '#normalisation')],
  ['14_search_people', 'Search results — people', app('Feed', `<div class="tabs"><div>Notes (14)</div><div class="on">People (2)</div></div>
    ${['Dr Tan Wei Ming — Lecturer', 'Tan Mei Ling — Student, Computer Science'].map((p) => `<div class="box row"><div class="av"></div><div class="col" style="flex:1"><b>${p}</b><div class="muted">Programme · notes count</div></div><span class="btn">View profile</span></div>`).join('')}`, '', 'tan')],
  ['15_saved', 'Saved notes', app('Saved', `<h1>Saved</h1><div class="row" style="flex-wrap:wrap;gap:12px">${[1, 2, 3, 4, 5, 6].map((n) => `<div class="box" style="width:31%">${img(110, 'cover')}<b>Saved note ${n}</b><div class="muted">Module · saved 2 d ago</div><div class="muted">&#128278; Remove</div></div>`).join('')}</div>`)],
  ['16_report_dialog', 'Report note dialog', modal(`<h2>Report this note</h2><div class="muted">Reason</div>${['Inaccurate content', 'Inappropriate content', 'Spam', 'Plagiarism (lecturers)', 'Copyright violation (lecturers)', 'Other'].map((r, i) => `<div>${i === 0 ? '(•)' : '( )'} ${r}</div>`).join('')}
    <div class="inp" style="height:70px">Details (optional, 500 characters)</div><div class="row" style="justify-content:flex-end"><span class="btn">Cancel</span><span class="btn p">Submit report</span></div>`, app('Feed', img(500, 'note (dimmed)')))],
  ['17_superlike_dialog', 'Super Like confirmation (lecturer)', modal(`<h2>&#9733; Super Like (verify) this note?</h2><div>Verifying tells students you have reviewed this note for accuracy. It will show a verified frame with your name and rank higher in feeds.</div>
    <div class="inp" style="height:70px">Review remark (optional)</div><div class="row" style="justify-content:flex-end"><span class="btn">Cancel</span><span class="btn p">Verify note</span></div>`, app('Feed', noteCard('Normalisation 1NF–3NF worked example')))],
  ['18_messages', 'Messages — conversation', app('Messages', `<div class="row" style="align-items:stretch;flex:1;gap:0"><div class="col box" style="width:260px;gap:0;padding:0">${['Aina Rahman', 'FYP Team (group)', 'Dr Tan Wei Ming', 'Tan Mei Ling'].map((c, i) => `<div class="row" style="padding:10px;border-bottom:1px solid #aaa;${i === 0 ? 'background:#ddd' : ''}"><div class="av"></div><div><b>${c}</b><div class="muted">last message…</div></div></div>`).join('')}</div>
    <div class="col box" style="flex:1"><b>Aina Rahman</b><div class="box row" style="width:60%"><div class="img" style="width:60px;height:45px">slide</div><div><b>&#128206; MVC vs MVP vs MVVM</b><div class="muted">CT046-3-M · note card</div></div></div><div class="bubble me">Hi, on slide 4 — why is the presenter not aware of the view?</div><div class="bubble">Good question, it talks to an interface…</div><div style="flex:1"></div><div class="row"><span class="btn">&#128206; Attach note</span><div class="inp" style="flex:1">Type a message…</div><span class="btn p">Send</span></div></div></div>`)],
  ['19_message_author', 'Message author from a note', modal(`<h2>Message Aina Rahman</h2><div class="box row"><div class="img" style="width:70px;height:50px">slide</div><div><b>&#128206; MVC vs MVP vs MVVM</b><div class="muted">This note will be attached to your message</div></div></div>
    <div class="inp" style="height:90px">Ask about this note…</div><div class="note">You are not contacts yet. Your message will be sent as a request and delivered when Aina accepts.</div><div class="row" style="justify-content:flex-end"><span class="btn">Cancel</span><span class="btn p">Send request</span></div>`, app('Feed', noteCard('MVC vs MVP vs MVVM — summary with examples')))],
  ['20_message_requests', 'Message requests', app('Message Requests', `<h1>Message requests (2)</h1><div class="muted">People who are not your contacts. They cannot see whether you have read their request.</div>
    ${['Hafiz Ismail', 'Chloe Wong'].map((p) => `<div class="box col"><div class="row"><div class="av"></div><b>${p}</b><span class="muted">2 h ago</span></div><div class="box row" style="width:55%"><div class="img" style="width:60px;height:45px">slide</div><div><b>&#128206; Database indexing notes</b></div></div>${L(1)}<div class="row"><span class="btn p">Accept</span><span class="btn">Decline</span></div></div>`).join('')}`)],
  ['21_new_group', 'Create group chat', modal(`<h2>New group chat</h2><div class="lbl">Group name</div><div class="inp">FYP Team — CT046 assignment</div><div class="lbl">Add contacts (at least 2)</div><div class="inp">Search contacts…</div>
    ${['Aina Rahman', 'Tan Mei Ling', 'Hafiz Ismail'].map((c, i) => `<div class="row"><span>[${i < 2 ? '&#10003;' : ' '}]</span><div class="av" style="width:26px;height:26px"></div>${c}</div>`).join('')}<div class="row" style="justify-content:flex-end"><span class="btn">Cancel</span><span class="btn p">Create</span></div>`, app('Messages', img(500, 'messages (dimmed)')))],
  ['22_group_chat', 'Group chat with settings', app('Messages', `<div class="row" style="align-items:stretch;flex:1"><div class="col box" style="flex:1"><div class="row"><b>FYP Team — CT046 assignment</b><span class="muted">4 members</span></div><div class="bubble"><b>Aina:</b> uploaded the class diagram notes</div><div class="box row" style="width:55%"><div class="img" style="width:60px;height:45px">slide</div><b>&#128206; Class diagram tips</b></div><div class="bubble me">Thanks, I'll do the sequence diagrams</div><div style="flex:1"></div><div class="row"><div class="inp" style="flex:1">Message the group…</div><span class="btn p">Send</span></div></div>`,
    `<h3>Group settings</h3><div class="lbl">Name</div><div class="inp">FYP Team — CT046</div><h3>Members</h3>${['You (owner)', 'Aina Rahman', 'Tan Mei Ling', 'Hafiz Ismail'].map((m) => `<div class="row"><div class="av" style="width:24px;height:24px"></div>${m}${m.startsWith('You') ? '' : '<span class="muted" style="margin-left:auto">remove</span>'}</div>`).join('')}<span class="btn">+ Add member</span><span class="btn">Leave group</span>`)],
  ['23_admin_reports', 'Admin — reported content', admin('Reports', `<h1>Open reports (5)</h1><table><tr><th>Note</th><th>Author</th><th>Reasons</th><th>Reports</th><th>Oldest</th><th>Action</th></tr>
    ${[['Copied lab answers', 'student_a', 'plagiarism, spam', 3], ['Wrong ER notation', 'student_b', 'inaccurate', 1], ['Ad for tutoring', 'student_c', 'spam', 1]].map((r) => `<tr><td><u>${r[0]}</u></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>2 d</td><td><u>Review</u></td></tr>`).join('')}</table>
    <div class="box col"><h3>Review: Copied lab answers</h3>${img(120, 'note preview')}<div class="muted">Reported by 3 users · details…</div><div class="inp">Resolution remark (required)</div><div class="row"><span class="btn">Dismiss</span><span class="btn p">Hide note</span><span class="btn">Hide + act on account</span></div></div>`)],
  ['24_admin_users', 'Admin — user management', admin('Users', `<div class="row"><h1>Users</h1><div class="inp" style="margin-left:auto;width:320px">Search name or email</div></div><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Upheld reports</th><th>Actions</th></tr>
    ${[['student_a', 'student', 'active', 3], ['Dr Tan', 'lecturer', 'active', 0], ['student_d', 'student', 'suspended', 5]].map((r) => `<tr><td>${r[0]}</td><td>…@mail.apu.edu.my</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td><u>Restrict</u> · <u>Suspend</u> · <u>Reinstate</u> · <u>Delete</u></td></tr>`).join('')}</table>
    <div class="box col" style="width:460px"><h3>Suspend student_a?</h3><div class="inp">Reason (required)</div><div class="row"><span class="btn">Cancel</span><span class="btn p">Confirm</span></div></div>`)],
  ['25_admin_lecturers', 'Admin — lecturer applications', admin('Lecturer Applications', `<h1>Lecturer applications (2)</h1><table><tr><th>Name</th><th>Email</th><th>Staff ID</th><th>Programme</th><th>Applied</th><th>Decision</th></tr>
    ${[['Dr Tan Wei Ming', 'tan.wm@…', 'S1234'], ['Ms Priya Nair', 'priya.n@…', 'S5678']].map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>School of Computing</td><td>1 d</td><td><span class="btn p">Approve</span> <span class="btn">Reject</span></td></tr>`).join('')}</table>
    <div class="muted">Approving sets the role to Lecturer, enabling Super Like and the lecturer badge. Rejecting keeps a student account and asks for a reason.</div>`)],
];

mkdirSync(new URL('./png/', import.meta.url), { recursive: true });
const browser = await chromium.launch();
for (const [id, , html] of screens) {
  const mobile = id.includes('mobile');
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  await page.setContent(`<style>${css}</style>${html}`);
  await page.screenshot({ path: fileURLToPath(new URL(`./png/${id}.png`, import.meta.url)) });
  await page.close();
}
await browser.close();
console.log(`rendered ${screens.length} wireframes`);
