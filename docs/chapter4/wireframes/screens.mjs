// Every PARP wireframe screen, in review order. build.mjs numbers them (NN_) from this order,
// renders PNG + SVG, and writes INDEX.md from the metadata passed to add().
import {
  I, VB, av, stack, LECT, xb, L, MODS, MUSIC, slide, cover, COVERS, tile, nav, util, app, title, backT, ftabs,
  CW, feedCard, rail, feedBody, comment, commentList, sbar, tabbar, mob, mTop, mobileFeed, ERAIL, editor, EW, EH, boardAt,
  searchIn, selBox, dlg, nrow, nthumb, notifDrawer, profileHead, person, searchTop, filterBar,
} from './lib.mjs';

export const screens = [];
// meta: { m: mobile, t: display name, refs: FR/UC/R covered, p: one-line purpose, v3: 'new' | note on what changed }
const add = (id, html, meta) => screens.push({ id, html, ...meta });

/* ================================================================== account + welcome (R31) */
const welcome = (o = {}) => `<div class="full" style="background:var(--s0)">
  <div style="height:72px;display:flex;align-items:center;padding:0 48px;box-shadow:inset 0 -1px 0 var(--line)"><div class="logo"><span class="mark">P</span>PARP</div>
    <div class="row" style="margin-left:auto"><span class="b g">About</span><span class="b">Log in</span><span class="b o">Register</span></div></div>
  <div style="position:absolute;left:96px;top:190px;width:620px;display:flex;flex-direction:column;gap:24px">
    <h1 style="font-size:60px;line-height:1.04;letter-spacing:-.045em;font-weight:700">Welcome to PARP</h1>
    <p style="font-size:19px;line-height:1.5;color:var(--ink2);max-width:540px">${L(26)}</p>
    <div class="row" style="gap:12px"><span class="b p lg">${I('eye', 18)}Browse as guest</span><span class="b lg">Log in</span><span class="b lg o">Register</span></div>
    <div class="help" style="font-size:13px">${L(14)}</div>
    <div class="col" style="gap:10px;margin-top:16px;font-size:15px;color:var(--ink2)">
      <div class="row" style="gap:10px">${VB(false, 20)}${L(8)}</div>
      <div class="row" style="gap:10px">${I('book', 20)}${L(8)}</div>
      <div class="row" style="gap:10px">${I('chat', 20)}${L(8)}</div></div></div>
  <div style="position:absolute;right:150px;top:96px;width:390px;height:844px;transform:scale(.88);transform-origin:top center;border-radius:48px;overflow:hidden;box-shadow:0 0 0 10px #4a4a4a">${mobileFeed('', { guest: true })}</div>
  <div style="position:absolute;left:96px;bottom:28px;font-size:12px;color:var(--ink3)">About · Help · Terms · Privacy · © 2026 PARP</div>${o.over || ''}</div>`;

add('welcome', welcome(), { t: 'Welcome page', refs: 'R31, UC01, UC02', v3: 'Changed: v2 landing merged into the R31 Welcome page (Browse as guest added)',
  p: 'First screen for signed-out visitors: Browse as guest, Log in or Register.' });

add('register', welcome({ over: dlg(500, 'Create your PARP account', `
  <div class="seg" style="align-self:flex-start"><span>${I('user', 16)}Student</span><span class="on">${I('book', 16)}Lecturer</span></div>
  <div class="fld"><label>Full name</label><div class="in v">Lee Chin Wei</div></div>
  <div class="fld"><label>APU email</label><div class="in v">lee.chinwei@apu.edu.my</div></div>
  <div class="fld"><label>Password</label><div class="in v">••••••••••••<span class="end muted">${I('eye', 18)}</span></div><span class="help">${L(9)}</span></div>
  <div class="fld"><label>Programme</label><div class="in v">BSc (Hons) Software Engineering<span class="end">${I('down', 16)}</span></div><span class="help">${L(9)}</span></div>
  <div class="fld"><label>Staff ID</label><div class="in v">S10482</div><span class="help">${L(18)}</span></div>
  <span class="b p lg w">Register</span><div class="muted" style="text-align:center">Already have an account? <b style="color:var(--ink)">Log in</b></div>`, '') }),
{ t: 'Register dialog', refs: 'UC01, UC22', p: 'Student or lecturer registration over the Welcome page; lecturer adds a staff ID for approval.' });

add('login', welcome({ over: dlg(440, 'Log in to PARP', `
  <div class="fld"><label>APU email</label><div class="in v">tp072229@mail.apu.edu.my</div></div>
  <div class="fld"><label>Password</label><div class="in er v">••••••••<span class="end muted">${I('eye', 18)}</span></div>
    <span class="err" role="alert">${I('info', 16)}Email or password is incorrect.</span></div>
  <span class="b p lg w">Log in</span>
  <div class="muted" style="text-align:center">Don't have an account? <b style="color:var(--ink)">Register</b></div>`, '') }),
{ t: 'Log in dialog (error state)', refs: 'UC02', p: 'Log in over the Welcome page, shown with the generic credentials error.' });

/* ================================================================== guest browsing (R31) */
add('guest_feed', app('Feed', feedBody(feedCard({ verified: 'Dr Lee', idx: 1 }), rail()), { guest: true, center: ftabs('Feed', ['Feed']) }),
  { t: 'Guest feed', refs: 'R31, UC09, FR11', v3: 'new',
    p: 'Signed-out Feed of public notes only; guest nav, Log in button in the header, no Following tab.' });

add('guest_note', app('Feed', `<div class="content">
  <div style="position:absolute;left:48px;top:0;width:560px;display:flex;flex-direction:column;gap:14px">
    <div class="row">${av('AR', 44, true)}<div><div style="font-weight:700;font-size:16px">Aina Rahman</div><div class="muted sm">BSc (Hons) Software Engineering · 2d ago</div></div><span class="b sm p" style="margin-left:auto">Follow</span><span class="ib s sm">${I('more', 18)}</span></div>
    <div style="position:relative;width:560px;height:700px;border-radius:16px;overflow:hidden;box-shadow:0 0 0 1px var(--s3)">${slide('norm')}
      <div class="sarr" style="left:10px;top:334px">${I('left', 18)}</div><div class="sarr" style="right:10px;top:334px">${I('right', 18)}</div></div></div>
  <div style="position:absolute;left:628px;top:56px;display:flex;flex-direction:column;gap:12px">${[['heart', '1.2K'], ['comment', '44', true], ['bookmark', '318'], ['share', 'Share']].map(([ic, c, on]) => `<div class="rb ${on ? 'on' : ''}"><span class="c">${I(ic, 22)}</span>${c}</div>`).join('')}</div>
  <div class="side" style="width:500px;top:0">
    <div style="padding:20px 24px 0;display:flex;flex-direction:column;gap:6px"><div style="font-size:18px;font-weight:700;letter-spacing:-.01em">Normalisation, 1NF to 3NF in one page</div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><span class="tag">${I('book', 13)}CT030-3-2 Database Systems</span><span class="tag">#normalisation</span><span class="tag">#sql</span><span class="tag" style="background:var(--ink);color:#fff">${I('check', 13)}Verified by Dr Lee</span></div></div>
    <div class="tabs" style="padding:0 24px;margin-top:10px"><span class="tab on">Comments 44</span><span class="tab">Annotations 6</span></div>
    <div style="padding:0 20px;flex:1;overflow:hidden">${commentList()}</div>
    <div class="inbar" style="padding:12px 20px 16px;box-shadow:inset 0 1px 0 var(--line)"><div class="in" style="flex:1;border-radius:999px">${I('lock', 16)}Log in to comment</div><span class="b p sm" style="height:40px">Log in</span></div></div></div>`,
  { guest: true, left: backT('Note'), right: '' }),
{ t: 'Guest note view with comments', refs: 'R31, UC11, FR16', v3: 'new',
  p: 'A guest opens a public note and reads its comments; the comment box is replaced by a Log in prompt.' });

{
  const sheet = `<div style="position:absolute;inset:0;background:rgba(40,40,40,.4);z-index:15"></div><div class="sheet" style="height:420px;z-index:20">
    <div class="grab"></div><span class="ib sm" style="position:absolute;right:10px;top:12px">${I('x', 18)}</span>
    <div style="padding:22px 24px 0;display:flex;flex-direction:column;gap:14px;align-items:center;text-align:center">
      <span style="width:56px;height:56px;border-radius:50%;background:var(--s2);display:grid;place-items:center">${I('heart', 28)}</span>
      <b style="font-size:20px;letter-spacing:-.02em">Log in to like this note</b>
      <span class="muted" style="font-size:14px;line-height:1.45">${L(16)}</span>
      <span class="b p lg w">Log in</span><span class="b lg w o">Register</span><span class="b g sm">Not now</span></div></div>`;
  add('guest_auth_sheet_mobile', mobileFeed(sheet, { guest: true }).replace(/<div class="tbar">[\s\S]*$/, '<div class="home" style="z-index:30"></div></div>'),
    { m: true, t: 'Log in / Register sheet (mobile)', refs: 'R31, UC01, UC02, UC10', v3: 'new',
      p: 'Tapping Like as a guest opens a bottom sheet; after logging in the visitor returns to the same note.' });
}

add('guest_search', app('Explore', `<div class="content" style="padding:0 32px;display:flex;flex-direction:column;gap:16px">
  <div class="tabs">${['Top', 'Notes', 'People', 'Hashtags', 'Modules'].map((t, k) => `<span class="tab ${k === 0 ? 'on' : ''}">${t}</span>`).join('')}</div>
  <div class="row" style="gap:8px"><span class="chip o">${I('filter', 15)}Filters</span><span class="chip o">Module: any ${I('down', 13)}</span><span class="muted sm" style="margin-left:auto">Public notes only · 31 results</span></div>
  <div class="row" style="justify-content:space-between"><b style="font-size:16px">People</b><span class="muted sm" style="font-weight:600">See all</span></div>
  <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:12px">${person('LC', 'Dr Lee Chin Wei', 'Lecturer · 1.8K followers', 'Follow', true, true)}${person('TM', 'Tan Mei Ling', 'Computer Science · 210 followers', 'Follow')}${person('AH', 'Aiman Hakim', 'Information Technology · 96', 'Follow')}</div>
  <div class="row" style="justify-content:space-between"><b style="font-size:16px">Notes</b><span class="muted sm" style="font-weight:600">See all</span></div>
  <div class="grid" style="grid-template-columns:repeat(6,1fr);gap:14px">${[COVERS[0], COVERS[9], COVERS[1], COVERS[5], COVERS[2], COVERS[3]].map((c, k) => tile(c, { cap: true, sub: ['Aina Rahman', 'Dr Lee Chin Wei', 'Chloe Wong', 'Lim Qi Cai', 'Dr Siti Aminah', 'Hafiz Ismail'][k] })).join('')}</div></div>`,
  { guest: true, left: searchTop('#normalisation') }),
{ t: 'Guest search results', refs: 'R31, UC14, FR4', v3: 'new',
  p: 'Guests search public notes, people and hashtags; Follow and other actions open the log in sheet.' });

add('guest_profile', app('Explore', `<div class="content" style="top:56px">${profileHead({ i: 'LC', dark: true, lect: true, n: 'Dr Lee Chin Wei', h: '@drlee', prog: 'Lecturer · School of Computing · CT030-3-2, CT046-3-M', c: ['41', '1.8K', '12.4K'],
  btns: `<span class="b p">${I('userPlus', 16)}Follow</span><span class="b">${I('msg', 16)}Message</span><span class="ib s">${I('share', 18)}</span>`, bio: L(22) })}
  <div class="tabs" style="margin:24px 48px 16px"><span class="tab on">${I('gridI', 18)}Notes</span></div>
  <div class="grid" style="grid-template-columns:repeat(6,1fr);gap:12px;padding:0 48px">${[COVERS[2], COVERS[0], COVERS[9], COVERS[5], COVERS[10], COVERS[7]].map((c) => tile(c)).join('')}</div></div>`, { guest: true }),
{ t: 'Guest view of a public profile', refs: 'R31, UC04', v3: 'new',
  p: 'Public profile as a guest sees it: public notes only, counts visible, Follow and Message prompt log in.' });

/* ================================================================== feed */
add('feed', app('Feed', feedBody(feedCard({ verified: 'Dr Lee', idx: 1 }), rail({ liked: true })), { center: ftabs() }),
  { t: 'Ranked feed (desktop)', refs: 'UC09, FR11, FR2, FR17', p: 'Home Feed: one note per card with slide progress, verified badge, caption, music and action rail.' });

add('feed_collapsed', app('Feed', feedBody(feedCard({ aspect: '16:9', kind: 'sort', author: 'Hafiz Ismail', title: 'Sorting algorithms compared', desc: `${L(6)} <b>#dsa</b> <b>#sorting</b>`, mod: MODS.ads, idx: 0, count: 4 }), rail({ superlike: true, av: 'HI', likes: '386', comments: '12', saves: '97' })),
  { collapsed: true, center: ftabs(), me: 'LC' }),
{ t: 'Feed, collapsed nav, lecturer view', refs: 'UC09, UC19, FR1', p: 'Icon-rail navigation, a letterboxed 16:9 note and the lecturer Super Like control.' });

{
  const panel = `<div class="side" style="width:440px">
  <div style="padding:16px 20px 0;display:flex;align-items:center;justify-content:space-between"><b style="font-size:17px">Comments 44</b><span class="ib sm">${I('x', 20)}</span></div>
  <div style="padding:0 20px;flex:1;overflow:hidden">${commentList()}</div>
  <div style="position:relative">
    <div class="pop" style="left:20px;right:20px;bottom:76px"><div class="muted sm" style="padding:6px 10px;font-weight:600">Mention someone</div>
      ${[['AR', 'Aina Rahman', '@ainarahman · in this thread'], ['AK', 'Arjun Kumar', '@arjunk · friend'], ['AH', 'Aiman Hakim', '@aimanh · friend']].map(([i, n, s], k) => `<div class="mi ${k === 0 ? 'on' : ''}">${av(i, 28)}<div><div style="font-weight:600">${n}</div><div class="muted sm">${s}</div></div></div>`).join('')}</div>
    <div class="inbar" style="box-shadow:inset 0 1px 0 var(--line)"><div class="in fo v" style="flex:1;border-radius:999px;height:44px">Lorem <span class="at">@ai</span><span style="width:1.5px;height:18px;background:var(--ink)"></span><span class="end muted">${I('at', 18)}${I('smile', 18)}</span></div><span class="b p sm" style="height:40px">Post</span></div></div></div>`;
  add('feed_comments', app('Feed', feedBody(feedCard({ verified: 'Dr Lee', idx: 2 }), rail({ liked: true, commentsOn: true }), { right: 440, noArrows: true }) + panel, { center: '' }),
    { t: 'Feed with comments panel', refs: 'UC11, FR16', p: 'Comments open beside the note: pinned lecturer comment, one reply level, @mention picker.' });
}

{
  const whyPop = `<div class="pop" style="left:${CW - 150}px;top:72px;width:380px;padding:18px;display:flex;flex-direction:column;gap:14px">
  <div class="row" style="justify-content:space-between"><b style="font-size:16px">Why you're seeing this note</b><span class="ib sm">${I('x', 18)}</span></div>
  <div class="muted" style="font-size:13px;margin-top:-6px">${L(14)}</div>
  ${[['Engagement', 'E', 0.71, 0.3], ['Recency', 'R', 0.84, 0.25], ['Lecturer validation', 'V', 1, 0.3], ['Hashtag match', 'M', 0.4, 0.15]].map(([n, k, v, w]) =>
    `<div style="display:flex;flex-direction:column;gap:6px"><div class="row" style="justify-content:space-between;font-size:14px"><b>${n} (${k})</b><span class="muted" style="font-size:13px">${v.toFixed(2)} × ${w.toFixed(2)} = <b style="color:var(--ink)">${(v * w).toFixed(2)}</b></span></div>
     <div style="height:8px;border-radius:4px;background:var(--s2)"><div style="height:8px;width:${v * 100}%;border-radius:4px;background:var(--acc)"></div></div><span class="muted sm">${L(5)}</span></div>`).join('')}
  <div class="row" style="justify-content:space-between;background:var(--s1);border-radius:10px;padding:10px 12px"><b>Score</b><b style="font-size:18px">0.78</b></div></div>`;
  add('feed_ranking', app('Feed', feedBody(feedCard({ aspect: '9:16', kind: 'stack', verified: 'Dr Lee', whyOn: true, author: 'Arjun Kumar', title: 'Stack vs queue, with real examples', desc: `${L(5)} <b>#dsa</b> <b>#stack</b>`, mod: MODS.ads, idx: 0, count: 5 }), rail({ av: 'AK', likes: '412', comments: '44', saves: '203' }), { pop: whyPop }), { center: ftabs() }),
    { t: '"Why this note?" ranking panel', refs: 'FR3, NFR5, UC09', p: 'Breakdown of the four ranking scores (E, R, V, M) with weights for the note on screen.' });
}

add('feed_mobile', mobileFeed(), { m: true, t: 'Ranked feed (mobile)', refs: 'UC09, FR11, NFR2', p: 'TikTok-style phone feed: Feed/Following tabs, floating action rail, caption and bottom tab bar.' });

{
  const mComments = `<div style="position:absolute;inset:0;background:rgba(40,40,40,.4);z-index:15"></div><div class="sheet" style="height:560px;bottom:0;z-index:20">
  <div class="grab"></div><div style="display:flex;justify-content:center;align-items:center;padding:10px 16px;position:relative"><b style="font-size:15px">44 comments</b><span class="ib sm" style="position:absolute;right:10px">${I('x', 18)}</span></div>
  <div style="padding:0 16px;flex:1;overflow:hidden;font-size:13px">${commentList({ short: true })}</div>
  <div style="padding:10px 12px 34px;display:flex;gap:8px;align-items:center;box-shadow:inset 0 1px 0 var(--line)">${av('LQ', 32)}<div class="in" style="flex:1;border-radius:999px;height:40px">Add comment…<span class="end">${I('at', 18)}${I('smile', 18)}</span></div></div></div>`;
  add('comments_mobile', mobileFeed(mComments).replace(tabbar('Home'), '<div class="home" style="z-index:30"></div>'),
    { m: true, t: 'Comments sheet (mobile)', refs: 'UC11, FR16, NFR2', p: 'Comments as a bottom sheet over the note, with the same pinned comment, replies and @mention.' });
}

{
  const annItem = (n, q, a, name, on) => `<div style="display:flex;gap:12px;padding:14px;border-radius:12px;background:#fff;${on ? 'box-shadow:inset 0 0 0 2px var(--ink)' : 'box-shadow:inset 0 0 0 1px var(--line)'}">
  <span style="width:24px;height:24px;border-radius:50%;background:var(--acc);color:#fff;font-size:12px;font-weight:700;display:grid;place-items:center;flex:none">${n}</span>
  <div style="flex:1;display:flex;flex-direction:column;gap:6px"><div style="font-size:13px;color:var(--ink2);background:var(--s1);border-radius:8px;padding:6px 10px">Slide 2 · “${q}”</div>
    <div class="row" style="gap:8px">${av(a, 24, a === 'LC')}<span style="font-size:13px;font-weight:600;display:flex;gap:6px;align-items:center">${name}</span></div><div style="font-size:14px;line-height:1.4">${L(15)}</div>
    <div class="muted sm" style="display:flex;gap:14px"><span>2d</span><b>Reply</b><b>Report</b></div></div></div>`;
  add('note_detail', app('Feed', `<div class="content">
  <div style="position:absolute;left:48px;top:0;width:560px;display:flex;flex-direction:column;gap:14px">
    <div class="row">${av('AR', 44, true)}<div><div style="font-weight:700;font-size:16px">Aina Rahman</div><div class="muted sm">BSc (Hons) Software Engineering · 2d ago</div></div><span class="b sm p" style="margin-left:auto">Follow</span><span class="ib s sm">${I('more', 18)}</span></div>
    <div style="position:relative;width:560px;height:700px;border-radius:16px;overflow:hidden;box-shadow:0 0 0 1px var(--s3)">${slide('norm', { hl: true })}
      <div class="sarr" style="left:10px;top:334px">${I('left', 18)}</div><div class="sarr" style="right:10px;top:334px">${I('right', 18)}</div>
      <div class="pop" style="left:150px;top:256px;padding:4px;display:flex;gap:2px"><span class="tb2 on">${I('pencil', 16)}Annotate</span><span class="tb2">${I('copy', 16)}Copy</span></div>
      <div style="position:absolute;bottom:12px;left:0;right:0;display:flex;justify-content:center;gap:6px">${[0, 1, 0, 0, 0, 0].map((x) => `<span style="width:${x ? 18 : 7}px;height:7px;border-radius:4px;background:${x ? 'var(--ink)' : 'var(--s3)'}"></span>`).join('')}</div></div></div>
  <div style="position:absolute;left:628px;top:56px;display:flex;flex-direction:column;gap:12px">${[['heartF', '1.2K', true], ['comment', '44'], ['pencil', '6'], ['bookmark', '318'], ['share', 'Share']].map(([ic, c, on]) => `<div class="rb ${on ? 'on' : ''}"><span class="c">${I(ic, 22)}</span>${c}</div>`).join('')}</div>
  <div class="side" style="width:500px;top:0">
    <div style="padding:20px 24px 0;display:flex;flex-direction:column;gap:6px"><div style="font-size:18px;font-weight:700;letter-spacing:-.01em">Normalisation, 1NF to 3NF in one page</div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><span class="tag">${I('book', 13)}CT030-3-2 Database Systems</span><span class="tag">#normalisation</span><span class="tag">#sql</span><span class="tag" style="background:var(--ink);color:#fff">${I('check', 13)}Verified by Dr Lee</span></div></div>
    <div class="tabs" style="padding:0 24px;margin-top:10px"><span class="tab">Comments 44</span><span class="tab on">Annotations 6</span></div>
    <div style="padding:14px 20px;display:flex;flex-direction:column;gap:10px;flex:1;overflow:hidden">
      <div class="row muted sm" style="justify-content:space-between"><span>${L(7)}</span><span class="chip o" style="height:28px">Slide 2 ${I('down', 14)}</span></div>
      ${annItem(1, 'Lorem ipsum', 'LC', `Dr Lee Chin Wei ${LECT}`, true)}${annItem(2, 'adipiscing elit', 'TM', 'Tan Mei Ling')}${annItem(3, 'quis nostrud', 'HI', 'Hafiz Ismail')}</div>
    <div class="inbar" style="padding:12px 20px 16px;box-shadow:inset 0 1px 0 var(--line)"><div class="in" style="flex:1;border-radius:999px">Add an annotation…</div><span class="b p sm" style="height:40px">Add</span></div></div></div>`, { left: backT('Note'), right: '' }),
  { t: 'Note detail with annotations', refs: 'FR18, UC11', p: 'Reading view with text-anchored annotations numbered on the slide and listed in a side panel.' });
}

/* ================================================================== collaboration on notes (R30) */
add('coauthor_note', app('Following', feedBody(feedCard({ verified: 'Dr Lee', idx: 0, coauthors: [['LQ', 'Lim Qi Cai'], ['HI', 'Hafiz Ismail']], title: 'MVC in five minutes', kind: 'mvc', mod: MODS.se, desc: `${L(6)} <b>#mvc</b> <b>#aict004</b>` }), rail({ coav: ['AR', 'LQ', 'HI'], likes: '640', comments: '31', saves: '152' })), { center: ftabs('Following') }),
  { t: 'Co-authored note card', refs: 'R30, UC09', v3: 'new',
    p: 'A note credits its owner and co-authors on the card and rail; it reaches each co-author\'s followers in Following.' });

add('request_collab', app('Feed', feedBody(feedCard({ verified: 'Dr Lee', idx: 1 }), rail({ moreOn: true }), {
  pop: `<div class="pop" style="left:${CW + 80}px;bottom:0;width:240px">${[['users', 'Request to collaborate'], ['link', 'Copy link'], ['flag', 'Report']].map(([ic, t], k) => `<div class="mi ${k === 0 ? 'on' : ''}">${I(ic, 18)}${t}</div>`).join('')}</div>` }),
{ center: ftabs(), me: 'CW', over: dlg(480, 'Request to collaborate', `<div class="li" style="background:var(--s1);padding:10px"><div style="width:48px;height:60px;border-radius:6px;overflow:hidden;flex:none;box-shadow:0 0 0 1px var(--s3)">${slide('norm')}</div><div class="t"><div class="n">Normalisation, 1NF to 3NF in one page</div><div class="s">Aina Rahman · CT030-3-2 · 6 slides</div></div></div>
    <div class="muted" style="margin-top:-4px">${L(18)}</div>
    <div class="fld"><label>Message to the owner <span class="muted" style="font-weight:400">optional</span></label><div class="in v ta">${L(14)}</div><span class="help" style="text-align:right">72 / 300</span></div>`,
  `<span class="b">Cancel</span><span class="b p">${I('send', 16)}Send request</span>`) }),
{ t: 'Request to collaborate', refs: 'R30', v3: 'new',
  p: 'From a note\'s More menu a viewer asks the owner to become a co-author, with an optional message.' });

add('edited_since_verification', app('Feed', feedBody(feedCard({ edited: true, idx: 1, title: 'Normalisation, 1NF to 3NF in one page' }), rail({ superlike: 'on', superlikeLabel: 'Re-confirm', liked: true }), {
  pop: `<div class="pop" style="left:12px;top:60px;width:380px;padding:18px;display:flex;flex-direction:column;gap:12px">
    <div class="row" style="gap:10px">${I('warn', 22)}<b style="font-size:16px">Edited since verification</b></div>
    <div class="muted" style="font-size:13px">${L(22)}</div>
    <div class="row sm" style="gap:8px;background:var(--s1);border-radius:10px;padding:10px 12px">${av('LC', 28, true)}<span><b>Super Liked by you</b> · 12 Sep</span><span class="muted" style="margin-left:auto">Edited 14 Oct</span></div>
    <div class="row" style="justify-content:flex-end;gap:8px"><span class="b sm">Remove Super Like</span><span class="b sm p">${I('starF', 14)}Re-confirm</span></div></div>` }), { collapsed: true, center: ftabs(), me: 'LC' }),
{ t: '"Edited since verification" state', refs: 'R30, FR1, FR2, UC19', v3: 'new',
  p: 'After a content edit the verified badge becomes "Edited since verification" until the lecturer re-confirms.' });

/* ================================================================== slide editor */
{
  const b = boardAt(800, 450, `<div style="position:absolute;inset:0;display:grid;place-items:center;color:var(--ink3);text-align:center"><div class="col" style="align-items:center;gap:8px">${I('layout', 32)}<b style="font-size:16px;color:var(--ink2)">Empty slide</b><span>${L(9)}</span></div></div>`);
  const layouts = [['Title', 'b'], ['Title and bullets', 'a'], ['Two columns', 'c'], ['Definition', 'd'], ['Diagram', 'c'], ['Code walkthrough', 'b']];
  add('editor_templates', editor({ rail: 'Templates', bar: { title: 'Untitled note', aspect: '16:9 Widescreen' },
    panel: `${searchIn('Search templates')}<div class="seg" style="align-self:flex-start"><span class="on">Slide layouts</span><span>Deck themes</span></div>
      <h4>Slide layouts <span>This slide</span></h4>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">${layouts.map(([t, v]) => `<div><div class="tpl" style="aspect-ratio:16/9">${cover(t === 'Definition' ? 'Term' : t, v, '')}</div><div class="sm" style="font-weight:600;margin-top:4px">${t}</div></div>`).join('')}</div>
      <h4>Deck themes <span>All slides</span></h4>
      <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:8px">${[['Plain', 'a'], ['Chalk', 'b'], ['Paper', 'c']].map(([t, v]) => `<div><div class="tpl" style="aspect-ratio:16/9">${cover(t, v, '')}</div><div class="sm" style="font-weight:600;margin-top:4px">${t}</div></div>`).join('')}</div>`,
    board: b.html, bottom: { aspect: '16:9', thumbs: ['blank'], cur: 0, zoom: '78%' } }),
  { t: 'Editor: templates on an empty note', refs: 'UC05, FR8', p: 'Canva-style editor shell; layouts for one slide and themes for the deck.' });
}

{
  const W = 448, H = 560;
  const b = boardAt(W, H, `<div style="position:absolute;inset:0">${slide('norm')}</div>`, { top: 64 });
  const tx = b.x + 31, ty = b.y + 64, tw = W - 62, th = 74;
  const fonts = [['Source Sans 3', 'Sans · default'], ['Atkinson Hyperlegible', 'Sans · high legibility'], ['Lora', 'Serif'], ['Merriweather', 'Serif'], ['Montserrat', 'Display'], ['JetBrains Mono', 'Code only']];
  const textToolbar = `<span class="tb2 dd" style="width:150px;justify-content:space-between">Source Sans 3 ${I('down', 14)}</span><span class="tb2 dd">${I('minus', 14)}<b style="width:26px;text-align:center">32</b>${I('plus', 14)}</span>
  <span class="tb2" title="Text colour"><span style="display:flex;flex-direction:column;align-items:center;font-weight:700;font-size:15px;line-height:1">A<span style="width:16px;height:4px;border-radius:2px;background:var(--ink)"></span></span></span>
  <span class="tb2 on">${I('bold', 18)}</span><span class="tb2">${I('italic', 18)}</span><span class="tb2">${I('under', 18)}</span><span class="tb2">${I('strike', 18)}</span><span class="sep"></span>
  <span class="tb2">${I('alignL', 18)}</span><span class="tb2">${I('list', 18)}</span><span class="tb2">${I('spacing', 18)}</span><span class="sep"></span>
  <span class="tb2">${I('sparkle', 16)}Effects</span><span class="tb2">${I('layers', 16)}Position</span><span class="sep"></span><span class="tb2">${I('lock', 18)}</span><span class="tb2">${I('copy', 18)}</span><span class="tb2">${I('trash', 18)}</span>`;
  add('editor_text', editor({ rail: 'Text',
    panel: `${searchIn('Search fonts and styles')}<span class="b p w">${I('type', 18)}Add a text box</span>
      <h4>Default text styles</h4>
      <div class="col" style="gap:8px"><div class="in v" style="height:56px;font-size:24px;font-weight:700;letter-spacing:-.02em">Add a heading</div><div class="in v" style="height:48px;font-size:18px;font-weight:600">Add a subheading</div><div class="in v" style="height:44px">Add body text</div></div>
      <h4>Text presets <span>Font pairs</span></h4>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">${[['Definition'], ['Key point'], ['Code'], ['Quote']].map(([a], k) => `<div style="border-radius:10px;background:var(--s1);padding:14px;height:86px;display:flex;flex-direction:column;gap:4px;justify-content:center"><b style="font-size:${k === 1 ? 18 : 15}px;${k === 2 ? 'font-family:Consolas,monospace' : ''}${k === 3 ? ';font-family:Georgia,serif;font-style:italic' : ''}">${a}</b><span class="muted sm">${L(3)}</span></div>`).join('')}</div>`,
    ctx: textToolbar,
    board: b.html + selBox(tx, ty, tw, th) +
      `<div class="guide" style="left:${b.x + W / 2}px;top:${b.y}px;width:1px;height:${H}px;opacity:.55"></div><span class="gl" style="left:${b.x + W / 2 + 6}px;top:${b.y + 8}px">Centre</span>
       <div class="pop" style="left:70px;top:66px;width:280px"><div class="in" style="height:36px;margin:4px 4px 6px">${I('search', 16)}Search fonts</div>
        ${fonts.map(([f, s], i) => `<div class="mi ${i === 0 ? 'on' : ''}" style="min-height:44px"><div><div style="font-weight:600;${f === 'Lora' || f === 'Merriweather' ? 'font-family:Georgia,serif' : ''}${f === 'JetBrains Mono' ? 'font-family:Consolas,monospace' : ''}">${f}</div><div class="muted sm">${s}</div></div>${i === 0 ? `<span class="k">${I('check', 16)}</span>` : ''}</div>`).join('')}
        <div class="muted sm" style="padding:6px 10px">${L(6)}</div></div>`,
  }), { t: 'Editor: text selected, curated fonts', refs: 'UC05, FR8', p: 'Text box selected with handles, centre guide, contextual text toolbar and the short curated font list.' });
}

{
  const W = 448, H = 560;
  const b = boardAt(W, H, `<div class="sl" style="position:absolute;inset:0"><div class="sp"><div class="k">CT060-3-2 · Week 3</div><h3>TCP handshake</h3>
      <div style="height:50cqw"></div><div class="p">${L(12)}</div></div></div>`, { top: 64 });
  const ix = b.x + 32, iy = b.y + 120, iw = W - 64, ih = 200;
  add('editor_photos', editor({ rail: 'Photos', bar: { title: 'TCP vs UDP' },
    panel: `${searchIn('<span style="color:var(--ink)">network cables</span>')}<div class="row" style="gap:6px;flex-wrap:wrap"><span class="chip on">Photos</span><span class="chip">Diagrams</span><span class="chip">Campus</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${[120, 90, 80, 120, 110, 100, 90, 70].map((h) => xb(`height:${h}px;border-radius:8px`)).join('')}</div>
      <div class="muted sm" style="margin-top:auto">Photos from Unsplash · ${L(6, false)}</div>`,
    ctx: `<span class="tb2 dd">${I('image', 16)}Replace</span><span class="sep"></span><span class="tb2 on">${I('crop', 18)}Crop</span><span class="tb2">${I('flip', 18)}Flip ${I('down', 12)}</span><span class="tb2">${I('drop', 18)}Transparency</span><span class="tb2">${I('sparkle', 16)}Effects</span><span class="sep"></span><span class="tb2">${I('layers', 16)}Position</span><span class="tb2">${I('lock', 18)}</span><span class="tb2">${I('copy', 18)}</span><span class="tb2">${I('trash', 18)}</span>`,
    board: b.html + xb(`position:absolute;left:${ix}px;top:${iy}px;width:${iw}px;height:${ih}px;background-color:#fff`)
      + `<div style="position:absolute;left:${ix}px;top:${iy + ih - 22}px;font-size:10px;color:#fff;background:var(--ink2);padding:2px 6px;border-radius:0 4px 0 0">Photo: Taylor Vick, Unsplash</div>` + selBox(ix, iy, iw, ih, { vh: true })
      + `<div class="pop" style="left:${ix + iw / 2 - 150}px;top:${iy + ih + 96}px;width:300px;padding:14px;display:flex;flex-direction:column;gap:10px"><div class="row" style="justify-content:space-between"><b>Transparency</b><span class="in v" style="min-height:30px;height:30px;width:58px;justify-content:center">80</span></div><div class="zoom" style="width:100%"></div></div>`,
    bottom: { thumbs: ['cover:TCP vs UDP', 'img', 'blank', 'blank'], cur: 1 },
  }), { t: 'Editor: photos and image tools', refs: 'UC05, FR8', p: 'Stock photo search with automatic Unsplash credit; image toolbar with transparency open.' });
}

{
  const W = 448, H = 560;
  const b = boardAt(W, H, `<div style="position:absolute;inset:0">${slide('norm')}</div>`, { top: 24 });
  const track = (t, a, on, playing) => `<div class="li ${on ? 'on' : ''}" style="padding:8px">
    <div style="width:48px;height:48px;border-radius:8px;background:var(--s3);display:grid;place-items:center;color:var(--ink2)">${I(playing ? 'pause' : 'play', 18)}</div>
    <div class="t"><div class="n">${t}</div><div class="s">${a} · 0:30 preview</div>${playing ? '<div style="height:4px;border-radius:2px;background:var(--s3);margin-top:6px"><div style="width:38%;height:4px;border-radius:2px;background:var(--ink)"></div></div>' : ''}</div>
    ${on ? `<span class="chip on" style="height:28px">${I('check', 14)}Added</span>` : '<span class="chip o" style="height:28px">Use</span>'}</div>`;
  add('editor_music', editor({ rail: 'Music',
    panel: `${searchIn('<span style="color:var(--ink)">lofi study</span>')}<div class="muted sm" style="margin-top:-4px">${L(12)}</div>
      <div style="border-radius:12px;background:var(--s1);padding:12px;display:flex;flex-direction:column;gap:6px"><b class="sm" style="font-size:12px;color:var(--ink3)">On this note</b>
        <div class="row" style="gap:10px"><div style="width:40px;height:40px;border-radius:8px;background:var(--s3);display:grid;place-items:center">${I('music', 18)}</div><div style="flex:1"><b>Track title</b><div class="muted sm">Artist · loops behind every slide</div></div><span class="ib sm">${I('trash', 18)}</span></div>
        <div class="row sm" style="gap:8px">${I('vol', 16)}<span>Volume</span><div class="zoom" style="flex:1"></div></div></div>
      <h4>Results <span>Jamendo</span></h4>
      <div class="list" style="gap:2px">${track('Track title', 'Artist', true, true)}${['Track title', 'Track title', 'Track title', 'Track title'].map((t) => track(t, 'Artist')).join('')}</div>`,
    board: b.html + `<div class="pop" style="left:${b.x + W - 200}px;top:${b.y + H - 64}px;padding:6px 10px;display:flex;align-items:center;gap:8px;border-radius:999px;font-size:13px;font-weight:600">${I('music', 16)}Track title ${I('pause', 14)}</div>`,
  }), { t: 'Editor: background music', refs: 'UC05, FR17', v3: 'Changed: catalogue label Deezer to Jamendo (D43)', p: 'Search the music catalogue, preview 30 seconds, attach one track with a volume control.' });
}

{
  const W = 448, H = 560;
  const b = boardAt(W, H, `<div style="position:absolute;inset:0">${slide('mvc')}</div>`, { top: 64 });
  const sx = b.x + 165, sy = b.y + 124;
  const shapes = ['square', 'circle', 'tri', 'line', 'arrowR', 'minus'];
  add('editor_elements', editor({ rail: 'Elements', bar: { title: 'MVC in five minutes', resizeOn: true },
    panel: `${searchIn('Search elements')}
      <h4>Shapes</h4><div class="grid" style="grid-template-columns:repeat(6,1fr);gap:8px">${shapes.map((s) => `<div style="aspect-ratio:1;border-radius:10px;background:var(--s1);display:grid;place-items:center;color:var(--ink2)">${I(s, 24)}</div>`).join('')}</div>
      <h4>Lines and dividers</h4><div class="grid" style="grid-template-columns:repeat(3,1fr);gap:8px">${['solid', 'dashed', 'arrow'].map((s) => `<div style="height:48px;border-radius:10px;background:var(--s1);display:grid;place-items:center"><div style="width:60%;height:0;border-top:2.5px ${s === 'dashed' ? 'dashed' : 'solid'} var(--ink2)"></div></div>`).join('')}</div>
      <h4>Blocks</h4><div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
        <div style="border-radius:10px;background:var(--s1);padding:12px;display:flex;flex-direction:column;gap:6px;height:96px"><div class="row" style="gap:6px;font-weight:600">${I('code', 18)}Code block</div><div style="font:12px/1.4 Consolas,monospace;color:var(--ink2)">SELECT * FROM<br>"NOTE_T";</div></div>
        <div style="border-radius:10px;background:var(--s1);padding:12px;display:flex;flex-direction:column;gap:6px;height:96px"><div class="row" style="gap:6px;font-weight:600">${I('table', 18)}Table</div><div class="muted sm">${L(6)}</div></div></div>`,
    ctx: `<span class="tb2" title="Fill"><span style="width:20px;height:20px;border-radius:6px;background:var(--ink2)"></span>Fill</span><span class="tb2">${I('border', 18)}Border</span><span class="tb2 dd">2 px ${I('down', 12)}</span><span class="tb2">Corner 8</span><span class="sep"></span><span class="tb2">${I('type', 16)}Add text</span><span class="tb2">${I('drop', 18)}</span><span class="tb2">${I('layers', 16)}Position</span><span class="sep"></span><span class="tb2">${I('lock', 18)}</span><span class="tb2">${I('copy', 18)}</span><span class="tb2">${I('trash', 18)}</span>`,
    board: b.html + selBox(sx, sy, 116, 54),
    ctxStyle: 'left:auto;right:16px;transform:none',
    over: `<div class="pop" style="left:497px;top:52px;width:270px;padding:14px;display:flex;flex-direction:column;gap:10px">
        <b>Slide size</b><span class="muted sm" style="margin-top:-6px">${L(8)}</span>
        ${[['4:5', 'Portrait', 36, 45], ['9:16', 'Full screen', 27, 48], ['16:9', 'Widescreen', 56, 32]].map(([r, n, w, h], k) =>
          `<div class="li ${k === 0 ? 'on' : ''}" style="padding:10px"><div style="width:60px;display:grid;place-items:center"><div style="width:${w}px;height:${h}px;border-radius:4px;box-shadow:inset 0 0 0 2px var(--ink2);background:#fff"></div></div><div class="t"><div class="n">${r} ${n}</div><div class="s">${L(3)}</div></div>${k === 0 ? I('check', 18) : ''}</div>`).join('')}
        <div class="row" style="justify-content:flex-end"><span class="b sm">Cancel</span><span class="b sm p">Resize</span></div></div>`,
    bottom: { thumbs: ['mvc', 'mvc', 'blank', 'blank', 'blank'], cur: 0 },
  }), { t: 'Editor: elements, shapes and slide size', refs: 'UC05, FR8', p: 'Shapes, lines, code block and table; shape toolbar; slide size menu (4:5, 9:16, 16:9).' });
}

{
  const W = 360, H = 450;
  const b = boardAt(W, H, `<div style="position:absolute;inset:0">${slide('norm')}</div>`, { top: 20, wsH: EH - 80 });
  add('editor_uploads', editor({ rail: 'Uploads',
    panel: `<span class="b p w">${I('upload', 18)}Upload files</span>
      <div style="border-radius:12px;background:var(--s1);padding:22px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;border:2px dashed var(--s3)">${I('image', 28)}<b>Drop images here</b><span class="muted sm">JPEG, PNG or WebP, up to 5 MB</span></div>
      <div style="border-radius:12px;background:#fff;box-shadow:inset 0 0 0 2px var(--ink2);padding:12px;display:flex;gap:10px" role="alert">${I('info', 20)}<div><b class="sm" style="font-size:13px">er_diagram_full.png was not added</b><div class="muted sm">${L(10)}</div></div></div>
      <h4>Your uploads <span>12</span></h4>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">${Array.from({ length: 9 }, () => xb('aspect-ratio:1;border-radius:8px')).join('')}</div>`,
    board: b.html, bottom: { notes: true },
  }), { t: 'Editor: uploads and page notes', refs: 'UC05, FR8', p: 'Own image uploads with an oversized-file error; private page notes open under the slide.' });
}

add('editor_mobile', `<div class="m" style="background:var(--s2)">${sbar}
  <div style="height:52px;display:flex;align-items:center;gap:6px;padding:0 10px;background:#fff"><span class="ib sm">${I('left', 22)}</span><b style="font-size:15px;flex:1;white-space:nowrap;overflow:hidden">Normalisation, 1NF to 3NF</b><span class="ib sm">${I('undo', 20)}</span><span class="ib sm">${I('users', 20)}</span><span class="b sm p">Publish</span></div>
  <div style="position:absolute;top:116px;left:20px;width:350px;height:438px;background:#fff;box-shadow:0 0 0 1px var(--s3)">${slide('norm')}</div>
  ${selBox(20 + 24, 116 + 50, 302, 58)}
  <div style="position:absolute;top:574px;left:0;right:0;display:flex;justify-content:center;gap:8px">${[0, 1, 2, 3].map((k) => `<div class="thm ${k === 1 ? 'on' : ''}" style="width:40px;height:50px">${k === 1 ? slide('norm') : k === 0 ? cover('Normalisation', 'b') : ''}</div>`).join('')}<div class="addp" style="width:40px;height:50px">${I('plus', 18)}</div></div>
  <div style="position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:16px 16px 0 0;box-shadow:0 0 0 1px var(--s3);padding-bottom:30px">
    <div style="display:flex;gap:4px;padding:10px 10px 8px;overflow:hidden;box-shadow:inset 0 -1px 0 var(--line)"><span class="tb2 dd" style="white-space:nowrap">Source Sans 3 ${I('down', 12)}</span><span class="tb2 dd">32</span><span class="tb2"><b style="font-size:15px">A</b></span><span class="tb2 on">${I('bold', 18)}</span><span class="tb2">${I('italic', 18)}</span><span class="tb2">${I('alignL', 18)}</span><span class="tb2">${I('more', 18)}</span></div>
    <div style="display:flex;justify-content:space-around;padding:10px 4px 0">${ERAIL.map(([n, ic], k) => `<div class="er ${k === 2 ? 'on' : ''}" style="width:50px;height:56px;font-size:10px">${I(ic, 22)}${n === 'Background' ? 'Bkgd' : n === 'Templates' ? 'Layouts' : n}</div>`).join('')}</div></div>
  <div class="home"></div></div>`,
{ m: true, t: 'Slide editor (mobile)', refs: 'UC05, FR8, NFR2', p: 'Board-first phone editor with tools in a bottom tray and a compact text formatting row.' });

{
  const W = 448, H = 560;
  const vis = [['globe', 'Public'], ['friends', 'Friends only'], ['lock', 'Private draft']];
  const body = `<div style="display:flex;gap:20px">
    <div style="width:180px;flex:none;display:flex;flex-direction:column;gap:8px"><div style="width:180px;height:225px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px var(--s3)">${slide('norm')}</div><span class="muted sm">6 slides · 4:5 Portrait</span></div>
    <div style="flex:1;display:flex;flex-direction:column;gap:16px">
      <div class="fld"><label>Who can see this note</label><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">${vis.map(([ic, n], k) => `<div style="border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:6px;background:${k === 0 ? '#fff' : 'var(--s1)'};box-shadow:inset 0 0 0 ${k === 0 ? '2px var(--ink)' : '1px var(--line)'}"><div class="row" style="justify-content:space-between">${I(ic, 22)}<span class="radio ${k === 0 ? 'on' : ''}"></span></div><b>${n}</b><span class="muted sm" style="line-height:1.4">${L(7)}</span></div>`).join('')}</div></div>
      <div class="fld"><label>Module</label><div class="in v">${I('book', 18)}CT030-3-2 Database Systems<span class="end">${I('down', 16)}</span></div></div>
      <div class="fld"><label>Hashtags <span class="muted" style="font-weight:400">3 of 5</span></label><div class="in fo v" style="flex-wrap:wrap;gap:6px;padding:8px 10px"><span class="tag">#normalisation ${I('x', 12)}</span><span class="tag">#sql ${I('x', 12)}</span><span class="tag">#ct030 ${I('x', 12)}</span><span>#erd</span><span style="width:1.5px;height:18px;background:var(--ink)"></span></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="fld"><label>Slide size</label><div class="seg"><span class="on">4:5</span><span>9:16</span><span>16:9</span></div></div>
        <div class="fld"><label>Background music</label><div class="in v" style="height:40px">${I('music', 16)}Track title<span class="end muted">${I('x', 14)}</span></div></div></div></div></div>`;
  add('publish_dialog', editor({ rail: 'Templates', panel: false, board: boardAt(W, H, `<div style="position:absolute;inset:0">${slide('norm')}</div>`, { wsW: 1364, top: 64 }).html, bottom: { left: 76 },
    over: dlg(820, 'Publish note', body, `<span class="b">Cancel</span><span class="b p">${I('upload', 16)}Publish</span>`) }),
  { t: 'Publish dialog', refs: 'UC07, FR10', v3: 'Changed: "Contacts only" renamed "Friends only"', p: 'Visibility (Public, Friends only, Private draft) with equal weight, plus module, hashtags, size and music.' });
}

/* ---------- R30: share dialog and soft lock */
{
  const W = 448, H = 560;
  const linkRow = (ic, name, url, on, extra) => `<div style="display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:var(--s1)">
    <div class="row" style="gap:10px">${I(ic, 20)}<div style="flex:1"><b>${name}</b><div class="muted sm">${L(6)}</div></div><span class="tog ${on ? 'on' : ''}"></span></div>
    <div class="row" style="gap:8px"><div class="in v" style="flex:1;min-height:36px;height:36px;background:#fff;font-size:13px">${I('link', 16)}${url}</div><span class="b sm o">${I('copy', 14)}Copy</span>${extra || ''}</div></div>`;
  const person = (i, n, s, role, k) => `<div class="row" style="gap:10px">${av(i, 36, k === 0)}<div style="flex:1"><div style="font-weight:600">${n}</div><div class="muted sm">${s}</div></div>${role}</div>`;
  const roleDd = (r) => `<span class="chip o" style="height:30px">${r} ${I('down', 12)}</span>`;
  const body = `<div class="fld"><label>Invite people</label><div class="row" style="gap:8px"><div class="in fo v" style="flex:1;flex-wrap:wrap;gap:6px;padding:6px 10px"><span class="tag">Tan Mei Ling ${I('x', 12)}</span>${I('search', 16)}<span class="muted">Search name or @username</span></div>${roleDd('Can edit')}<span class="b p sm" style="height:44px">Invite</span></div></div>
    <div class="fld"><label>People with access</label><div class="col" style="gap:10px">
      ${person('LQ', 'Lim Qi Cai (you)', 'Owner', '<span class="muted sm" style="font-weight:600">Owner</span>', 0)}
      ${person('AR', 'Aina Rahman', 'Co-author · invited 2 Oct', roleDd('Can edit'), 1)}
      ${person('HI', 'Hafiz Ismail', 'Joined with the edit link', roleDd('Can edit'), 2)}
      ${person('CW', 'Chloe Wong', 'Request approved 12 Oct', roleDd('Can view'), 3)}</div></div>
    <div class="fld"><label>Links</label><div class="col" style="gap:8px">
      ${linkRow('eye', 'View link', 'parp.app/n/8f3k2q/view?t=V7…', true)}
      ${linkRow('pencil', 'Edit link', 'parp.app/n/8f3k2q/edit?t=E2…', true, `<span class="b sm o">${I('rotate', 14)}Regenerate</span><span class="b sm o">${I('x', 14)}Revoke</span>`)}</div></div>
    <div class="help">${L(16)}</div>`;
  add('share_dialog', editor({ rail: 'Templates', panel: false, bar: { shareOn: true, people: ['LQ', 'AR', 'HI'] }, board: boardAt(W, H, `<div style="position:absolute;inset:0">${slide('norm')}</div>`, { wsW: 1364, top: 64 }).html, bottom: { left: 76 },
    over: dlg(620, 'Share “Normalisation, 1NF to 3NF”', body, '<span class="b p">Done</span>') }),
  { t: 'Share dialog (owner)', refs: 'R30, UC08', v3: 'new',
    p: 'Owner invites users as viewer or editor, manages people with access, and copies, regenerates or revokes view and edit links.' });

  const lockBanner = `<div class="banner" style="position:absolute;left:50%;top:14px;transform:translateX(-50%);width:640px;z-index:6">${av('AR', 36, true)}
    <div style="flex:1"><b>Aina Rahman is editing</b><div class="muted sm">${L(14)}</div></div><span class="b sm o">${I('bell', 14)}Notify me</span></div>`;
  add('editor_locked', editor({ rail: '', dimRail: true, panel: false, bar: { locked: true, people: ['LQ', 'AR', 'HI'] },
    board: lockBanner + boardAt(W, H, `<div style="position:absolute;inset:0">${slide('norm')}</div>`, { wsW: 1364, top: 72 }).html
      + `<div class="pop" style="left:${(1364 - W) / 2 + W + 24}px;top:150px;width:240px;padding:14px;display:flex;flex-direction:column;gap:10px"><b class="sm" style="font-size:13px">On this note now</b>
        ${[['AR', 'Aina Rahman', 'Editing'], ['LQ', 'Lim Qi Cai (you)', 'Viewing'], ['HI', 'Hafiz Ismail', 'Away']].map(([i, n, s], k) => `<div class="row" style="gap:8px">${av(i, 28, k === 0)}<div style="flex:1;font-size:13px;font-weight:600">${n}</div><span class="tag" style="${k === 0 ? 'background:var(--ink);color:#fff' : ''}">${k === 0 ? I('lock', 12) : ''}${s}</span></div>`).join('')}</div>`,
    bottom: { left: 76, locked: true } }),
  { t: 'Editor soft lock (read-only)', refs: 'R30, UC08', v3: 'new',
    p: 'A co-author opens a note someone else is editing: banner "X is editing", tools dimmed, Notify me when free.' });
}

add('drafts', app('Profile', `<div class="content" style="padding:0 32px">
  <div class="muted" style="margin:-8px 0 20px;font-size:15px">${L(14)}</div>
  <div class="grid" style="grid-template-columns:repeat(5,1fr);gap:20px">
    <div><div class="tile" style="background:var(--s1);display:grid;place-items:center;color:var(--ink2)"><div class="col" style="align-items:center;gap:8px">${I('plus', 28)}<b>New note</b></div></div></div>
    ${[['Indexing: B-tree vs hash', 'a', 'CT030-3-2', 'Edited 2h ago · 4 slides'], ['React hooks cheat sheet', 'b', 'CT076-3-2', 'Edited yesterday · 7 slides · shared'], ['Untitled note', 'blank', '', 'Edited 3 Oct · 1 slide'], ['Page replacement: LRU', 'c', 'CT050-3-2', 'Edited 28 Sep · 5 slides']].map(([t, v, c, s]) =>
    `<div><div class="tile">${v === 'blank' ? '<div class="sl"></div>' : cover(t, v, c)}<span class="ib s sm" style="position:absolute;top:8px;right:8px;background:#fff">${I('more', 16)}</span></div><div class="tcap">${t}</div><div class="tsub">${s}</div></div>`).join('')}
  </div>
  <div class="pop" style="left:${32 + 2 * (1168 - 80) / 5 + 40 + 120}px;top:96px;width:200px">${[['pencil', 'Continue editing'], ['users', 'Share'], ['copy', 'Duplicate'], ['trash', 'Delete draft']].map(([ic, t], k) => `<div class="mi ${k === 0 ? 'on' : ''}">${I(ic, 18)}${t}</div>`).join('')}</div></div>`, { left: backT('Drafts') + '<span class="muted" style="font-size:15px;font-weight:600">4</span>' }),
{ t: 'Drafts', refs: 'UC06, UC08', v3: 'Changed: draft menu gains Share (R30)', p: 'Private drafts grid with continue, share, duplicate and delete.' });

/* ================================================================== profiles */
add('my_profile', app('Profile', `<div class="content" style="top:56px">${profileHead({ i: 'LQ', n: 'Lim Qi Cai', h: '@limqicai', prog: 'BSc (Hons) Software Engineering · Year 3', c: ['128', '342', '2.1K'],
  btns: `<span class="b p">Edit profile</span><span class="b">${I('notes', 16)}Drafts 4</span><span class="ib s">${I('share', 18)}</span><span class="ib s">${I('sliders', 18)}</span>`, bio: L(18) })}
  <div class="tabs" style="margin:24px 48px 16px"><span class="tab on">${I('gridI', 18)}Notes</span><span class="tab">${I('lock', 16)}Saved</span><span class="tab">${I('heart', 18)}Liked</span></div>
  <div class="grid" style="grid-template-columns:repeat(6,1fr);gap:12px;padding:0 48px">${COVERS.map((c, k) => tile(c, { pinned: k === 0, priv: k === 4, co: k === 3 })).join('')}</div></div>`),
{ t: 'My profile', refs: 'UC04', p: 'Own profile with counts, pinned note, Friends-only and co-authored tile labels, and Drafts.' });

add('user_profile', app('Explore', `<div class="content" style="top:56px">${profileHead({ i: 'LC', dark: true, lect: true, n: 'Dr Lee Chin Wei', h: '@drlee', prog: 'Lecturer · School of Computing · CT030-3-2, CT046-3-M', c: ['41', '1.8K', '12.4K'],
  btns: `<span class="b">${I('friends', 18)}Friends ${I('down', 14)}</span><span class="b p">${I('msg', 16)}Message</span><span class="ib s">${I('share', 18)}</span><span class="ib s">${I('more', 18)}</span>`, bio: L(20) })}
  <div class="tabs" style="margin:24px 48px 16px"><span class="tab on">${I('gridI', 18)}Notes</span><span class="tab">${I('heart', 18)}Liked</span></div>
  <div class="grid" style="grid-template-columns:repeat(6,1fr);gap:12px;padding:0 48px">${[COVERS[2], COVERS[0], COVERS[9], COVERS[1], COVERS[5], COVERS[10]].map((c, k) => tile(c, { priv: k === 3 })).join('')}</div></div>`),
{ t: 'Another user\'s profile (friends)', refs: 'UC04, UC17', p: 'A lecturer profile in the Friends state, showing a Friends-only note visible to friends.' });

add('edit_profile', app('Profile', `<div class="content" style="top:56px">${profileHead({ i: 'LQ', n: 'Lim Qi Cai', h: '@limqicai', prog: 'BSc (Hons) Software Engineering · Year 3', c: ['128', '342', '2.1K'], btns: '<span class="b p">Edit profile</span>', bio: '' })}</div>`,
  { over: dlg(600, 'Edit profile', `
    ${[['Profile photo', `<div style="position:relative">${av('LQ', 96)}<span class="ib s sm" style="position:absolute;right:-4px;bottom:-4px;background:#fff;box-shadow:0 0 0 1px var(--s3)">${I('pencil', 16)}</span></div><span class="help" style="align-self:flex-end">JPEG or PNG, up to 2 MB</span>`],
       ['Name', '<div class="in v" style="flex:1">Lim Qi Cai</div>'],
       ['Username', `<div class="fld" style="flex:1;gap:4px"><div class="in v">limqicai</div><span class="help">${L(8)}</span></div>`],
       ['Programme', `<div class="in v" style="flex:1">BSc (Hons) Software Engineering<span class="end">${I('down', 16)}</span></div>`],
       ['Bio', `<div class="fld" style="flex:1;gap:4px"><div class="in v ta">${L(18)}</div><span class="help" style="text-align:right">104 / 300</span></div>`]]
      .map(([l, c]) => `<div style="display:flex;gap:20px;align-items:flex-start;padding:4px 0"><b style="width:120px;padding-top:12px;font-size:14px">${l}</b><div class="row" style="flex:1;align-items:flex-start;gap:12px">${c}</div></div>`).join('')}`,
    '<span class="b">Cancel</span><span class="b p">Save</span>') }),
{ t: 'Edit profile dialog', refs: 'UC04', p: 'Photo, name, username, programme and bio in one dialog.' });

add('profile_mobile', mob(`${mTop(`<span class="ib sm">${I('userPlus', 22)}</span>`, 'Lim Qi Cai', `<span class="ib sm">${I('menu', 22)}</span>`)}
  <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:6px 16px 0">${av('LQ', 96)}<b style="font-size:16px">@limqicai</b>
    <div class="row" style="gap:28px;text-align:center">${[['128', 'Following'], ['342', 'Followers'], ['2.1K', 'Likes']].map(([n, l]) => `<div><b style="font-size:17px">${n}</b><div class="muted sm">${l}</div></div>`).join('')}</div>
    <div class="row" style="gap:8px"><span class="b sm" style="width:120px">Edit profile</span><span class="b sm">Drafts 4</span><span class="ib s sm">${I('share', 16)}</span></div>
    <div style="font-size:13px;text-align:center;color:var(--ink2);max-width:320px">${L(12)}</div></div>
  <div class="tabs" style="justify-content:space-around;margin-top:10px"><span class="tab on" style="width:80px;justify-content:center">${I('gridI', 20)}</span><span class="tab" style="width:80px;justify-content:center">${I('lock', 20)}</span><span class="tab" style="width:80px;justify-content:center">${I('heart', 20)}</span></div>
  <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:2px;margin-top:2px">${COVERS.slice(0, 6).map((c, k) => tile(c, { pinned: k === 0 })).join('').replaceAll('border-radius:10px', 'border-radius:0')}</div>`, { tab: 'Profile' }),
{ m: true, t: 'Profile (mobile)', refs: 'UC04, NFR2', p: 'Phone profile with counts, Edit profile, Drafts and a three-column note grid.' });

/* ================================================================== search */
add('search', app('Explore', `<div class="content" style="padding:0 32px;display:flex;flex-direction:column;gap:16px">
  <div class="tabs">${['Top', 'Notes', 'People', 'Hashtags', 'Modules'].map((t, k) => `<span class="tab ${k === 0 ? 'on' : ''}">${t}</span>`).join('')}</div>
  ${filterBar()}
  <div class="row" style="justify-content:space-between"><b style="font-size:16px">People</b><span class="muted sm" style="font-weight:600">See all</span></div>
  <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:12px">${person('LC', 'Dr Lee Chin Wei', 'Lecturer · 1.8K followers', 'Friends', true, true)}${person('TM', 'Tan Mei Ling', 'Computer Science · 210 followers', 'Following')}${person('AH', 'Aiman Hakim', 'Information Technology · 96', 'Follow back')}</div>
  <div class="row" style="gap:8px"><b style="font-size:16px;margin-right:8px">Hashtags</b><span class="chip">#normalisation · 214 notes</span><span class="chip">#normalform · 18</span><span class="chip">#bcnf · 9</span><span class="chip">${I('book', 14)}CT030-3-2 Database Systems</span></div>
  <div class="row" style="justify-content:space-between"><b style="font-size:16px">Notes</b><span class="muted sm" style="font-weight:600">See all</span></div>
  <div class="grid" style="grid-template-columns:repeat(6,1fr);gap:14px">${[COVERS[0], COVERS[9], COVERS[1], COVERS[0], COVERS[9], COVERS[1]].map((c, k) => tile([k === 3 ? 'Normal forms with ENROL_T' : k === 4 ? 'Functional dependency basics' : k === 5 ? 'Denormalising for reports' : c[0], c[1], c[2], c[3], k !== 2 && k !== 5], { cap: true, sub: ['Aina Rahman', 'Dr Lee Chin Wei', 'Chloe Wong', 'Lim Qi Cai', 'Dr Siti Aminah', 'Hafiz Ismail'][k] })).join('')}</div></div>`,
  { left: searchTop('#normalisation') }),
{ t: 'Search results (Top)', refs: 'UC14, FR4, FR5, FR12', p: 'Top tab mixing people, hashtags, modules and notes, with the filter bar and result timing.' });

add('search_filters', app('Explore', `<div class="content" style="padding:0 32px;display:flex;flex-direction:column;gap:16px">
  <div class="tabs">${['Top', 'Notes', 'People', 'Hashtags', 'Modules'].map((t, k) => `<span class="tab ${k === 1 ? 'on' : ''}">${t}${k === 1 ? ' 14' : ''}</span>`).join('')}</div>
  ${filterBar(true).replace('Lecturer: any', 'Lecturer: Dr Lee Chin Wei').replace('48 results', '14 results')}
  <div class="col" style="gap:10px;width:760px">${[['Normalisation, 1NF to 3NF in one page', 'Aina Rahman', '12 Sep 2026'], ["Crow's foot notation", 'Dr Lee Chin Wei', '9 Sep 2026'], ['Functional dependency basics', 'Dr Lee Chin Wei', '2 Sep 2026'], ['Normal forms with ENROL_T', 'Lim Qi Cai', '29 Aug 2026']].map(([t, a, d], k) =>
    `<div class="li" style="background:var(--s1);padding:10px;gap:16px"><div style="width:96px;height:120px;border-radius:8px;overflow:hidden;flex:none;box-shadow:0 0 0 1px var(--s3)">${cover(t, ['a', 'c', 'b', 'a'][k], 'CT030-3-2')}</div><div class="t" style="display:flex;flex-direction:column;gap:6px"><div class="n" style="font-size:16px">${t}</div><div class="s">${a} · CT030-3-2 Database Systems · ${d}</div><div class="row" style="gap:6px"><span class="tag" style="background:var(--ink);color:#fff">${I('check', 12)}Verified by Dr Lee</span><span class="tag">#normalisation</span></div></div><div class="muted sm row" style="gap:4px">${I('heart', 16)}${['1.2K', '511', '402', '96'][k]}</div></div>`).join('')}</div></div>
  <div class="pop" style="left:32px;top:166px;width:420px;padding:20px;display:flex;flex-direction:column;gap:16px">
    <div class="row" style="justify-content:space-between"><b style="font-size:16px">Filters</b><span class="b sm g">Reset</span></div>
    <div class="row" style="justify-content:space-between"><div><b>Lecturer content only</b><div class="muted sm">${L(6)}</div></div><span class="tog on"></span></div>
    <div class="fld"><label>Specific lecturer</label><div class="in v">${av('LC', 24, true)}Dr Lee Chin Wei<span class="end">${I('down', 16)}</span></div></div>
    <div class="fld" style="position:relative"><label>Academic term</label><div class="in fo v">${I('cal', 18)}Semester 1, 2026/27<span class="end">${I('up', 16)}</span></div>
      <div class="pop" style="top:72px;left:0;right:0">${[['Semester 1, 2026/27', 'Sep to Dec 2026'], ['Semester 2, 2025/26', 'Feb to Jun 2026'], ['Semester 1, 2025/26', 'Sep to Dec 2025']].map(([t, d], k) => `<div class="mi ${k === 0 ? 'on' : ''}" style="min-height:46px"><div><div style="font-weight:600">${t}</div><div class="muted sm">${d}</div></div>${k === 0 ? `<span class="k">${I('check', 16)}</span>` : ''}</div>`).join('')}</div></div>
    <div class="fld"><label>Or a date range</label><div class="row" style="gap:8px"><div class="in" style="flex:1">${I('cal', 16)}From</div><div class="in" style="flex:1">${I('cal', 16)}To</div></div></div>
    <div class="fld"><label>Module</label><div class="in v">${I('book', 18)}CT030-3-2 Database Systems<span class="end">${I('down', 16)}</span></div></div>
    <span class="b p w">Show 14 notes</span></div>`, { left: searchTop('#normalisation') }),
{ t: 'Search filters', refs: 'UC14, FR15', p: 'Filter popover: lecturer content, specific lecturer, academic term or date range, and module.' });

add('search_mobile', mob(`<div style="display:flex;gap:10px;align-items:center;padding:6px 16px 10px">${I('left', 24)}<div class="in v" style="flex:1;height:40px;border-radius:999px">${I('search', 18)}#dsa</div><b class="sm" style="font-size:14px">Search</b></div>
  <div class="tabs" style="padding:0 16px;gap:22px">${['Top', 'Notes', 'People', 'Hashtags', 'Modules'].map((t, k) => `<span class="tab ${k === 1 ? 'on' : ''}" style="font-size:14px">${t}</span>`).join('')}</div>
  <div class="row" style="gap:6px;padding:12px 16px;overflow:hidden"><span class="chip on">${I('filter', 14)}2</span><span class="chip on">Lecturer content</span><span class="chip o">Semester 1 ${I('down', 12)}</span><span class="chip o">Module</span></div>
  <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;padding:0 16px">${[COVERS[7], COVERS[2], COVERS[10], COVERS[5]].map((c, k) => tile(c, { cap: true, sub: ['Arjun Kumar', 'Dr Lee Chin Wei', 'Hafiz Ismail', 'Tan Mei Ling'][k] })).join('')}</div>`, { tab: 'Discover' }),
{ m: true, t: 'Search (mobile)', refs: 'UC14, NFR2', p: 'Phone search with result tabs, filter chips and a two-column grid.' });

/* ================================================================== saved, report, super like */
add('saved', app('Saved', `<div class="content" style="padding:0 32px;display:flex;flex-direction:column;gap:18px">
  <div class="row" style="gap:8px"><span class="chip on">All 32</span><span class="chip">CT030-3-2 Database Systems 11</span><span class="chip">CT044-3-2 Algorithms and Data Structures 9</span><span class="chip">AICT004 Software Engineering 7</span><span class="chip">Other 5</span><span class="chip o" style="margin-left:auto">Recently saved ${I('down', 13)}</span></div>
  <div class="grid" style="grid-template-columns:repeat(6,1fr);gap:16px">${COVERS.map((c, k) => tile(c, { cap: true, sub: `${['Aina Rahman', 'Chloe Wong', 'Dr Lee Chin Wei', 'Lim Qi Cai', 'Arjun Kumar', 'Tan Mei Ling'][k % 6]} · saved ${k + 1}d ago` })).join('')}</div></div>`,
  { left: title('Saved', '32 notes · only you') }),
{ t: 'Saved notes', refs: 'UC13, FR14', p: 'Bookmarked notes grouped by module chips and sortable.' });

add('report_dialog', app('Feed', feedBody(feedCard({ verified: 'Dr Lee', idx: 1 }), rail({ liked: true })), { center: ftabs(), me: 'LC',
  over: dlg(480, 'Report note', `<div class="muted" style="margin-top:-10px">${L(16)}</div>
    <div class="col" style="gap:4px">${['Inaccurate content', 'Inappropriate content', 'Spam or advertising', 'Plagiarism', 'Copyright violation', 'Something else'].map((r, k) => `<div class="li ${k === 3 ? 'on' : ''}" style="padding:10px 12px"><span class="radio ${k === 3 ? 'on' : ''}"></span><div class="t"><div class="n" style="font-weight:${k === 3 ? 700 : 400}">${r}</div>${k === 3 || k === 4 ? '<div class="s">Lecturers only</div>' : ''}</div></div>`).join('')}</div>
    <div class="fld"><label>Details <span class="muted" style="font-weight:400">optional</span></label><div class="in v ta">${L(14)}</div><span class="help" style="text-align:right">76 / 500</span></div>`,
  '<span class="b">Cancel</span><span class="b p">Submit report</span>') }),
{ t: 'Report note dialog', refs: 'UC12', p: 'Report reasons (two for lecturers only) with optional details; reporter stays anonymous.' });

add('superlike_dialog', app('Feed', feedBody(feedCard({ aspect: '16:9', kind: 'sort', author: 'Hafiz Ismail', title: 'Sorting algorithms compared', desc: `${L(6)} <b>#dsa</b>`, mod: MODS.ads, idx: 0, count: 4, music: false }), rail({ superlike: true, av: 'HI', likes: '386', comments: '12', saves: '97' })), { collapsed: true, center: ftabs(), me: 'LC',
  over: dlg(500, 'Super Like this note?', `<div style="color:var(--ink2);margin-top:-8px;line-height:1.5">${L(26)}</div>
    <div class="li" style="background:var(--s1);padding:10px"><div style="width:96px;height:54px;border-radius:6px;overflow:hidden;flex:none;box-shadow:0 0 0 1px var(--s3)">${slide('sort', { aspect: '16:9' })}</div><div class="t"><div class="n">Sorting algorithms compared</div><div class="s">Hafiz Ismail · CT044-3-2 · 4 slides</div></div></div>
    <div class="fld"><label>Remark for the author <span class="muted" style="font-weight:400">optional</span></label><div class="in v ta" style="min-height:72px">${L(10)}</div></div>
    <div class="help">${L(9)}</div>`,
  `<span class="b">Cancel</span><span class="b p">${I('starF', 16)}Super Like</span>`, { icon: `<span style="width:52px;height:52px;border-radius:50%;background:var(--s2);display:grid;place-items:center">${I('star', 28)}</span>` }) }),
{ t: 'Super Like (verify) dialog', refs: 'UC19, FR1, FR2, FR3', p: 'Lecturer confirms a Super Like with an optional remark shown with the badge.' });

/* ================================================================== notifications + inbox */
const feedBehind = (me) => `<div class="main"><div class="top"><div class="l"></div><div>${ftabs()}</div><div class="r">${util(me)}</div></div>${feedBody(feedCard({ verified: 'Dr Lee', idx: 1 }), rail({ liked: true }), { noArrows: true })}</div>`;
add('notifications', `<div class="app">${nav('Notifications', { collapsed: true })}${notifDrawer(`
    <div class="li" style="background:var(--s1);padding:12px"><div style="width:44px;height:44px;border-radius:50%;background:#fff;display:grid;place-items:center">${I('inbox', 22)}</div><div class="t"><div class="n">Message requests</div><div class="s">Hafiz Ismail and 1 other</div></div><span class="cnt" style="margin-left:0">2</span>${I('right', 18)}</div>
    <div class="muted sm" style="font-weight:700;padding:4px 8px 0">Today</div>
    ${nrow('LC', true, `<b>Dr Lee Chin Wei</b> Super Liked your note. “${L(5, false)}”`, '12 min ago', nthumb(2))}
    ${nrow('AR', false, `<b>Aina Rahman</b> mentioned you: <span class="at">@limqicai</span> ${L(6, false)}`, '1 h ago', nthumb(0))}
    ${nrow('HI', false, '<b>Hafiz Ismail</b> started following you.', '3 h ago', '<span class="b sm p">Follow back</span>')}
    <div class="muted sm" style="font-weight:700;padding:4px 8px 0">This week</div>
    ${nrow('', false, `<b>Lecturer account approved.</b> ${L(8)}`, 'Mon', '', { icon: 'shield' })}
    ${nrow('', false, `<b>Your note was hidden by an administrator.</b> ${L(7)}`, 'Sun', '<span class="b sm">Details</span>', { icon: 'flag' })}
    ${nrow('TM', false, '<b>Tan Mei Ling</b> and 3 others liked “TCP vs UDP”.', 'Sat', nthumb(4))}`)}${feedBehind('PN')}</div>`,
{ t: 'Notifications drawer', refs: 'UC16, UC19, UC22, UC20', p: 'Grouped notifications: Super Likes, mentions, follows, approvals and moderation, with a requests entry.' });

add('collab_request_notification', `<div class="app">${nav('Notifications', { collapsed: true })}${notifDrawer(`
    <div class="muted sm" style="font-weight:700;padding:4px 8px 0">Collaboration requests</div>
    ${nrow('CW', false, '<b>Chloe Wong</b> asked to collaborate on “Normalisation, 1NF to 3NF in one page”.', '8 min ago', nthumb(0), { bg: true,
      below: `<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:#fff;font-size:13px;color:var(--ink2)">“${L(12, false)}”</div>
        <div class="row" style="gap:8px;margin-top:10px"><span class="chip o" style="height:32px">Can edit ${I('down', 12)}</span><span class="b sm">Decline</span><span class="b sm p">${I('check', 14)}Approve</span></div>` })}
    ${nrow('AK', false, '<b>Arjun Kumar</b> asked to collaborate on “Stack vs queue”.', '2 h ago', nthumb(7), {
      below: `<div class="row" style="gap:8px;margin-top:10px"><span class="chip o" style="height:32px">Can view ${I('down', 12)}</span><span class="b sm">Decline</span><span class="b sm p">${I('check', 14)}Approve</span></div>` })}
    <div class="muted sm" style="font-weight:700;padding:4px 8px 0">Earlier</div>
    ${nrow('HI', false, '<b>You approved Hafiz Ismail</b> as an editor of “Normalisation, 1NF to 3NF”.', 'Mon', '<span class="tag">Approved</span>')}
    ${nrow('TM', false, '<b>You declined Tan Mei Ling</b> for “TCP vs UDP”.', 'Sun', '<span class="tag">Declined</span>')}`, 'Requests')}${feedBehind('LQ')}</div>`,
{ t: 'Owner approves or declines a request', refs: 'R30, R8 notifications', v3: 'new',
  p: 'Requests filter in notifications: the owner picks a role and approves, or declines; history stays below.' });

add('inbox_mobile', mob(`${mTop('', 'Inbox', `<span class="ib sm">${I('plus', 22)}</span>`)}
  <div style="padding:0 8px">${[['userPlus', 'New followers', 'Hafiz Ismail started following you', '1'], ['bell', 'Activity', 'Dr Lee Super Liked your note', '3'], ['users', 'Collaboration requests', 'Chloe Wong asked to collaborate', '1'], ['inbox', 'Message requests', 'Chloe Wong wants to message you', '2'], ['shield', 'System notifications', L(5, false), '']].map(([ic, t, s, c]) =>
    `<div class="li"><div style="width:52px;height:52px;border-radius:50%;background:var(--s2);display:grid;place-items:center;flex:none">${I(ic, 24)}</div><div class="t"><div class="n">${t}</div><div class="s">${s}</div></div>${c ? `<span class="cnt" style="margin-left:0">${c}</span>` : ''}${I('right', 18)}</div>`).join('')}
    <div class="muted sm" style="font-weight:700;padding:10px 12px 2px">Messages</div>
    ${[['AR', 'Aina Rahman', 'Shared a note: Normalisation, 1NF…', '2m', false], ['FY', 'FYP Team, CT046', `Arjun: ${L(4, false)}`, '1h', false], ['LC', 'Dr Lee Chin Wei', `You: ${L(3, false)}`, 'Mon', true]].map(([i, n, s, t, d]) =>
    `<div class="li">${av(i, 52, d)}<div class="t"><div class="n">${n}</div><div class="s">${s}</div></div><span class="muted sm">${t}</span></div>`).join('')}</div>`, { tab: 'Inbox' }),
{ m: true, t: 'Inbox (mobile)', refs: 'UC15, UC16, UC17, R30', v3: 'Changed: adds the Collaboration requests row (R30)', p: 'Phone inbox combining notification groups and chats.' });

/* ================================================================== messages */
const convList = (on, o = {}) => `<div style="width:360px;flex:none;display:flex;flex-direction:column;gap:6px;padding:0 12px 0 20px">
  <div class="li ${o.reqOn ? 'on' : ''}" style="padding:12px;${o.reqOn ? '' : 'background:var(--s1)'}"><div style="width:48px;height:48px;border-radius:50%;background:${o.reqOn ? '#fff' : 'var(--s2)'};display:grid;place-items:center">${I('inbox', 22)}</div><div class="t"><div class="n">Message requests</div><div class="s">${L(5, false)}</div></div><span class="cnt" style="margin-left:0">2</span></div>
  ${[['AR', 'Aina Rahman', 'Shared a note: Normalisation, 1NF…', '2m'], ['FY', 'FYP Team, CT046', 'Arjun: lorem ipsum dolor sit', '1h'], ['LC', 'Dr Lee Chin Wei', 'You: lorem ipsum dolor', 'Mon'], ['TM', 'Tan Mei Ling', 'Lorem ipsum dolor sit amet', 'Sun'], ['AK', 'Arjun Kumar', 'Sent a note: Stack vs queue', 'Sat']].map(([i, n, s, t]) =>
    `<div class="li ${n === on ? 'on' : ''}">${av(i, 48, i === 'LC')}<div class="t"><div class="n">${n}</div><div class="s">${s}</div></div><span class="muted sm">${t}</span></div>`).join('')}</div>`;
const shareCard = (me, k = 0) => `<div class="ncard ${me ? 'me' : ''}"><div class="th"><div style="width:120px;height:150px">${slide(k === 0 ? 'norm' : 'stack')}</div></div><div class="mt"><b>${k === 0 ? 'Normalisation, 1NF to 3NF in one page' : 'Stack vs queue, with real examples'}</b><span class="muted sm">${k === 0 ? 'Aina Rahman · CT030-3-2' : 'Arjun Kumar · CT044-3-2'}</span></div></div>`;
const chatPane = (head, msgs, input = true) => `<div style="flex:1;display:flex;flex-direction:column;background:var(--s0);border-radius:16px 0 0 0;overflow:hidden;box-shadow:inset 1px 1px 0 var(--line)">
  <div class="row" style="padding:14px 20px;background:#fff;box-shadow:inset 0 -1px 0 var(--line)">${head}</div>
  <div style="flex:1;padding:20px 24px;display:flex;flex-direction:column;gap:10px;overflow:hidden">${msgs}</div>
  ${input ? `<div class="inbar" style="padding:12px 20px 18px"><span class="ib s">${I('clip', 20)}</span><div class="in" style="flex:1;border-radius:999px;background:#fff">Send a message…<span class="end">${I('smile', 18)}</span></div><span class="ib s" style="background:var(--acc);color:#fff">${I('send', 18)}</span></div>` : ''}</div>`;

add('messages', app('Messages', `<div class="content" style="display:flex">${convList('Aina Rahman')}${chatPane(`${av('AR', 40)}<div><div style="font-weight:700">Aina Rahman</div><div class="muted sm row" style="gap:4px">${I('friends', 14)}Friends · active now</div></div><span class="ib" style="margin-left:auto">${I('info', 20)}</span>`,
  `<div class="muted sm" style="text-align:center">Today 14:02</div>${shareCard(false)}<div class="bub">${L(9)}</div>
   <div class="bub me">${L(12)}</div><div class="bub me">${L(7)}</div><div class="bub">${L(6)}</div>
   <div class="muted sm" style="text-align:right">Seen</div>`)}</div>`, { left: title('Messages'), right: `<span class="ib s">${I('users', 20)}</span>${util()}` }),
{ t: 'Post-anchored chat', refs: 'UC15, UC17, FR7, FR9', p: 'One-to-one chat that starts from a shared note card.' });

add('message_request', app('Messages', `<div class="content" style="display:flex">${convList('', { reqOn: true })}
  <div style="flex:1;display:flex;background:var(--s0);border-radius:16px 0 0 0;overflow:hidden;box-shadow:inset 1px 1px 0 var(--line)">
    <div style="width:300px;background:#fff;padding:16px 12px;display:flex;flex-direction:column;gap:6px;box-shadow:inset -1px 0 0 var(--line)"><b style="padding:4px 8px 8px">Requests 2</b>
      ${[['HI', 'Hafiz Ismail', 'Asked about: Normalisation, 1NF…', true], ['CW', 'Chloe Wong', L(5, false), false]].map(([i, n, s, on]) => `<div class="li ${on ? 'on' : ''}">${av(i, 44)}<div class="t"><div class="n">${n}</div><div class="s">${s}</div></div></div>`).join('')}</div>
    <div style="flex:1;display:flex;flex-direction:column">
      <div class="row" style="padding:14px 20px;background:#fff">${av('HI', 40)}<div><div style="font-weight:700">Hafiz Ismail</div><div class="muted sm">Follows you · you do not follow back</div></div></div>
      <div style="flex:1;padding:24px;display:flex;flex-direction:column;gap:10px">${shareCard(false)}<div class="bub">${L(16)}</div></div>
      <div style="background:#fff;padding:18px 24px 22px;display:flex;flex-direction:column;gap:12px;align-items:center;text-align:center">
        <div style="max-width:520px;color:var(--ink2)">${L(26)}</div>
        <div class="row" style="gap:10px"><span class="b" style="width:140px">${I('flag', 16)}Report</span><span class="b" style="width:140px">${I('trash', 16)}Delete</span><span class="b p" style="width:140px">${I('check', 16)}Accept</span></div></div></div></div></div>`, { left: title('Messages') }),
{ t: 'Message request (recipient)', refs: 'UC16, FR6', p: 'A non-friend\'s first message waits as a request: Report, Delete or Accept.' });

add('new_group', app('Messages', `<div class="content" style="display:flex">${convList('Aina Rahman')}${chatPane(`${av('AR', 40)}<div><div style="font-weight:700">Aina Rahman</div><div class="muted sm">Friends</div></div>`, `${shareCard(false)}<div class="bub">${L(9)}</div>`)}</div>`, { left: title('Messages'),
  over: dlg(480, 'New group', `<div class="fld"><label>Group name</label><div class="in v">FYP Team, CT046</div></div>
    <div class="fld"><label>Add friends <span class="muted" style="font-weight:400">at least 2</span></label><div class="in" style="flex-wrap:wrap;gap:6px;padding:8px 10px"><span class="tag">Aina Rahman ${I('x', 12)}</span><span class="tag">Arjun Kumar ${I('x', 12)}</span>${I('search', 16)}Search friends</div></div>
    <div class="col" style="gap:2px">${[['AR', 'Aina Rahman', true], ['AK', 'Arjun Kumar', true], ['TM', 'Tan Mei Ling', false], ['AH', 'Aiman Hakim', false]].map(([i, n, on]) => `<div class="li" style="padding:8px">${av(i, 40)}<div class="t"><div class="n">${n}</div><div class="s">Friend</div></div><span class="chk ${on ? 'on' : ''}">${on ? I('check', 14) : ''}</span></div>`).join('')}</div>
    <div class="help">${L(12)}</div>`, '<span class="b">Cancel</span><span class="b p">Create group (3)</span>') }),
{ t: 'New group dialog', refs: 'UC18, FR13', p: 'Name a group and pick at least two friends.' });

add('group_chat', app('Messages', `<div class="content" style="display:flex">${convList('FYP Team, CT046')}${chatPane(`${stack(['AR', 'AK'], 32)}<div><div style="font-weight:700">FYP Team, CT046</div><div class="muted sm">3 members</div></div><span class="ib s" style="margin-left:auto">${I('info', 20)}</span>`,
  `<div class="row" style="gap:8px;align-items:flex-end">${av('AR', 28)}<div class="col" style="gap:4px"><span class="muted sm">Aina</span>${shareCard(false)}</div></div>
   <div class="row" style="gap:8px">${av('AK', 28)}<div class="bub" style="max-width:none">${L(10)}</div></div>
   <div class="bub me">${L(6)}</div>${shareCard(true, 1)}`)}
  <div style="width:300px;flex:none;background:#fff;padding:20px;display:flex;flex-direction:column;gap:14px;box-shadow:inset 1px 0 0 var(--line)">
    <b style="font-size:16px">Group details</b>
    <div class="fld"><label>Name</label><div class="in v">FYP Team, CT046<span class="end">${I('pencil', 16)}</span></div></div>
    <b class="sm" style="font-size:13px;color:var(--ink2)">Members 3</b>
    ${[['LQ', 'Lim Qi Cai', 'You · owner'], ['AR', 'Aina Rahman', 'Friend'], ['AK', 'Arjun Kumar', 'Friend']].map(([i, n, s], k) => `<div class="row" style="gap:10px">${av(i, 36)}<div style="flex:1"><div style="font-weight:600">${n}</div><div class="muted sm">${s}</div></div>${k ? `<span class="ib sm">${I('more', 16)}</span>` : ''}</div>`).join('')}
    <span class="b">${I('userPlus', 16)}Add member</span><span class="b g" style="margin-top:auto">${I('logout', 16)}Leave group</span></div></div>`, { left: title('Messages') }),
{ t: 'Group chat with details', refs: 'UC18, FR13', p: 'Group conversation with shared notes and a details panel to rename, add members or leave.' });

add('chat_mobile', mob(`<div style="height:56px;display:flex;align-items:center;gap:10px;padding:0 12px;box-shadow:inset 0 -1px 0 var(--line)">${I('left', 24)}${av('AR', 36)}<div style="flex:1"><b>Aina Rahman</b><div class="muted sm">Friends · active now</div></div>${I('info', 22)}</div>
  <div style="padding:14px;display:flex;flex-direction:column;gap:8px;background:var(--s0);height:640px">
    <div class="muted sm" style="text-align:center">Today 14:02</div>${shareCard(false).replace('width:300px', 'width:250px')}<div class="bub" style="max-width:80%">${L(8)}</div>
    <div class="bub me" style="max-width:80%">${L(7)}</div><div class="bub" style="max-width:80%">${L(2)}</div></div>
  <div style="position:absolute;left:0;right:0;bottom:0;padding:10px 12px 34px;display:flex;gap:8px;align-items:center;background:#fff;box-shadow:inset 0 1px 0 var(--line)"><span class="ib s sm">${I('clip', 18)}</span><div class="in" style="flex:1;height:40px;border-radius:999px">Message…</div><span class="ib s sm" style="background:var(--acc);color:#fff">${I('send', 16)}</span></div>`, { tab: false }),
{ m: true, t: 'Chat (mobile)', refs: 'UC15, UC17, NFR2', p: 'Phone chat with the note card and a pinned input bar.' });

/* ================================================================== admin */
const adminApp = (on, body, o = {}) => app(on, body, { admin: true, me: 'AD', ...o });
add('admin_reports', adminApp('Reports', `<div class="content" style="display:flex;gap:0">
  <div style="width:440px;flex:none;padding:0 16px 0 32px;display:flex;flex-direction:column;gap:10px">
    <div class="row" style="gap:6px"><span class="chip on">Open 5</span><span class="chip">Resolved</span><span class="chip o" style="margin-left:auto">Oldest first ${I('down', 12)}</span></div>
    ${[['Lab 4 answers', 'Hafiz Ismail', ['Plagiarism', 'Spam'], 3, '2d', 'b'], ['ER notation, wrong arrows', 'Chloe Wong', ['Inaccurate'], 1, '1d', 'c'], ['Cheap tutoring, DM me', 'student_k82', ['Spam'], 2, '20h', 'a'], ['Week 6 lecture deck', 'Arjun Kumar', ['Copyright'], 1, '6h', 'b']].map(([t, a, rs, n, age, v], k) =>
      `<div class="li ${k === 0 ? 'on' : ''}" style="padding:12px;${k ? 'background:var(--s1)' : ''}"><div style="width:56px;height:70px;border-radius:6px;overflow:hidden;flex:none;box-shadow:0 0 0 1px var(--s3)">${cover(t, v, '')}</div><div class="t" style="display:flex;flex-direction:column;gap:5px"><div class="n">${t}</div><div class="s">${a} · oldest report ${age} ago</div><div class="row" style="gap:6px">${rs.map((r) => `<span class="tag" style="${k === 0 ? 'background:#fff' : ''}">${r}</span>`).join('')}</div></div><b style="font-size:13px;white-space:nowrap">${n} report${n > 1 ? 's' : ''}</b></div>`).join('')}</div>
  <div style="flex:1;background:var(--s0);border-radius:16px 0 0 0;padding:24px;display:flex;gap:24px;box-shadow:inset 1px 1px 0 var(--line)">
    <div style="width:200px;flex:none;display:flex;flex-direction:column;gap:10px"><div style="width:200px;height:250px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px var(--s3)">${cover('Lab 4 answers', 'b', 'CT030-3-2')}</div><span class="b sm">${I('eye', 16)}Open note</span></div>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:14px">
      <div><b style="font-size:18px">Lab 4 answers</b><div class="muted sm">Hafiz Ismail · CT030-3-2 · Public · posted 4 Oct · 2 earlier upheld reports</div></div>
      <b class="sm" style="font-size:13px;color:var(--ink2)">Reports 3</b>
      ${[['LC', 'Dr Lee Chin Wei', 'Plagiarism', L(10), true], ['TM', 'Tan Mei Ling', 'Plagiarism', '', false], ['AK', 'Arjun Kumar', 'Spam', L(5), false]].map(([i, n, r, d, dk]) => `<div class="row" style="gap:10px;align-items:flex-start;background:#fff;border-radius:10px;padding:10px;box-shadow:inset 0 0 0 1px var(--line)">${av(i, 32, dk)}<div style="flex:1"><div class="row" style="gap:8px"><b class="sm" style="font-size:13px">${n}</b><span class="tag">${r}</span></div>${d ? `<div class="sm" style="font-size:13px;margin-top:4px">${d}</div>` : ''}</div></div>`).join('')}
      <div class="fld"><label>Resolution remark <span class="muted" style="font-weight:400">required</span></label><div class="in v ta" style="background:#fff;min-height:64px">${L(8)}</div></div>
      <div class="row" style="gap:10px"><span class="b">Dismiss</span><span class="b p">Hide note</span><span class="b">Hide and act on account</span></div></div></div></div>`, { left: title('Reports', '5 open') }),
{ t: 'Admin: report queue', refs: 'UC20', p: 'Reported notes grouped with counts; detail pane with reports, a required remark and actions.' });

add('admin_users', adminApp('Users', `<div class="content" style="padding:0 32px;display:flex;flex-direction:column;gap:14px">
  <div class="row"><div class="in" style="width:360px;border-radius:999px">${I('search', 18)}Search name or email</div><span class="chip on">All</span><span class="chip">Students</span><span class="chip">Lecturers</span><span class="chip">Suspended</span></div>
  <table class="tbl"><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Upheld reports</th><th>Joined</th><th></th></tr>
  ${[['HI', 'Hafiz Ismail', 'tp071833@mail.apu.edu.my', 'Student', 'Active', 2], ['LC', 'Dr Lee Chin Wei', 'lee.chinwei@apu.edu.my', 'Lecturer', 'Active', 0], ['CW', 'Chloe Wong', 'tp070412@mail.apu.edu.my', 'Student', 'Restricted', 1], ['K8', 'student_k82', 'tp073390@mail.apu.edu.my', 'Student', 'Suspended', 4], ['AR', 'Aina Rahman', 'tp072011@mail.apu.edu.my', 'Student', 'Active', 0]].map(([i, n, e, r, s, u]) =>
    `<tr><td><div class="row" style="gap:10px">${av(i, 32, i === 'LC')}<b>${n}</b></div></td><td class="muted">${e}</td><td>${r}</td><td><span class="st2 ${s === 'Suspended' ? 'd' : ''}">${s}</span></td><td>${u}</td><td class="muted">Sep 2026</td><td><span class="ib sm">${I('more', 18)}</span></td></tr>`).join('')}</table></div>`,
  { left: title('Users', '1,284'), over: dlg(460, 'Suspend Hafiz Ismail?', `<div style="color:var(--ink2);margin-top:-8px">${L(18)}</div>
    <div class="row" style="gap:8px">${['Restrict posting', 'Suspend', 'Delete account'].map((t, k) => `<span class="chip ${k === 1 ? 'on' : 'o'}">${t}</span>`).join('')}</div>
    <div class="fld"><label>Reason <span class="muted" style="font-weight:400">required</span></label><div class="in fo v ta">${L(10)}</div></div>`, '<span class="b">Cancel</span><span class="b p">Suspend account</span>') }),
{ t: 'Admin: users and suspension', refs: 'UC21', p: 'User table with status and upheld reports; suspend dialog with a required reason.' });

add('admin_lecturers', adminApp('Lecturer applications', `<div class="content" style="padding:0 32px;display:flex;flex-direction:column;gap:12px;width:980px">
  <div class="muted" style="font-size:15px;margin-bottom:4px">${L(20)}</div>
  ${[['PN', 'Priya Nair', 'priya.nair@apu.edu.my', 'S10233', 'School of Computing', '1 day ago', false], ['SA', 'Dr Siti Aminah', 'siti.aminah@apu.edu.my', 'S09871', 'School of Technology', '3 days ago', true]].map(([i, n, e, id, sc, ago, rej]) =>
    `<div style="background:var(--s1);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:14px"><div class="row" style="gap:14px">${av(i, 52)}<div style="flex:1"><b style="font-size:16px">${n}</b><div class="muted sm">${e} · applied ${ago}</div></div>
      <div style="width:110px;margin-right:12px"><div class="muted sm">Staff ID</div><b style="font-size:16px">${id}</b></div><div style="width:190px;margin-right:12px"><div class="muted sm">School</div><b>${sc}</b></div>
      ${rej ? '<span class="b" style="width:110px;box-shadow:inset 0 0 0 2px var(--ink)">Reject</span><span class="b dis" style="width:110px">Approve</span>' : '<span class="b" style="width:110px">Reject</span><span class="b p" style="width:110px">Approve</span>'}</div>
      ${rej ? `<div style="background:#fff;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px"><div class="fld"><label>Reason for rejecting <span class="muted" style="font-weight:400">sent to the applicant</span></label><div class="in fo v">${L(14)}</div></div><div class="row" style="justify-content:flex-end;gap:10px"><span class="b">Cancel</span><span class="b p">Reject application</span></div><div class="help">${L(9)}</div></div>` : ''}</div>`).join('')}</div>`,
  { left: title('Lecturer applications', '2 pending') }),
{ t: 'Admin: lecturer applications', refs: 'UC22', p: 'Approve or reject staff-ID applications; rejection needs a reason sent to the applicant.' });

add('admin_modules', adminApp('Modules', `<div class="content" style="padding:0 32px;display:flex;flex-direction:column;gap:14px;width:1000px">
  <div style="background:var(--s1);border-radius:14px;padding:14px;display:flex;gap:10px;align-items:flex-end">
    <div class="fld" style="width:180px"><label>Code</label><div class="in v" style="background:#fff">CT095-3-3</div></div><div class="fld" style="flex:1"><label>Name</label><div class="in fo v">Cloud Infrastructure</div></div><span class="b p" style="height:44px">${I('plus', 16)}Add module</span></div>
  <div class="row"><div class="in" style="width:320px;border-radius:999px">${I('search', 18)}Search code or name</div><span class="muted sm" style="margin-left:auto">${L(7)}</span></div>
  <table class="tbl"><tr><th style="width:150px">Code</th><th>Name</th><th style="width:110px">Notes</th><th style="width:170px"></th></tr>
  ${[['CT030-3-2', 'Database Systems', 214], ['CT044-3-2', 'Algorithms and Data Structures', 187], ['CT046-3-M', 'Software Engineering Practice', 96], ['CT050-3-2', 'Operating Systems', 72], ['CT060-3-2', 'Computer Networks', 65], ['CT076-3-2', 'Web Application Development', 58]].map(([c, n, k], j) =>
    j === 2 ? `<tr><td><b>${c}</b></td><td><div class="row" style="gap:8px"><div class="in fo v" style="flex:1;min-height:36px;height:36px">Software Engineering Practice and Process</div><span class="b sm p">Save</span><span class="b sm">Cancel</span></div></td><td>${k}</td><td></td></tr>`
      : `<tr><td><b>${c}</b></td><td>${n}</td><td>${k}</td><td><span class="b sm g">${I('pencil', 14)}Rename</span></td></tr>`).join('')}</table></div>`,
  { left: title('Modules', '12') }),
{ t: 'Admin: module catalogue', refs: 'UC21 (admin), R4/R5 catalogue', p: 'Add a module and rename one inline; renaming keeps every note linked.' });
