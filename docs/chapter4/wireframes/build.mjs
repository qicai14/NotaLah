// Renders the PARP storyboard wireframes (Chapter 4.4) to png/.
// Usage: node build.mjs   (needs `npm i` and `npx playwright install chromium` once)
//
// One design language for every screen: TikTok web shell (left nav that collapses to an icon rail,
// centred vertical note card with an action rail), TikTok mobile (snap feed, bottom tab bar) and a
// Canva-style editor. Greyscale only; the one accent is a dark neutral grey used for primary actions.
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { domToSvg } from './svg.mjs';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ tokens + base styles */
const css = `
:root{--bg:#fff;--s0:#fafafa;--s1:#f4f4f5;--s2:#e9e9ec;--s3:#d9d9de;--line:#e2e2e6;--ink:#18181b;--ink2:#4a4a52;--ink3:#76767f;
--acc:#3b3b42;--media:#2a2a2f;--media2:#38383e;--hl:#d4d4da;--r1:8px;--r2:12px;--r3:16px}
*{box-sizing:border-box;margin:0;padding:0}
html{filter:grayscale(1)}
body{font:14px/1.45 "Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased;font-feature-settings:"tnum"}
b,strong{font-weight:650}
.i{fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none;display:block}
.i .f{fill:currentColor;stroke:none}
.app{width:1440px;height:900px;display:flex;position:relative;overflow:hidden;background:var(--bg)}
.full{width:1440px;height:900px;position:relative;overflow:hidden;background:var(--bg)}

/* nav */
.nav{width:240px;flex:none;background:var(--s0);display:flex;flex-direction:column;padding:16px 12px 16px;gap:2px;position:relative;z-index:3}
.nav-head{display:flex;align-items:center;justify-content:space-between;height:40px;padding:0 4px 0 8px;margin-bottom:12px}
.logo{display:flex;align-items:center;gap:8px;font-size:21px;font-weight:750;letter-spacing:-.03em}
.mark{width:30px;height:30px;border-radius:9px;background:var(--ink);color:#fff;display:grid;place-items:center;font-size:16px;font-weight:800;letter-spacing:0}
.nsearch{height:40px;border-radius:999px;background:var(--s2);display:flex;align-items:center;gap:10px;padding:0 14px;color:var(--ink3);margin-bottom:10px}
.ni{white-space:nowrap;height:44px;border-radius:10px;display:flex;align-items:center;gap:14px;padding:0 12px;font-size:15px;font-weight:500;color:var(--ink2);position:relative}
.ni.on{background:var(--s2);color:var(--ink);font-weight:700}
.ni .cr{width:26px;height:26px;border-radius:8px;background:var(--acc);color:#fff;display:grid;place-items:center;margin:0 -1px}
.cnt{margin-left:auto;min-width:20px;height:20px;border-radius:999px;background:var(--acc);color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center;padding:0 6px}
.ngrp{font-size:12px;font-weight:650;color:var(--ink3);padding:14px 12px 4px}
.nfoot{margin-top:auto;padding:12px 12px 0;font-size:12px;color:var(--ink3);line-height:1.7}
.nav.c{width:72px;padding:16px 12px;align-items:center}
.nav.c .nav-head{flex-direction:column;height:auto;gap:12px;padding:0;margin-bottom:12px}
.nav.c .ni{width:48px;height:48px;padding:0;justify-content:center}
.nav.c .dot{position:absolute;top:9px;right:9px;width:9px;height:9px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 2px var(--s0)}
.ib{width:40px;height:40px;border-radius:999px;display:grid;place-items:center;color:var(--ink2);flex:none}
.ib.s{background:var(--s2);color:var(--ink)}
.ib.sm{width:32px;height:32px}

/* main + top band */
.main{flex:1;position:relative;overflow:hidden}
.top{position:absolute;top:0;left:0;right:0;height:72px;display:flex;align-items:center;padding:0 24px 0 32px;z-index:6}
.top .l{display:flex;align-items:center;gap:12px;flex:1}
.top .r{display:flex;align-items:center;gap:12px;flex:1;justify-content:flex-end}
.top h1{font-size:22px;font-weight:750;letter-spacing:-.02em}
.content{position:absolute;top:72px;left:0;right:0;bottom:0}
.av{border-radius:50%;background:var(--s3);color:var(--ink2);display:grid;place-items:center;font-weight:700;flex:none;letter-spacing:-.01em}
.av.d{background:var(--ink2);color:#fff}

/* buttons, fields, chips, tabs */
.b{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 18px;border-radius:999px;font-weight:650;font-size:14px;background:var(--s2);color:var(--ink);white-space:nowrap;flex:none}
.b.p{background:var(--acc);color:#fff}
.b.g{background:transparent}
.b.o{background:#fff;box-shadow:inset 0 0 0 1.5px var(--s3)}
.b.sm{height:32px;padding:0 14px;font-size:13px}
.b.lg{height:48px;padding:0 26px;font-size:15px}
.b.w{width:100%}
.b.dis{background:var(--s1);color:var(--ink3)}
.fld{display:flex;flex-direction:column;gap:6px}
.fld>label{font-size:13px;font-weight:650;color:var(--ink2)}
.in{min-height:44px;border-radius:10px;background:var(--s1);box-shadow:inset 0 0 0 1px var(--line);padding:0 14px;display:flex;align-items:center;gap:8px;color:var(--ink3);font-size:14px}
.in.v{color:var(--ink)}
.in.fo{background:#fff;box-shadow:inset 0 0 0 2px var(--ink),0 0 0 4px rgba(0,0,0,.07)}
.in.er{background:#fff;box-shadow:inset 0 0 0 2px var(--ink2)}
.in.ta{align-items:flex-start;padding-top:12px;min-height:88px}
.in .end{margin-left:auto;display:flex;align-items:center;gap:6px}
.help{font-size:12px;color:var(--ink3)}
.err{font-size:13px;color:var(--ink);font-weight:650;display:flex;gap:6px;align-items:center}
.chip{height:32px;padding:0 12px;border-radius:999px;background:var(--s2);font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;color:var(--ink2);flex:none}
.chip.on{background:var(--acc);color:#fff}
.chip.o{background:#fff;box-shadow:inset 0 0 0 1.5px var(--s3)}
.tag{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 10px;border-radius:999px;background:var(--s2);font-size:12px;font-weight:600;color:var(--ink2)}
.tabs{display:flex;gap:28px;box-shadow:inset 0 -1px 0 var(--line)}
.tab{padding:12px 0;font-weight:650;font-size:15px;color:var(--ink3);position:relative;display:flex;gap:6px;align-items:center}
.tab.on{color:var(--ink)}
.tab.on::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2.5px;background:var(--ink);border-radius:2px}
.ftabs{display:flex;gap:28px;font-size:17px;font-weight:700;color:var(--ink3)}
.ftabs span{position:relative;padding:6px 0}
.ftabs .on{color:var(--ink)}
.ftabs .on::after{content:"";position:absolute;left:50%;bottom:0;width:24px;margin-left:-12px;height:3px;border-radius:2px;background:var(--ink)}
.seg{display:inline-flex;background:var(--s2);border-radius:999px;padding:3px;gap:2px}
.seg span{height:32px;padding:0 14px;border-radius:999px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:650;color:var(--ink2)}
.seg .on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.muted{color:var(--ink3)}
.sm{font-size:12px}
.row{display:flex;align-items:center;gap:12px}
.col{display:flex;flex-direction:column;gap:12px}
.vb{width:16px;height:16px;border-radius:50%;background:var(--ink);color:#fff;display:inline-grid;place-items:center;flex:none;vertical-align:-3px}
.vb.w{background:#fff;color:var(--ink)}
.lect{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 7px;border-radius:6px;background:var(--s2);font-size:11px;font-weight:700;color:var(--ink2)}
.radio{width:20px;height:20px;border-radius:50%;box-shadow:inset 0 0 0 2px var(--s3);flex:none;display:grid;place-items:center;background:#fff}
.radio.on{box-shadow:inset 0 0 0 6px var(--acc)}
.chk{width:20px;height:20px;border-radius:6px;box-shadow:inset 0 0 0 2px var(--s3);flex:none;display:grid;place-items:center;background:#fff}
.chk.on{background:var(--acc);box-shadow:none;color:#fff}
.tog{width:40px;height:24px;border-radius:999px;background:var(--s3);position:relative;flex:none}
.tog::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.tog.on{background:var(--acc)}.tog.on::after{left:19px}

/* floating surfaces */
.pop{position:absolute;background:#fff;border-radius:var(--r2);box-shadow:0 16px 40px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.06);padding:6px;z-index:30}
.mi{min-height:38px;padding:0 10px;border-radius:8px;display:flex;align-items:center;gap:10px;font-size:14px;color:var(--ink)}
.mi.on{background:var(--s2);font-weight:650}
.mi .k{margin-left:auto;color:var(--ink3);font-size:12px}
.scrim{position:absolute;inset:0;background:rgba(18,18,20,.55);display:grid;place-items:center;z-index:40}
.dlg{background:#fff;border-radius:20px;box-shadow:0 24px 64px rgba(0,0,0,.3);padding:24px;display:flex;flex-direction:column;gap:18px;position:relative}
.dlg h2{font-size:20px;font-weight:750;letter-spacing:-.02em}
.dlg .x{position:absolute;top:16px;right:16px}
.dlg .acts{display:flex;justify-content:flex-end;gap:10px;padding-top:4px}

/* feed card */
.stage{position:absolute;inset:0;display:flex;justify-content:center;align-items:flex-start}
.frow{display:flex;align-items:flex-end;gap:16px;position:relative}
.card{position:relative;border-radius:var(--r3);background:var(--media);overflow:hidden;color:#fff;flex:none}
.prog{position:absolute;top:12px;left:12px;right:12px;display:flex;gap:4px;z-index:3}
.prog span{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.3)}
.prog .on{background:#fff}
.ctop{position:absolute;top:24px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:center;z-index:3}
.vpill{height:28px;padding:0 10px 0 6px;border-radius:999px;background:rgba(255,255,255,.95);color:var(--ink);font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px}
.why{height:28px;padding:0 10px 0 8px;border-radius:999px;background:rgba(0,0,0,.45);color:#fff;font-size:12px;font-weight:650;display:flex;align-items:center;gap:6px}
.why.on{background:#fff;color:var(--ink)}
.cslide{position:absolute;left:0;right:0}
.sarr{position:absolute;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.9);color:var(--ink);display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.2);z-index:3}
.scr{position:absolute;left:0;right:0;bottom:0;height:300px;background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.78));z-index:2}
.cap{position:absolute;left:16px;right:16px;bottom:16px;display:flex;flex-direction:column;gap:6px;z-index:3}
.cap .nm{font-size:16px;font-weight:700;display:flex;align-items:center;gap:6px}
.cap .tt{font-size:15px;font-weight:650;line-height:1.3}
.cap .ds{font-size:14px;color:rgba(255,255,255,.88);line-height:1.35}
.cap .ds b{color:#fff}
.mod{white-space:nowrap;flex:none;display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:7px;background:rgba(255,255,255,.16);font-size:12px;font-weight:650;align-self:flex-start}
.mus{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:550;margin-top:2px}
.pp{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.95);color:var(--ink);display:grid;place-items:center;flex:none}
.rail{display:flex;flex-direction:column;align-items:center;gap:14px;width:56px;flex:none}
.rb{white-space:nowrap;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;font-weight:650;color:var(--ink2)}
.rb .c{width:48px;height:48px;border-radius:50%;background:var(--s2);display:grid;place-items:center;color:var(--ink)}
.rb.on .c{background:var(--acc);color:#fff}
.rb.sup .c{background:#fff;color:var(--ink);box-shadow:inset 0 0 0 2.5px var(--ink)}
.rav{position:relative;margin-bottom:10px}
.rav .pl{position:absolute;bottom:-9px;left:50%;margin-left:-10px;width:20px;height:20px;border-radius:50%;background:var(--acc);color:#fff;display:grid;place-items:center;box-shadow:0 0 0 2px #fff}
.arrows{position:absolute;right:24px;top:50%;margin-top:-50px;display:flex;flex-direction:column;gap:12px;z-index:4}

/* slides (content scales with container width) */
.sl{background:#fff;color:var(--ink);container-type:inline-size;position:relative;overflow:hidden;width:100%;height:100%}
.sl.dk .p,.sl.dk .ex{color:rgba(255,255,255,.82)}.sl.dk .ex{background:rgba(255,255,255,.1)}.sl.dk .bx{background:rgba(255,255,255,.16)}.sl.dk .bx.d{background:#fff;color:var(--ink)}
.sl.tall .sp{padding-top:24cqw}
.sl.dk{background:var(--media2);color:#fff}
.sl.gy{background:var(--s1)}
.sp{position:absolute;inset:0;padding:7cqw;display:flex;flex-direction:column;gap:3.2cqw}
.sl .k{font-size:3cqw;font-weight:650;color:var(--ink3)}
.sl.dk .k{color:rgba(255,255,255,.65)}
.sl h3{font-size:7.4cqw;font-weight:750;letter-spacing:-.025em;line-height:1.08}
.sl .p{font-size:3.6cqw;line-height:1.4;color:var(--ink2)}
.sl .nf{display:flex;gap:3cqw;align-items:baseline;background:var(--s1);border-radius:2.4cqw;padding:3cqw 3.4cqw}
.sl .nf b{font-size:4.4cqw;min-width:10cqw}
.sl .nf span{font-size:3.6cqw;line-height:1.35;color:var(--ink2)}
.sl .ex{font-size:3.3cqw;line-height:1.4;color:var(--ink2);background:var(--s2);border-radius:2.4cqw;padding:3cqw 3.4cqw}
.sl mark{background:var(--hl);color:inherit;border-radius:.6cqw;padding:0 .4cqw;box-shadow:0 .5cqw 0 var(--ink3)}
.sl mark sup{font-size:2.4cqw;font-weight:800;margin-left:.4cqw}
.sl.w .sp{padding:5cqw 6cqw;gap:2cqw}
.sl.w .k{font-size:1.8cqw}
.sl.w h3{font-size:4.4cqw}
.sl table{border-collapse:collapse;width:100%;font-size:2.2cqw}
.sl th{text-align:left;font-weight:700;padding:1.1cqw 1.4cqw;background:var(--s2)}
.sl td{padding:1.1cqw 1.4cqw;color:var(--ink2)}
.sl tr:nth-child(odd) td{background:var(--s1)}
.boxes{display:flex;gap:2cqw;align-items:flex-end}
.bx{border-radius:1.6cqw;background:var(--s2);font-size:3.4cqw;font-weight:700;display:grid;place-items:center}
.bx.d{background:var(--ink2);color:#fff}
.ln{height:2.2cqw;border-radius:1cqw;background:var(--s2)}
.sl.dk .ln{background:rgba(255,255,255,.18)}
.big{font-size:12cqw;font-weight:800;letter-spacing:-.04em;line-height:1}

/* tiles */
.grid{display:grid;gap:12px}
.grid>*{min-width:0}
.tile{position:relative;aspect-ratio:3/4;border-radius:10px;overflow:hidden;background:var(--media)}
.tile .sl{position:absolute;inset:0}
.tile .tsc{position:absolute;left:0;right:0;bottom:0;height:30%;background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.5))}
.tile::after{content:"";position:absolute;inset:0;border-radius:10px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.09);pointer-events:none}
.tile .st{position:absolute;left:8px;bottom:8px;color:#fff;font-size:12px;font-weight:700;display:flex;gap:4px;align-items:center}
.tile .tl{position:absolute;left:8px;top:8px;display:flex;gap:4px}
.tile .tlab{height:20px;padding:0 6px;border-radius:5px;background:rgba(255,255,255,.95);color:var(--ink);font-size:11px;font-weight:700;display:flex;align-items:center;gap:3px}
.tcap{font-size:13px;font-weight:600;margin-top:6px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tsub{font-size:12px;color:var(--ink3);display:flex;gap:6px;align-items:center}

/* panels */
.side{position:absolute;top:72px;right:0;bottom:0;background:var(--s0);display:flex;flex-direction:column;z-index:5}
.cm{display:flex;gap:10px;padding:12px 0}
.cm .bd{flex:1;display:flex;flex-direction:column;gap:3px;font-size:14px;line-height:1.4}
.cm .who{font-size:13px;font-weight:650;color:var(--ink2);display:flex;gap:6px;align-items:center}
.cm .meta{font-size:12px;color:var(--ink3);display:flex;gap:14px;margin-top:2px}
.cm .lk{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:12px;color:var(--ink3);padding-top:16px}
.at{font-weight:650;color:var(--ink);background:var(--s2);border-radius:4px;padding:0 3px}
.reply{margin-left:46px}
.pin{font-size:11px;font-weight:700;color:var(--ink3);display:flex;gap:4px;align-items:center}
.inbar{padding:12px 20px 16px;display:flex;gap:10px;align-items:center;background:var(--s0)}
.list{display:flex;flex-direction:column}
.li{display:flex;gap:12px;align-items:center;padding:10px 12px;border-radius:12px}
.li.on{background:var(--s2)}
.li .t{flex:1;min-width:0}
.li .n{font-weight:650;font-size:14px;display:flex;gap:6px;align-items:center}
.li .s{font-size:13px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bub{align-self:flex-start;max-width:62%;padding:10px 14px;border-radius:18px;background:var(--s2);font-size:14px;line-height:1.4}
.bub.me{align-self:flex-end;margin-left:auto;background:var(--acc);color:#fff}
.ncard{width:300px;border-radius:16px;background:var(--s1);overflow:hidden;box-shadow:inset 0 0 0 1px var(--line)}
.ncard.me{margin-left:auto}
.ncard .th{height:150px;background:var(--media);display:grid;place-items:center;overflow:hidden}
.ncard .mt{padding:10px 12px;display:flex;flex-direction:column;gap:2px}

/* tables */
.tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:14px}
.tbl th{text-align:left;font-size:12px;font-weight:650;color:var(--ink3);padding:10px 12px;background:var(--s1)}
.tbl th:first-child{border-radius:10px 0 0 10px}.tbl th:last-child{border-radius:0 10px 10px 0}
.tbl td{padding:14px 12px;box-shadow:inset 0 -1px 0 var(--line);vertical-align:middle}
.st2{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:999px;background:var(--s2);font-size:12px;font-weight:650;color:var(--ink2)}
.st2.d{background:var(--ink2);color:#fff}

/* editor */
.ebar{position:absolute;top:0;left:0;right:0;height:56px;display:flex;align-items:center;gap:8px;padding:0 16px;background:#fff;box-shadow:inset 0 -1px 0 var(--line);z-index:10}
.erail{position:absolute;top:56px;left:0;bottom:0;width:76px;background:#fff;display:flex;flex-direction:column;align-items:center;padding-top:8px;gap:2px;z-index:8;box-shadow:inset -1px 0 0 var(--line)}
.er{width:64px;height:62px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:11px;font-weight:600;color:var(--ink2)}
.er.on{background:var(--s2);color:var(--ink);font-weight:700}
.epan{position:absolute;top:56px;left:76px;bottom:0;width:340px;background:#fff;z-index:7;padding:16px;display:flex;flex-direction:column;gap:14px;box-shadow:inset -1px 0 0 var(--line);overflow:hidden}
.epan h4{font-size:13px;font-weight:700;color:var(--ink2);display:flex;justify-content:space-between}
.epan h4 span{font-weight:600;color:var(--ink3)}
.ws{position:absolute;top:56px;right:0;bottom:0;background:var(--s2)}
.ctx{position:absolute;top:12px;left:50%;transform:translateX(-50%);height:48px;background:#fff;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.1),0 0 0 1px rgba(0,0,0,.05);display:flex;align-items:center;padding:0 6px;gap:2px;white-space:nowrap;z-index:6}
.tb2{height:36px;min-width:36px;padding:0 8px;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:600;color:var(--ink)}
.tb2.on{background:var(--s2)}
.tb2.dd{box-shadow:inset 0 0 0 1px var(--s3)}
.sep{width:1px;height:24px;background:var(--line);margin:0 4px}
.board{position:absolute;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.08);container-type:inline-size}
.el{position:absolute}
.sel{outline:2px solid var(--ink);outline-offset:2px}
.hd{position:absolute;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px var(--ink),0 1px 3px rgba(0,0,0,.25)}
.hd.e{width:8px;height:18px;border-radius:4px}
.hd.n{width:18px;height:8px;border-radius:4px}
.guide{position:absolute;background:var(--ink2);z-index:5}
.gl{position:absolute;font-size:11px;font-weight:700;background:var(--ink2);color:#fff;border-radius:4px;padding:1px 5px;z-index:5}
.rot{position:absolute;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);display:grid;place-items:center;color:var(--ink)}
.ebot{position:absolute;left:0;right:0;bottom:0;background:#fff;box-shadow:inset 0 1px 0 var(--line)}
.thumbs{display:flex;gap:10px;align-items:center;padding:12px 20px 8px;height:100px}
.thm{position:relative;border-radius:8px;overflow:hidden;box-shadow:0 0 0 1px var(--line);flex:none;background:#fff}
.thm.on{box-shadow:0 0 0 2.5px var(--ink)}
.thm .no{position:absolute;left:4px;bottom:4px;font-size:10px;font-weight:700;background:rgba(255,255,255,.95);border-radius:4px;padding:0 4px}
.addp{width:52px;height:72px;border-radius:8px;background:var(--s1);display:grid;place-items:center;color:var(--ink2);flex:none}
.stbar{height:44px;display:flex;align-items:center;gap:12px;padding:0 16px;font-size:13px;color:var(--ink2);font-weight:600}
.zoom{width:120px;height:4px;border-radius:2px;background:var(--s3);position:relative}
.zoom::after{content:"";position:absolute;left:44%;top:-6px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px var(--ink2)}
.tpl{border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px var(--line);position:relative}
.ph{border-radius:8px;background:var(--s2);position:relative;overflow:hidden}

/* mobile */
.m{width:390px;height:844px;position:relative;overflow:hidden;background:#fff}
.m.dark{background:#111113;color:#fff}
.sb{height:44px;display:flex;justify-content:space-between;align-items:center;padding:0 26px 0 30px;font-weight:650;font-size:15px;position:relative;z-index:9}
.sbi{display:flex;gap:6px;align-items:center}
.tbar{position:absolute;bottom:0;left:0;right:0;height:84px;padding-bottom:24px;display:flex;justify-content:space-around;align-items:center;background:#fff;z-index:9;box-shadow:inset 0 1px 0 var(--line)}
.m.dark .tbar{background:#111113;box-shadow:none}
.tbi{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;font-weight:600;color:var(--ink3);width:64px;position:relative}
.tbi.on{color:var(--ink)}
.m.dark .tbi{color:rgba(255,255,255,.6)}.m.dark .tbi.on{color:#fff}
.tbc{width:46px;height:32px;border-radius:10px;background:var(--acc);color:#fff;display:grid;place-items:center}
.m.dark .tbc{background:#fff;color:var(--ink)}
.tbi .bd{position:absolute;top:-4px;left:36px;min-width:18px;height:18px;border-radius:999px;background:var(--acc);color:#fff;font-size:10px;font-weight:700;display:grid;place-items:center;padding:0 5px;box-shadow:0 0 0 2px #fff}
.home{position:absolute;bottom:8px;left:50%;margin-left:-67px;width:134px;height:5px;border-radius:3px;background:var(--ink);z-index:10}
.m.dark .home{background:#fff}
.mrail{position:absolute;right:8px;display:flex;flex-direction:column;align-items:center;gap:16px;z-index:4}
.mrb{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:12px;font-weight:650;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.sheet{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:16px 16px 0 0;z-index:20;display:flex;flex-direction:column;color:var(--ink)}
.grab{width:36px;height:5px;border-radius:3px;background:var(--s3);margin:8px auto 0}
.ann{position:absolute;font-size:12px;line-height:1.35;color:var(--ink2);background:#fff;border-radius:10px;padding:8px 10px;box-shadow:0 0 0 1.5px var(--ink3);max-width:220px;z-index:50}
`;

/* ------------------------------------------------------------------ icons (24 grid, 1.75 stroke) */
const P = {
  home: '<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17.5 14.5c2 .3 3.4 1.9 4 4.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  msg: '<path d="M21 4 3 11l7 2.5L12.5 21z"/><path d="m10 13.5 4.5-4.5"/>',
  chat: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z"/>',
  comment: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z"/><circle class="f" cx="8" cy="11.5" r="1.1"/><circle class="f" cx="12" cy="11.5" r="1.1"/><circle class="f" cx="16" cy="11.5" r="1.1"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  bookmark: '<path d="M6 3.5h12v17l-6-4.5-6 4.5z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6.5 8-6.5s7 2.5 8 6.5"/>',
  userPlus: '<circle cx="10" cy="8" r="4"/><path d="M2.5 21c1-4 4-6.5 7.5-6.5 1.5 0 2.8.4 4 1.1M19 14v6M16 17h6"/>',
  more: '<circle class="f" cx="5" cy="12" r="1.6"/><circle class="f" cx="12" cy="12" r="1.6"/><circle class="f" cx="19" cy="12" r="1.6"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 3.8 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.4 0 5.6 3.2 4.4 6.6C19.5 15.4 12 20 12 20z"/>',
  heartF: '<path class="f" d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 3.8 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.4 0 5.6 3.2 4.4 6.6C19.5 15.4 12 20 12 20z"/>',
  share: '<path d="M13.5 4.5 21 11.5l-7.5 7v-4c-5 0-8.5 1.5-10.5 5 .8-5.5 3.8-10 10.5-11z"/>',
  star: '<path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  starF: '<path class="f" d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.01"/>',
  up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  play: '<path class="f" d="M8 5.5v13l11-6.5z"/>',
  pause: '<rect class="f" x="6.5" y="5" width="4" height="14" rx="1"/><rect class="f" x="13.5" y="5" width="4" height="14" rx="1"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-5-5L5 21"/>',
  type: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  shapes: '<circle cx="7.5" cy="7.5" r="4"/><rect x="13" y="13" width="8" height="8" rx="1.5"/><path d="M17 3l4 7h-8z"/>',
  upload: '<path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.5-1-2.6 0-.9.7-1.7 1.7-1.7H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle class="f" cx="7.5" cy="11.5" r="1.2"/><circle class="f" cx="10" cy="7.5" r="1.2"/><circle class="f" cx="15" cy="7.5" r="1.2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  alignL: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle class="f" cx="4.5" cy="6" r="1.2"/><circle class="f" cx="4.5" cy="12" r="1.2"/><circle class="f" cx="4.5" cy="18" r="1.2"/>',
  spacing: '<path d="M11 6h9M11 12h9M11 18h9M5 4v16M3 6l2-2 2 2M3 18l2 2 2-2"/>',
  sparkle: '<path d="M12 3c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  send: '<path d="M21 3 10 14M21 3l-6.5 18-4.5-7-7-4.5z"/>',
  clip: '<path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17a1.7 1.7 0 0 1-2.4-2.4L15 7"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>',
  flip: '<path d="M12 3v18M8.5 7 3 17h5.5zM15.5 7 21 17h-5.5z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  notes: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  gridI: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.6 3.2 7.8 7.5 9 4.3-1.2 7.5-4.4 7.5-9V6z"/>',
  book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
  hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  friends: '<circle cx="8.5" cy="8" r="3.3"/><circle cx="16" cy="8" r="3.3"/><path d="M2.5 20c.6-3.3 3-5.3 6-5.3s5.4 2 6 5.3M15 14.8c3 .1 5.8 1.9 6.5 5.2"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 8.5 4.5 4.5 0 0 1 17.5 18z"/><path d="m9.5 13 2 2 3.5-3.5"/>',
  resize: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
  line: '<path d="M4 20 20 4"/>',
  minus: '<path d="M5 12h14"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  tri: '<path d="M12 4 21 20H3z"/>',
  arrowR: '<path d="M4 12h15M14 7l5 5-5 5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  inbox: '<path d="M3 13h5l1.5 3h5l1.5-3h5"/><path d="M5.5 5h13l2.5 8v6H3v-6z"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1"/>',
  pin: '<path d="M9 4h6l-1 6 4 3v2H6v-2l4-3zM12 15v6"/>',
  vol: '<path d="M4 9.5h4l5-4.5v14l-5-4.5H4z"/><path d="M16.5 9a4 4 0 0 1 0 6"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M10 5h8M6 19h8M14 5l-4 14"/>',
  under: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
  strike: '<path d="M4 12h16M16.5 7c-.6-1.8-2.4-3-4.5-3-2.5 0-4.5 1.5-4.5 3.5 0 3.5 9 3 9 7 0 2-2 3.5-4.5 3.5-2.2 0-4-1.2-4.6-3"/>',
  fill: '<path d="m5 11 7-7 7 7-7 7z"/><path d="M20 15s1.5 2 1.5 3a1.5 1.5 0 0 1-3 0c0-1 1.5-3 1.5-3z"/>',
  border: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/>',
  present: '<path d="M8 5.5v13l11-6.5z"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><circle class="f" cx="12" cy="19.5" r="1.3"/>',
  battery: '<rect x="2" y="7" width="18" height="10" rx="3"/><rect class="f" x="4" y="9" width="12" height="6" rx="1.5"/><path d="M22 10.5v3"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1.8 2 5.2 2 7 0"/><circle class="f" cx="9" cy="10" r="1.1"/><circle class="f" cx="15" cy="10" r="1.1"/>',
};
const I = (n, s = 20) => `<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;
const VB = (w = false, s = 16) => `<span class="vb ${w ? 'w' : ''}" style="width:${s}px;height:${s}px">${I('check', s * 0.7)}</span>`;
const av = (t, s = 36, dark = false) => `<div class="av ${dark ? 'd' : ''}" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.36)}px">${t}</div>`;
const LECT = `<span class="lect">${I('check', 11)}Lecturer</span>`;

/* ------------------------------------------------------------------ sample content */
const ME = { n: 'Lim Qi Cai', i: 'LQ' };
const MODS = {
  db: 'CT030-3-2 Database Systems', ads: 'CT044-3-2 Algorithms and Data Structures', se: 'AICT004 Software Engineering',
  net: 'CT060-3-2 Computer Networks', os: 'CT050-3-2 Operating Systems', web: 'CT076-3-2 Web Application Development',
};
const MUSIC = 'Lo-fi Study Session · Chillhop Music';

/* slides: kinds render at any width (container-query units) */
const slide = (kind, opt = {}) => {
  const hl = opt.hl;
  const S = {
    norm: `<div class="sp"><div class="k">CT030-3-2 · Week 6</div><h3>Normalisation, 1NF to 3NF</h3>
      <div class="nf"><b>1NF</b><span>${hl ? '<mark>Atomic values<sup>1</sup></mark>' : 'Atomic values'}. No repeating groups in a row.</span></div>
      <div class="nf"><b>2NF</b><span>No ${hl ? '<mark>partial dependency<sup>2</sup></mark>' : 'partial dependency'} on part of a composite key.</span></div>
      <div class="nf"><b>3NF</b><span>No transitive dependency between non-key columns.</span></div>
      <div class="ex">Example: customer_name depends on customer_id, ${hl ? '<mark>not on order_id<sup>3</sup></mark>' : 'not on order_id'}, so it moves to CUSTOMER_T.</div></div>`,
    sort: `<div class="sp"><div class="k">CT044-3-2 · Algorithms and Data Structures</div><h3>Sorting at a glance</h3>
      <table><tr><th>Algorithm</th><th>Best</th><th>Average</th><th>Worst</th><th>Space</th></tr>
      <tr><td>Bubble sort</td><td>O(n)</td><td>O(n²)</td><td>O(n²)</td><td>O(1)</td></tr>
      <tr><td>Merge sort</td><td>O(n log n)</td><td>O(n log n)</td><td>O(n log n)</td><td>O(n)</td></tr>
      <tr><td>Quick sort</td><td>O(n log n)</td><td>O(n log n)</td><td>O(n²)</td><td>O(log n)</td></tr></table></div>`,
    stack: `<div class="sp" style="gap:4cqw"><div class="k">CT044-3-2 · #dsa</div><h3>Stack vs queue</h3>
      <div class="row" style="gap:6cqw;align-items:flex-end">
        <div style="display:flex;flex-direction:column;gap:1.6cqw;width:30cqw">${['push(4) top', '3', '2', '1'].map((t, i) => `<div class="bx ${i === 0 ? 'd' : ''}" style="height:10cqw">${t}</div>`).join('')}
          <div class="p" style="text-align:center"><b>LIFO</b>: last in, first out</div></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:2cqw"><div class="boxes">${['1', '2', '3', '4'].map((t, i) => `<div class="bx ${i === 0 ? 'd' : ''}" style="height:12cqw;flex:1">${t}</div>`).join('')}</div>
          <div class="p"><b>FIFO</b>: dequeue() takes 1 from the front, enqueue() adds to the back.</div></div></div>
      <div class="ex">Undo history is a stack. A print queue is a queue.</div></div>`,
    mvc: `<div class="sp"><div class="k">AICT004 · Week 4</div><h3>Model, view, controller</h3>
      <div style="position:relative;height:44cqw;margin-top:2cqw">
        <div class="bx d" style="position:absolute;left:30cqw;top:0;width:26cqw;height:12cqw">Controller</div>
        <div class="bx" style="position:absolute;left:0;top:28cqw;width:26cqw;height:12cqw">Model</div>
        <div class="bx" style="position:absolute;right:0;top:28cqw;width:26cqw;height:12cqw">View</div>
        <div style="position:absolute;left:22cqw;top:14cqw;width:8cqw;height:1cqw;background:var(--ink3);transform:rotate(-45deg)"></div>
        <div style="position:absolute;right:22cqw;top:14cqw;width:8cqw;height:1cqw;background:var(--ink3);transform:rotate(45deg)"></div>
        <div style="position:absolute;left:28cqw;right:28cqw;top:34cqw;height:1cqw;background:var(--ink3)"></div></div>
      <div class="p">The controller handles input, updates the model, and the view re-renders from it.</div></div>`,
    blank: '',
  };
  const wide = opt.aspect === '16:9';
  return `<div class="sl ${wide ? 'w' : ''} ${opt.cls || ''}" style="width:100%;height:100%">${S[kind] ?? ''}</div>`;
};
// generic cover used by grids and thumbnails
const cover = (t, v = 'a', code = '') => {
  if (v === 'b') return `<div class="sl dk"><div class="sp" style="justify-content:flex-end;padding-bottom:26cqw"><div class="k">${code}</div><h3 style="font-size:11cqw">${t}</h3></div></div>`;
  if (v === 'c') return `<div class="sl gy"><div class="sp" style="padding-top:16cqw"><div class="k">${code}</div><h3 style="font-size:10cqw">${t}</h3><div class="boxes" style="margin-top:auto;margin-bottom:24cqw">${[22, 34, 16, 28].map((h, i) => `<div class="bx ${i === 1 ? 'd' : ''}" style="flex:1;height:${h}cqw"></div>`).join('')}</div></div></div>`;
  if (v === 'd') return `<div class="sl"><div class="sp" style="justify-content:center"><div class="k">${code}</div><div class="big">${t}</div><div class="ln" style="width:70%"></div><div class="ln" style="width:50%"></div></div></div>`;
  return `<div class="sl"><div class="sp" style="padding-top:16cqw"><div class="k">${code}</div><h3 style="font-size:10cqw">${t}</h3><div class="ln" style="width:90%;margin-top:4cqw"></div><div class="ln" style="width:75%"></div><div class="ln" style="width:82%"></div></div></div>`;
};
const COVERS = [
  ['Normalisation, 1NF to 3NF', 'a', 'CT030-3-2', '1.2K', true], ['SQL joins in one page', 'b', 'CT030-3-2', '864', false], ['O(n log n)', 'd', 'CT044-3-2', '2.4K', true],
  ['Use case diagrams: include vs extend', 'c', 'AICT004', '415', false], ['TCP vs UDP', 'b', 'CT060-3-2', '1.1K', true], ['Recursion, traced', 'a', 'CT044-3-2', '378', false],
  ['Scrum ceremonies', 'c', 'CT038-3-2', '292', false], ['Stack vs queue', 'a', 'CT044-3-2', '957', true], ['Deadlock: four conditions', 'b', 'CT050-3-2', '640', false],
  ["Crow's foot notation", 'c', 'CT030-3-2', '511', false], ['Merge sort step by step', 'a', 'CT044-3-2', '733', false], ['REST in five rules', 'b', 'CT076-3-2', '188', false],
];
const tile = (c, o = {}) => `<div><div class="tile">${cover(c[0], c[1], c[2])}<div class="tsc"></div>
  <div class="tl">${o.pinned ? `<span class="tlab">${I('pin', 11)}Pinned</span>` : ''}${c[4] && !o.pinned ? `<span class="tlab">${I('check', 11)}Verified</span>` : ''}${o.priv ? `<span class="tlab">${I('lock', 11)}Friends</span>` : ''}</div>
  <div class="st">${I('heart', 14)}${c[3]}</div></div>${o.cap ? `<div class="tcap">${c[0]}</div><div class="tsub">${o.sub || c[2]}</div>` : ''}</div>`;

/* ------------------------------------------------------------------ shell */
const NAV = [['For You', 'home'], ['Following', 'users'], ['Explore', 'compass'], ['Create', 'plus'], ['Messages', 'msg'], ['Notifications', 'bell'], ['Saved', 'bookmark'], ['Profile', 'user'], ['More', 'more']];
const ADMIN = [['Reports', 'flag', 5], ['Users', 'users'], ['Lecturer applications', 'shield'], ['Modules', 'book']];
const nav = (on, o = {}) => {
  const badge = (n) => (n === 'Notifications' ? 3 : n === 'Messages' ? 2 : 0);
  const icon = (n, ic) => (n === 'Create' ? `<span class="cr">${I('plus', 18)}</span>` : I(ic, 24));
  if (o.collapsed) {
    return `<nav class="nav c"><div class="nav-head"><div class="mark">P</div><div class="ib" title="Expand menu">${I('sidebar', 22)}</div></div>
      <div class="ni" style="background:var(--s2);border-radius:999px">${I('search', 22)}</div>
      ${NAV.map(([n, ic]) => `<div class="ni ${n === on ? 'on' : ''}" title="${n}">${icon(n, ic)}${badge(n) ? '<span class="dot"></span>' : ''}</div>`).join('')}
      ${o.admin ? `<div style="height:1px;width:32px;background:var(--line);margin:8px 0"></div>${ADMIN.map(([n, ic]) => `<div class="ni ${n === on ? 'on' : ''}">${I(ic, 24)}</div>`).join('')}` : ''}
      <div style="margin-top:auto"></div></nav>`;
  }
  return `<nav class="nav"><div class="nav-head"><div class="logo"><span class="mark">P</span>PARP</div><div class="ib" title="Collapse menu">${I('sidebar', 22)}</div></div>
    <div class="nsearch">${I('search', 18)}Search</div>
    ${NAV.filter(([n]) => !(o.admin && n === 'More')).map(([n, ic]) => `<div class="ni ${n === on ? 'on' : ''}">${icon(n, ic)}${n}${badge(n) ? `<span class="cnt">${badge(n)}</span>` : ''}</div>`).join('')}
    ${o.admin ? `<div class="ngrp">Admin</div>${ADMIN.map(([n, ic, c]) => `<div class="ni ${n === on ? 'on' : ''}">${I(ic, 24)}${n}${c ? `<span class="cnt">${c}</span>` : ''}</div>`).join('')}` : ''}
    <div class="nfoot">About · Help · Terms · Privacy<br>© 2026 PARP</div></nav>`;
};
const util = (me = ME.i) => `<span class="b sm o">${I('plus', 16)}Create</span>${av(me, 36)}`;
const app = (on, body, o = {}) => `<div class="app">${nav(on, o)}<div class="main">
  <div class="top"><div class="l">${o.left || ''}</div>${o.center ? `<div>${o.center}</div>` : ''}<div class="r">${o.right ?? util(o.me)}</div></div>
  ${body}</div>${o.over || ''}</div>`;
const title = (t, sub = '') => `<h1>${t}</h1>${sub ? `<span class="muted" style="font-size:15px;font-weight:600">${sub}</span>` : ''}`;
const backT = (t) => `<span class="ib s sm">${I('back', 18)}</span><h1>${t}</h1>`;
const ftabs = (on = 'For You') => `<div class="ftabs">${['For You', 'Following'].map((t) => `<span class="${t === on ? 'on' : ''}">${t}</span>`).join('')}</div>`;

/* ------------------------------------------------------------------ feed card + rail */
const CW = 456, CH = 812;
const feedCard = (o) => {
  const w = o.w ?? CW, h = o.h ?? CH, a = o.aspect ?? '4:5';
  let sh, top;
  if (a === '9:16') { sh = h; top = 0; } else if (a === '4:5') { sh = Math.round(w * 1.25); top = 64; } else { sh = Math.round(w * 9 / 16); top = Math.round(h * 0.27); }
  const n = o.count ?? 6, idx = o.idx ?? 1;
  return `<div class="card" style="width:${w}px;height:${h}px">
    <div class="cslide" style="top:${top}px;height:${sh}px">${slide(o.kind ?? 'norm', { aspect: a, cls: a === '9:16' ? 'dk tall' : '' })}</div>
    ${a === '9:16' ? '<div class="scr"></div><div class="scr" style="top:0;bottom:auto;height:110px;transform:scaleY(-1)"></div>' : ''}
    <div class="prog">${Array.from({ length: n }, (_, i) => `<span class="${i <= idx ? 'on' : ''}"></span>`).join('')}</div>
    <div class="ctop">${o.verified ? `<span class="vpill">${VB(false, 18)}Verified by ${o.verified}</span>` : '<span></span>'}<span class="why ${o.whyOn ? 'on' : ''}">${I('info', 16)}Why this note?</span></div>
    ${a === '16:9' ? `<div style="position:absolute;top:${top + sh + 16}px;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:14px;z-index:3;font-size:13px;font-weight:650"><span class="sarr" style="position:static">${I('left', 18)}</span>Slide ${idx + 1} of ${n}<span class="sarr" style="position:static">${I('right', 18)}</span></div>`
      : `<div class="sarr" style="left:10px;top:${top + sh / 2 - 16}px">${I('left', 18)}</div><div class="sarr" style="right:10px;top:${top + sh / 2 - 16}px">${I('right', 18)}</div>`}
    <div class="cap"><div class="nm">${o.author ?? 'Aina Rahman'}${o.lect ? ` ${VB(true, 16)}` : ''}<span style="font-weight:500;opacity:.7;font-size:14px">· ${o.age ?? '2d ago'}</span></div>
      <div class="tt">${o.title ?? 'Normalisation, 1NF to 3NF in one page'}</div>
      <div class="ds">${o.desc ?? 'Worked example with the ORDER_T table. <b>#normalisation</b> <b>#sql</b> <b>#ct030</b>'}</div>
      <span class="mod">${I('book', 14)}${o.mod ?? MODS.db}</span>
      ${o.music === false ? '' : `<div class="mus"><span class="pp">${I(o.playing === false ? 'play' : 'pause', 14)}</span>${I('music', 16)}${o.music ?? MUSIC}</div>`}</div></div>`;
};
const rail = (o = {}) => `<div class="rail"><div class="rav">${av(o.av ?? 'AR', 48, true)}${o.following ? '' : `<span class="pl">${I('plus', 13)}</span>`}</div>
  ${o.superlike ? `<div class="rb sup"><span class="c">${I('star', 24)}</span>Super Like</div>` : ''}
  <div class="rb ${o.liked ? 'on' : ''}"><span class="c">${I(o.liked ? 'heartF' : 'heart', 24)}</span>${o.likes ?? '1.2K'}</div>
  <div class="rb ${o.commentsOn ? 'on' : ''}"><span class="c">${I('comment', 24)}</span>${o.comments ?? '44'}</div>
  <div class="rb ${o.saved ? 'on' : ''}"><span class="c">${I('bookmark', 22)}</span>${o.saves ?? '318'}</div>
  <div class="rb"><span class="c">${I('share', 22)}</span>Share</div>
  <div class="rb"><span class="c">${I('more', 22)}</span></div></div>`;
const arrows = `<div class="arrows"><span class="ib s" style="width:44px;height:44px">${I('up', 22)}</span><span class="ib s" style="width:44px;height:44px">${I('down', 22)}</span></div>`;
const feedBody = (card, r, o = {}) => `<div class="content"><div class="stage" style="${o.right ? `right:${o.right}px` : ''}"><div class="frow">${card}${r}${o.pop || ''}</div></div>${o.noArrows ? '' : arrows}</div>`;

/* ------------------------------------------------------------------ mobile parts */
const sbar = `<div class="sb"><span>9:41</span><span class="sbi">${I('wifi', 17)}${I('battery', 24)}</span></div>`;
const tabbar = (on, dark) => `<div class="tbar">${[['Home', 'home'], ['Discover', 'compass'], ['', 'plus'], ['Inbox', 'inbox'], ['Profile', 'user']].map(([n, ic]) =>
  n === '' ? '<div class="tbi"><span class="tbc">' + I('plus', 20) + '</span></div>'
    : `<div class="tbi ${n === on ? 'on' : ''}">${I(ic, 24)}${n}${n === 'Inbox' ? '<span class="bd">5</span>' : ''}</div>`).join('')}</div><div class="home"></div>`;
const mob = (inner, o = {}) => `<div class="m ${o.dark ? 'dark' : ''}">${sbar}${inner}${o.tab === false ? '<div class="home"></div>' : tabbar(o.tab ?? 'Home')}</div>`;
const mTop = (l, c, r) => `<div style="height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;position:relative;z-index:5"><div style="width:60px">${l || ''}</div><div style="font-weight:700;font-size:17px">${c || ''}</div><div style="width:60px;display:flex;justify-content:flex-end;gap:4px">${r || ''}</div></div>`;
const mobileFeed = (sheet = '') => {
  const sTop = 150, sw = 318, sh = Math.round(318 * 1.25);
  const mb = (ic, c, on) => `<div class="mrb"><span style="width:46px;height:46px;border-radius:50%;background:${on ? '#fff' : 'rgba(20,20,22,.62)'};color:${on ? 'var(--ink)' : '#fff'};display:grid;place-items:center">${I(ic, 24)}</span>${c}</div>`;
  return mob(`<div style="position:absolute;top:44px;left:0;right:0;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;z-index:5;color:#fff">
      <span class="ib" style="color:#fff">${I('menu', 24)}</span><div class="ftabs" style="color:rgba(255,255,255,.6)"><span class="on" style="color:#fff">For You</span><span>Following</span></div><span class="ib" style="color:#fff">${I('search', 24)}</span></div>
    <style>.m.dark .ftabs .on::after{background:#fff}</style>
    <div style="position:absolute;top:102px;left:12px;right:12px;display:flex;gap:4px;z-index:4">${[1, 1, 0, 0, 0, 0].map((x) => `<span style="flex:1;height:3px;border-radius:2px;background:${x ? '#fff' : 'rgba(255,255,255,.3)'}"></span>`).join('')}</div>
    <div style="position:absolute;top:112px;left:12px;right:12px;display:flex;justify-content:space-between;z-index:4"><span class="vpill">${VB(false, 18)}Verified by Dr Lee</span><span class="why">${I('info', 16)}Why?</span></div>
    <div style="position:absolute;top:${sTop}px;left:12px;width:${sw}px;height:${sh}px;border-radius:10px;overflow:hidden">${slide('norm')}</div>
    <div class="mrail" style="top:250px;right:6px">
      <div class="rav" style="margin-bottom:4px">${av('AR', 46, true)}<span class="pl">${I('plus', 13)}</span></div>
      ${mb('heartF', '1.2K', true)}${mb('comment', '44')}${mb('bookmark', '318')}${mb('share', 'Share')}</div>
    <div style="position:absolute;left:14px;right:70px;top:${sTop + sh + 16}px;display:flex;flex-direction:column;gap:6px;z-index:4">
      <div style="font-weight:700;font-size:16px">Aina Rahman <span style="opacity:.7;font-weight:500;font-size:14px">· 2d ago</span></div>
      <div style="font-size:14px;font-weight:600">Normalisation, 1NF to 3NF in one page <b style="opacity:.85">#normalisation #sql</b></div>
      <div class="row" style="gap:8px"><span class="mod">${I('book', 14)}CT030-3-2 Database Systems</span></div><div class="mus" style="margin:0;white-space:nowrap"><span class="pp" style="width:24px;height:24px">${I('pause', 12)}</span>${I('music', 15)}${MUSIC}</div></div>${sheet}`, { dark: true, tab: 'Home' });
};

/* ------------------------------------------------------------------ editor parts */
const ERAIL = [['Templates', 'layout'], ['Elements', 'shapes'], ['Text', 'type'], ['Uploads', 'upload'], ['Photos', 'image'], ['Music', 'music'], ['Background', 'palette']];
const ebar = (o = {}) => `<div class="ebar"><span class="b g sm" style="padding:0 10px">${I('left', 18)}Home</span><span class="sep"></span>
  <span class="tb2" style="font-size:14px;font-weight:650">${o.title ?? 'Normalisation, 1NF to 3NF'} ${I('pencil', 14)}</span>
  <span class="row muted sm" style="gap:6px;margin-left:6px">${I('cloud', 18)}Saved 14:32</span><span class="sep"></span>
  <span class="ib sm">${I('undo', 20)}</span><span class="ib sm" style="opacity:.45">${I('redo', 20)}</span><span class="sep"></span>
  <span class="tb2 dd ${o.resizeOn ? 'on' : ''}">${I('resize', 16)}${o.aspect ?? '4:5 Portrait'} ${I('down', 14)}</span>
  <div style="margin-left:auto" class="row"><span class="b sm g">${I('present', 16)}Preview</span><span class="b sm">Save draft</span><span class="b sm p">${I('upload', 16)}Publish</span></div></div>`;
const erail = (on) => `<div class="erail">${ERAIL.map(([n, ic]) => `<div class="er ${n === on ? 'on' : ''}">${I(ic, 22)}${n}</div>`).join('')}</div>`;
const ebottom = (o = {}) => {
  const a = o.aspect ?? '4:5';
  const [tw, th] = a === '16:9' ? [128, 72] : a === '9:16' ? [41, 72] : [58, 72];
  const kinds = o.thumbs ?? ['cover:Normalisation, 1NF to 3NF', 'norm', 'blank', 'blank', 'blank', 'blank'];
  return `<div class="ebot" style="left:${o.left ?? 416}px">${o.notes ? `<div style="padding:12px 20px 0;display:flex;flex-direction:column;gap:6px"><div class="row" style="justify-content:space-between"><b class="sm" style="font-size:13px">Page notes · slide 2</b><span class="muted sm">Only you see page notes</span></div><div class="in v ta" style="min-height:64px;background:#fff">Mention that BCNF is out of scope for the quiz. Link this to the ENROL_T example from Week 5.</div></div>` : ''}
  <div class="thumbs">${kinds.map((k, i) => `<div class="thm ${i === (o.cur ?? 1) ? 'on' : ''}" style="width:${tw}px;height:${th}px">${k.startsWith('cover:') ? cover(k.slice(6), 'b', 'CT030-3-2') : slide(k, { aspect: a })}<span class="no">${i + 1}</span></div>`).join('')}
    <div class="addp" style="height:${th}px">${I('plus', 22)}</div><div class="addp" style="height:${th}px" title="Duplicate slide">${I('copy', 20)}</div></div>
  <div class="stbar"><span class="b sm g ${o.notes ? '' : ''}" style="${o.notes ? 'background:var(--s2)' : ''}">${I('notes', 16)}Notes</span><span class="muted">Drag thumbnails to reorder</span>
    <div style="margin-left:auto" class="row"><span>Slide ${(o.cur ?? 1) + 1} of ${kinds.length}</span><span class="sep"></span><div class="zoom"></div><span>${o.zoom ?? '64%'}</span><span class="ib sm">${I('gridI', 18)}</span><span class="ib sm">${I('resize', 18)}</span></div></div></div>`;
};
const selBox = (x, y, w, h, o = {}) => `<div class="sel" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:4;pointer-events:none">
  ${[[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => `<span class="hd" style="left:${a * w - 6 + (a ? 2 : -2)}px;top:${b * h - 6 + (b ? 2 : -2)}px"></span>`).join('')}
  <span class="hd e" style="left:-6px;top:${h / 2 - 9}px"></span><span class="hd e" style="left:${w - 2}px;top:${h / 2 - 9}px"></span>
  ${o.vh ? `<span class="hd n" style="left:${w / 2 - 9}px;top:-6px"></span><span class="hd n" style="left:${w / 2 - 9}px;top:${h - 2}px"></span>` : ''}
  <span class="rot" style="left:${w / 2 - 13}px;top:${h + 14}px">${I('rotate', 14)}</span></div>`;
const editor = (o) => {
  const panelW = o.panel === false ? 0 : 340;
  const left = 76 + panelW;
  return `<div class="full">${ebar(o.bar)}${erail(o.rail)}${o.panel === false ? '' : `<div class="epan">${o.panel}</div>`}
    <div class="ws" style="left:${left}px">${o.ctx ? `<div class="ctx" style="${o.ctxStyle || ''}">${o.ctx}</div>` : ''}${o.board}</div>${ebottom({ left, ...(o.bottom || {}) })}${o.over || ''}</div>`;
};
const searchIn = (t) => `<div class="in" style="height:40px;border-radius:999px">${I('search', 18)}${t}</div>`;
const textToolbar = `<span class="tb2 dd" style="width:150px;justify-content:space-between">Source Sans 3 ${I('down', 14)}</span><span class="tb2 dd">${I('minus', 14)}<b style="width:26px;text-align:center">32</b>${I('plus', 14)}</span>
  <span class="tb2" title="Text colour"><span style="display:flex;flex-direction:column;align-items:center;font-weight:800;font-size:15px;line-height:1">A<span style="width:16px;height:4px;border-radius:2px;background:var(--ink)"></span></span></span>
  <span class="tb2 on">${I('bold', 18)}</span><span class="tb2">${I('italic', 18)}</span><span class="tb2">${I('under', 18)}</span><span class="tb2">${I('strike', 18)}</span><span class="sep"></span>
  <span class="tb2">${I('alignL', 18)}</span><span class="tb2">${I('list', 18)}</span><span class="tb2">${I('spacing', 18)}</span><span class="sep"></span>
  <span class="tb2">${I('sparkle', 16)}Effects</span><span class="tb2">${I('layers', 16)}Position</span><span class="sep"></span><span class="tb2">${I('lock', 18)}</span><span class="tb2">${I('copy', 18)}</span><span class="tb2">${I('trash', 18)}</span>`;

/* ------------------------------------------------------------------ dialogs */
const dlg = (w, h2, body, acts, o = {}) => `<div class="scrim" style="${o.scrimStyle || ''}"><div class="dlg" style="width:${w}px">${o.icon || ''}<h2>${h2}</h2><span class="ib x">${I('x', 20)}</span>${body}${acts ? `<div class="acts">${acts}</div>` : ''}</div></div>`;

/* ------------------------------------------------------------------ screens */
const landingBase = (o = {}) => `<div class="full" style="background:var(--s0)">
  <div style="height:72px;display:flex;align-items:center;padding:0 48px"><div class="logo"><span class="mark">P</span>PARP</div>
    <div class="row" style="margin-left:auto"><span class="b g">About</span><span class="b">Log in</span><span class="b p">Sign up</span></div></div>
  <div style="position:absolute;left:96px;top:200px;width:620px;display:flex;flex-direction:column;gap:24px">
    <h1 style="font-size:64px;line-height:1.02;letter-spacing:-.045em;font-weight:800">Lecture notes, one swipe at a time.</h1>
    <p style="font-size:19px;line-height:1.5;color:var(--ink2);max-width:540px">PARP is a vertical feed of slide notes written by APU students and checked by lecturers. Search by module, save what helps, and ask the author about a slide.</p>
    <div class="row" style="gap:12px"><span class="b p lg">Create account</span><span class="b lg">Log in</span></div>
    <div class="col" style="gap:10px;margin-top:20px;font-size:15px;color:var(--ink2)">
      <div class="row" style="gap:10px">${VB(false, 20)}Notes a lecturer has checked carry their name.</div>
      <div class="row" style="gap:10px">${I('book', 20)}Every note is filed under an APU module code.</div>
      <div class="row" style="gap:10px">${I('chat', 20)}Messages start from the note you are asking about.</div></div></div>
  <div style="position:absolute;right:150px;top:96px;width:390px;height:844px;transform:scale(.88);transform-origin:top center;border-radius:48px;overflow:hidden;box-shadow:0 0 0 10px #2a2a2f,0 30px 60px rgba(0,0,0,.25)">${mobileFeed()}</div>
  <div style="position:absolute;left:96px;bottom:28px;font-size:12px;color:var(--ink3)">About · Help · Terms · Privacy · © 2026 PARP</div>${o.over || ''}</div>`;

const PROGRAMMES = ['BSc (Hons) Software Engineering', 'BSc (Hons) Computer Science', 'BSc (Hons) Information Technology', 'BSc (Hons) Cyber Security', 'BSc (Hons) Data Science and Business Analytics'];

const screens = [];
const add = (id, html, mobile = false) => screens.push([id, html, mobile]);

add('01_landing', landingBase());

add('02_register', landingBase({ over: dlg(500, 'Create your PARP account', `
  <div class="seg" style="align-self:flex-start"><span>${I('user', 16)}Student</span><span class="on">${I('book', 16)}Lecturer</span></div>
  <div class="fld"><label>Full name</label><div class="in v">Lee Chin Wei</div></div>
  <div class="fld"><label>APU email</label><div class="in v">lee.chinwei@apu.edu.my</div></div>
  <div class="fld"><label>Password</label><div class="in v">••••••••••••<span class="end muted">${I('eye', 18)}</span></div><span class="help">At least 8 characters, with a letter and a number.</span></div>
  <div class="fld"><label>Programme</label><div class="in v">BSc (Hons) Software Engineering<span class="end">${I('down', 16)}</span></div><span class="help">Chosen from the programme list in the module catalogue.</span></div>
  <div class="fld"><label>Staff ID</label><div class="in v">S10482</div><span class="help">Lecturer features unlock after an administrator approves your staff ID. Until then you use PARP as a student.</span></div>
  <span class="b p lg w">Create account</span><div class="muted" style="text-align:center">Already have an account? <b style="color:var(--ink)">Log in</b></div>`, '') }));

add('03_login', landingBase({ over: dlg(440, 'Log in to PARP', `
  <div class="fld"><label>APU email</label><div class="in v">tp072229@mail.apu.edu.my</div></div>
  <div class="fld"><label>Password</label><div class="in er v">••••••••<span class="end muted">${I('eye', 18)}</span></div>
    <span class="err" role="alert">${I('info', 16)}Email or password is incorrect. Check both and try again.</span></div>
  <span class="b p lg w">Log in</span>
  <div class="muted" style="text-align:center">Don't have an account? <b style="color:var(--ink)">Sign up</b></div>`, '') }));

// 04 feed, nav expanded, 4:5 note, student view
add('04_feed', app('For You', feedBody(feedCard({ verified: 'Dr Lee', idx: 1 }), rail({ liked: true })), { center: ftabs() }));

// 05 feed, nav collapsed, 16:9 letterboxed note, lecturer view with Super Like
add('05_feed_collapsed', app('For You', feedBody(feedCard({ aspect: '16:9', kind: 'sort', author: 'Hafiz Ismail', title: 'Sorting algorithms compared', desc: 'Best, average and worst case in one table. <b>#dsa</b> <b>#sorting</b> <b>#bigO</b>', mod: MODS.ads, idx: 0, count: 4, music: 'Rainy Library · Lofi Fruits' }), rail({ superlike: true, av: 'HI', likes: '386', comments: '12', saves: '97' })),
  { collapsed: true, center: ftabs(), me: 'LC' }));

// 06 comments panel
const comment = (a, name, body, meta, o = {}) => `<div class="cm ${o.reply ? 'reply' : ''}">${av(a, o.reply ? 28 : 36, o.dark)}<div class="bd">${o.pin ? `<span class="pin">${I('pin', 12)}Pinned by author</span>` : ''}<span class="who">${name}</span><div>${body}</div><div class="meta"><span>${meta}</span><b>Reply</b></div>${o.more || ''}</div><div class="lk">${I('heart', 18)}${o.likes ?? ''}</div></div>`;
const commentsPanel = (o = {}) => `<div class="side" style="width:440px">
  <div style="padding:16px 20px 0;display:flex;align-items:center;justify-content:space-between"><b style="font-size:17px">Comments 44</b><span class="ib sm">${I('x', 20)}</span></div>
  <div style="padding:0 20px;flex:1;overflow:hidden">
    ${comment('LC', `Dr Lee Chin Wei ${LECT}`, 'Clear summary. On slide 3, a table can be in 3NF and still break BCNF, so keep the example to single-column keys.', '2d', { pin: true, likes: 86, dark: true })}
    ${comment('AR', 'Aina Rahman', 'Which slide has the partial dependency example?', '1d', { likes: 12, more: '' })}
    ${comment('LQ', 'Lim Qi Cai <span class="lect" style="background:var(--s3)">Author</span>', '<span class="at">@ainarahman</span> slide 2, the ENROL_T table with (student_id, module_id).', '20h', { reply: true, likes: 5 })}
    <div class="reply muted sm" style="font-weight:650;margin:-4px 0 4px 46px;display:flex;gap:4px;align-items:center">View 1 more reply ${I('down', 14)}</div>
    ${comment('HI', 'Hafiz Ismail', 'Saved this for the CT030 quiz on Friday.', '5h', { likes: 4 })}
    ${comment('CW', 'Chloe Wong', 'Could you add a BCNF slide after this one?', '3h', { likes: 2 })}
  </div>
  <div style="position:relative">
    <div class="pop" style="left:20px;right:20px;bottom:76px"><div class="muted sm" style="padding:6px 10px;font-weight:650">Mention someone in this thread or a friend</div>
      ${[['AR', 'Aina Rahman', '@ainarahman · in this thread'], ['AK', 'Arjun Kumar', '@arjunk · friend'], ['AH', 'Aiman Hakim', '@aimanh · friend']].map(([i, n, s], k) => `<div class="mi ${k === 0 ? 'on' : ''}">${av(i, 28)}<div><div style="font-weight:650">${n}</div><div class="muted sm">${s}</div></div></div>`).join('')}</div>
    <div class="inbar"><div class="in fo v" style="flex:1;border-radius:999px;height:44px">Thanks! <span class="at">@ai</span><span style="width:1.5px;height:18px;background:var(--ink)"></span><span class="end muted">${I('at', 18)}${I('smile', 18)}</span></div><span class="b p sm" style="height:40px">Post</span></div></div></div>`;
add('06_feed_comments', app('For You', feedBody(feedCard({ verified: 'Dr Lee', idx: 2 }), rail({ liked: true, commentsOn: true }), { right: 440, noArrows: true }) + commentsPanel(), { center: '' }));

// 07 why panel, 9:16 note
const whyPop = `<div class="pop" style="left:${CW - 150}px;top:72px;width:380px;padding:18px;display:flex;flex-direction:column;gap:14px">
  <div class="row" style="justify-content:space-between"><b style="font-size:16px">Why you're seeing this note</b><span class="ib sm">${I('x', 18)}</span></div>
  <div class="muted" style="font-size:13px;margin-top:-6px">Every note gets the same four scores. Higher totals appear earlier in For You.</div>
  ${[['Engagement', 'E', 0.71, 0.3, '412 likes and 44 comments'], ['Recency', 'R', 0.84, 0.25, 'Posted 18 hours ago'], ['Lecturer validation', 'V', 1, 0.3, 'Super Liked by Dr Lee'], ['Hashtag match', 'M', 0.4, 0.15, '#dsa is in your recent interests']].map(([n, k, v, w, why]) =>
    `<div style="display:flex;flex-direction:column;gap:6px"><div class="row" style="justify-content:space-between;font-size:14px"><b>${n} (${k})</b><span class="muted" style="font-size:13px">${v.toFixed(2)} × ${w.toFixed(2)} = <b style="color:var(--ink)">${(v * w).toFixed(2)}</b></span></div>
     <div style="height:8px;border-radius:4px;background:var(--s2)"><div style="height:8px;width:${v * 100}%;border-radius:4px;background:var(--acc)"></div></div><span class="muted sm">${why}</span></div>`).join('')}
  <div class="row" style="justify-content:space-between;background:var(--s1);border-radius:10px;padding:10px 12px"><b>Score</b><b style="font-size:18px">0.78</b></div></div>`;
add('07_feed_ranking', app('For You', feedBody(feedCard({ aspect: '9:16', kind: 'stack', verified: 'Dr Lee', whyOn: true, author: 'Arjun Kumar', title: 'Stack vs queue, with real examples', desc: 'Push, pop, enqueue, dequeue. <b>#dsa</b> <b>#stack</b> <b>#queue</b>', mod: MODS.ads, idx: 0, count: 5, music: 'Sunday Morning · Chillhop Music' }), rail({ av: 'AK', likes: '412', comments: '44', saves: '203' }), { pop: whyPop }), { center: ftabs() }));

add('08_feed_mobile', mobileFeed(), true);

const mComments = `<div style="position:absolute;inset:0;background:rgba(0,0,0,.35);z-index:15"></div><div class="sheet" style="height:560px;bottom:0;z-index:20">
  <div class="grab"></div><div style="display:flex;justify-content:center;align-items:center;padding:10px 16px;position:relative"><b style="font-size:15px">44 comments</b><span class="ib sm" style="position:absolute;right:10px">${I('x', 18)}</span></div>
  <div style="padding:0 16px;flex:1;overflow:hidden;font-size:13px">
    ${comment('LC', `Dr Lee Chin Wei ${LECT}`, 'Clear summary. On slide 3, a table can be in 3NF and still break BCNF.', '2d', { pin: true, likes: 86, dark: true })}
    ${comment('AR', 'Aina Rahman', 'Which slide has the partial dependency example?', '1d', { likes: 12 })}
    ${comment('LQ', 'Lim Qi Cai · Author', '<span class="at">@ainarahman</span> slide 2, the ENROL_T table.', '20h', { reply: true, likes: 5 })}
    ${comment('HI', 'Hafiz Ismail', 'Saved this for the CT030 quiz on Friday.', '5h', { likes: 4 })}</div>
  <div style="padding:10px 12px 34px;display:flex;gap:8px;align-items:center;box-shadow:inset 0 1px 0 var(--line)">${av('LQ', 32)}<div class="in" style="flex:1;border-radius:999px;height:40px">Add comment…<span class="end">${I('at', 18)}${I('smile', 18)}</span></div></div></div>`;
add('09_comments_mobile', mobileFeed(mComments).replace(tabbar('Home'), '<div class="home" style="z-index:30;background:var(--ink)"></div>'), true);

// 10 note detail with annotations
const annItem = (n, q, a, name, body, meta, on) => `<div style="display:flex;gap:12px;padding:14px;border-radius:12px;${on ? 'background:#fff;box-shadow:0 0 0 2px var(--ink)' : 'background:#fff'}">
  <span style="width:24px;height:24px;border-radius:50%;background:var(--acc);color:#fff;font-size:12px;font-weight:800;display:grid;place-items:center;flex:none">${n}</span>
  <div style="flex:1;display:flex;flex-direction:column;gap:6px"><div style="font-size:13px;color:var(--ink2);background:var(--s1);border-radius:8px;padding:6px 10px">Slide 2 · “${q}”</div>
    <div class="row" style="gap:8px">${av(a, 24, a === 'LC')}<span class="who" style="font-size:13px;font-weight:650">${name}</span></div><div style="font-size:14px;line-height:1.4">${body}</div>
    <div class="meta muted sm" style="display:flex;gap:14px">${meta}</div></div></div>`;
add('10_note_detail', app('For You', `<div class="content">
  <div style="position:absolute;left:48px;top:0;width:560px;display:flex;flex-direction:column;gap:14px">
    <div class="row">${av('AR', 44, true)}<div><div style="font-weight:700;font-size:16px">Aina Rahman</div><div class="muted sm">BSc (Hons) Software Engineering · 2d ago</div></div><span class="b sm p" style="margin-left:auto">Follow</span><span class="ib s sm">${I('more', 18)}</span></div>
    <div style="position:relative;width:560px;height:700px;border-radius:16px;overflow:hidden;box-shadow:0 0 0 1px var(--line)">${slide('norm', { hl: true })}
      <div class="sarr" style="left:10px;top:334px">${I('left', 18)}</div><div class="sarr" style="right:10px;top:334px">${I('right', 18)}</div>
      <div class="pop" style="left:150px;top:256px;padding:4px;display:flex;gap:2px"><span class="tb2 on">${I('pencil', 16)}Annotate</span><span class="tb2">${I('copy', 16)}Copy</span></div>
      <div style="position:absolute;bottom:12px;left:0;right:0;display:flex;justify-content:center;gap:6px">${[0, 1, 0, 0, 0, 0].map((x) => `<span style="width:${x ? 18 : 7}px;height:7px;border-radius:4px;background:${x ? 'var(--ink)' : 'var(--s3)'}"></span>`).join('')}</div></div></div>
  <div style="position:absolute;left:628px;top:56px;display:flex;flex-direction:column;gap:12px">${[['heartF', '1.2K', true], ['comment', '44'], ['pencil', '6'], ['bookmark', '318'], ['share', 'Share']].map(([ic, c, on]) => `<div class="rb ${on ? 'on' : ''}"><span class="c">${I(ic, 22)}</span>${c}</div>`).join('')}</div>
  <div class="side" style="width:500px;top:0">
    <div style="padding:20px 24px 0;display:flex;flex-direction:column;gap:6px"><div style="font-size:18px;font-weight:750;letter-spacing:-.01em">Normalisation, 1NF to 3NF in one page</div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><span class="tag">${I('book', 13)}CT030-3-2 Database Systems</span><span class="tag">#normalisation</span><span class="tag">#sql</span><span class="tag" style="background:var(--ink);color:#fff">${I('check', 13)}Verified by Dr Lee</span></div></div>
    <div class="tabs" style="padding:0 24px;margin-top:10px"><span class="tab">Comments 44</span><span class="tab on">Annotations 6</span></div>
    <div style="padding:14px 20px;display:flex;flex-direction:column;gap:10px;flex:1;overflow:hidden">
      <div class="row muted sm" style="justify-content:space-between"><span>Select text on a slide to annotate it</span><span class="chip o" style="height:28px">Slide 2 ${I('down', 14)}</span></div>
      ${annItem(1, 'Atomic values', 'LC', `Dr Lee Chin Wei ${LECT}`, 'Atomic means one value per cell for this table. A full address string can still count as atomic.', '<span>2d</span><b>Reply</b><b>Report</b>', true)}
      ${annItem(2, 'partial dependency', 'TM', 'Tan Mei Ling', 'Only possible when the key has two or more columns, so 2NF is automatic with a single-column key.', '<span>1d</span><b>Reply</b><b>Report</b>')}
      ${annItem(3, 'not on order_id', 'HI', 'Hafiz Ismail', 'This is the transitive dependency case from the 3NF row above.', '<span>6h</span><b>Reply</b><b>Report</b>')}</div>
    <div class="inbar" style="padding:12px 20px 16px"><div class="in" style="flex:1;border-radius:999px">Add an annotation to “partial dependency”…</div><span class="b p sm" style="height:40px">Add</span></div></div></div>`, { left: backT('Note'), right: '' }));

// ---------- editor screens
const EW = 1440 - 416, EH = 900 - 56 - 144; // workspace size with panel open
const boardAt = (w, h, inner, o = {}) => {
  const ws = o.wsW ?? EW, wh = o.wsH ?? EH, top = o.top ?? 72;
  const x = Math.round((ws - w) / 2), y = Math.round(top + (wh - top - h) / 2);
  return { x, y, html: `<div class="board" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${inner}</div>` };
};
const tplThumb = (t, v, code) => `<div class="tpl" style="aspect-ratio:4/5">${cover(t, v, code)}</div>`;

// 11 templates panel, empty deck (16:9)
{
  const b = boardAt(800, 450, `<div style="position:absolute;inset:0;display:grid;place-items:center;color:var(--ink3);text-align:center"><div class="col" style="align-items:center;gap:8px">${I('layout', 32)}<b style="font-size:16px;color:var(--ink2)">Empty slide</b><span>Pick a layout on the left, or add text and elements.</span></div></div>`);
  const layouts = [['Title', 'b'], ['Title and bullets', 'a'], ['Two columns', 'c'], ['Definition', 'd'], ['Diagram', 'c'], ['Code walkthrough', 'b']];
  add('11_editor_templates', editor({ rail: 'Templates', bar: { title: 'Untitled note', aspect: '16:9 Widescreen' },
    panel: `${searchIn('Search templates')}<div class="seg" style="align-self:flex-start"><span class="on">Slide layouts</span><span>Deck themes</span></div>
      <h4>Slide layouts <span>Applies to this slide</span></h4>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">${layouts.map(([t, v]) => `<div><div class="tpl" style="aspect-ratio:16/9">${cover(t === 'Definition' ? 'Term' : t, v, '')}</div><div class="sm" style="font-weight:600;margin-top:4px">${t}</div></div>`).join('')}</div>
      <h4>Deck themes <span>Applies to all slides</span></h4>
      <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:8px">${[['Plain', 'a'], ['Chalk', 'b'], ['Paper', 'c']].map(([t, v]) => `<div><div class="tpl" style="aspect-ratio:16/9">${cover(t, v, '')}</div><div class="sm" style="font-weight:600;margin-top:4px">${t}</div></div>`).join('')}</div>`,
    board: b.html, bottom: { aspect: '16:9', thumbs: ['blank'], cur: 0, zoom: '78%' } }));
}

// 12 text selected, font dropdown open (Text panel)
{
  const W = 448, H = 560;
  const b = boardAt(W, H, `<div style="position:absolute;inset:0">${slide('norm')}</div>`, { top: 64 });
  const tx = b.x + 31, ty = b.y + 64, tw = W - 62, th = 74;
  const fonts = [['Source Sans 3', 'Sans · default'], ['Atkinson Hyperlegible', 'Sans · high legibility'], ['Lora', 'Serif'], ['Merriweather', 'Serif'], ['Montserrat', 'Display'], ['JetBrains Mono', 'Code only']];
  add('12_editor_text', editor({ rail: 'Text',
    panel: `${searchIn('Search fonts and styles')}<span class="b p w">${I('type', 18)}Add a text box</span>
      <h4>Default text styles</h4>
      <div class="col" style="gap:8px"><div class="in v" style="height:56px;font-size:24px;font-weight:750;letter-spacing:-.02em">Add a heading</div><div class="in v" style="height:48px;font-size:18px;font-weight:650">Add a subheading</div><div class="in v" style="height:44px">Add a little bit of body text</div></div>
      <h4>Text presets <span>Font pairs for notes</span></h4>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">${[['Definition', 'Term and meaning'], ['Key point', 'One bold line'], ['Code', 'Monospace block'], ['Quote', 'Lecturer quote']].map(([a, c], k) => `<div style="border-radius:10px;background:var(--s1);padding:14px;height:86px;display:flex;flex-direction:column;gap:4px;justify-content:center"><b style="font-size:${k === 1 ? 18 : 15}px;${k === 2 ? 'font-family:Consolas,monospace' : ''}${k === 3 ? ';font-family:Georgia,serif;font-style:italic' : ''}">${a}</b><span class="muted sm">${c}</span></div>`).join('')}</div>`,
    ctx: textToolbar,
    board: b.html + selBox(tx, ty, tw, th) +
      `<div class="guide" style="left:${b.x}px;width:${W}px;top:${ty - 1}px;height:1px;opacity:.0"></div><div class="guide" style="left:${b.x + W / 2}px;top:${b.y}px;width:1px;height:${H}px;opacity:.55"></div><span class="gl" style="left:${b.x + W / 2 + 6}px;top:${b.y + 8}px">Centre</span>
       <div class="pop" style="left:70px;top:66px;width:280px"><div class="in" style="height:36px;margin:4px 4px 6px">${I('search', 16)}Search fonts</div>
        ${fonts.map(([f, s], i) => `<div class="mi ${i === 0 ? 'on' : ''}" style="min-height:44px"><div><div style="font-weight:650;${f === 'Lora' || f === 'Merriweather' ? 'font-family:Georgia,serif' : ''}${f === 'JetBrains Mono' ? 'font-family:Consolas,monospace' : ''}">${f}</div><div class="muted sm">${s}</div></div>${i === 0 ? `<span class="k">${I('check', 16)}</span>` : ''}</div>`).join('')}
        <div class="muted sm" style="padding:6px 10px">A short list keeps notes readable.</div></div>`,
  }));
}

// 13 photos panel, image selected
{
  const W = 448, H = 560;
  const b = boardAt(W, H, `<div class="sl" style="position:absolute;inset:0"><div class="sp"><div class="k">CT060-3-2 · Week 3</div><h3>TCP handshake</h3>
      <div style="height:${Math.round(0.5 * 100)}cqw"></div><div class="p">SYN, SYN-ACK, ACK. Only after the third packet can data flow both ways.</div></div></div>`, { top: 64 });
  const ix = b.x + 32, iy = b.y + 120, iw = W - 64, ih = 200;
  const photo = (h, k) => `<div class="ph" style="height:${h}px"><svg width="100%" height="100%" viewBox="0 0 100 70" preserveAspectRatio="none"><rect width="100" height="70" fill="${['#cfcfd4', '#bdbdc3', '#d8d8dc', '#c4c4ca'][k % 4]}"/><path d="M0 70 L30 ${30 + (k * 7) % 20} L55 55 L75 ${25 + (k * 11) % 25} L100 50 V70Z" fill="#a9a9b0"/><circle cx="${20 + (k * 13) % 60}" cy="18" r="7" fill="#e8e8eb"/></svg></div>`;
  add('13_editor_photos', editor({ rail: 'Photos', bar: { title: 'TCP vs UDP' },
    panel: `${searchIn('<span style="color:var(--ink)">network cables</span>')}<div class="row" style="gap:6px;flex-wrap:wrap"><span class="chip on">Photos</span><span class="chip">Diagrams</span><span class="chip">Campus</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${[120, 90, 80, 120, 110, 100, 90, 70].map((h, k) => photo(h, k)).join('')}</div>
      <div class="muted sm" style="margin-top:auto">Free photos from Unsplash. The photographer is credited on the slide automatically.</div>`,
    ctx: `<span class="tb2 dd">${I('image', 16)}Replace</span><span class="sep"></span><span class="tb2 on">${I('crop', 18)}Crop</span><span class="tb2">${I('flip', 18)}Flip ${I('down', 12)}</span><span class="tb2">${I('drop', 18)}Transparency</span><span class="tb2">${I('sparkle', 16)}Effects</span><span class="sep"></span><span class="tb2">${I('layers', 16)}Position</span><span class="tb2">${I('lock', 18)}</span><span class="tb2">${I('copy', 18)}</span><span class="tb2">${I('trash', 18)}</span>`,
    board: b.html + `<div style="position:absolute;left:${ix}px;top:${iy}px;width:${iw}px;height:${ih}px;border-radius:6px;overflow:hidden">${photo(ih, 1).replace('class="ph"', 'class="ph" style="border-radius:0;height:' + ih + 'px"')}</div>
      <div style="position:absolute;left:${ix}px;top:${iy + ih - 22}px;font-size:10px;color:#fff;background:rgba(0,0,0,.5);padding:2px 6px;border-radius:0 4px 0 6px">Photo: Taylor Vick, Unsplash</div>` + selBox(ix, iy, iw, ih, { vh: true }) +
      `<div class="pop" style="left:${ix + iw / 2 - 150}px;top:${iy + ih + 96}px;width:300px;padding:14px;display:flex;flex-direction:column;gap:10px"><div class="row" style="justify-content:space-between"><b>Transparency</b><span class="in v" style="min-height:30px;height:30px;width:58px;justify-content:center">80</span></div><div class="zoom" style="width:100%"></div></div>`,
    bottom: { thumbs: ['cover:TCP vs UDP', 'blank', 'blank', 'blank'], cur: 1 },
  }));
}

// 14 music panel
{
  const W = 448, H = 560;
  const b = boardAt(W, H, `<div style="position:absolute;inset:0">${slide('norm')}</div>`, { top: 24 });
  const track = (t, a, d, on, playing) => `<div class="li ${on ? 'on' : ''}" style="padding:8px">
    <div style="width:48px;height:48px;border-radius:8px;background:var(--s3);display:grid;place-items:center;color:var(--ink2)">${I(playing ? 'pause' : 'play', 18)}</div>
    <div class="t"><div class="n">${t}</div><div class="s">${a} · ${d}</div>${playing ? '<div style="height:4px;border-radius:2px;background:var(--s3);margin-top:6px"><div style="width:38%;height:4px;border-radius:2px;background:var(--ink)"></div></div>' : ''}</div>
    ${on ? `<span class="chip on" style="height:28px">${I('check', 14)}Added</span>` : '<span class="chip o" style="height:28px">Use</span>'}</div>`;
  add('14_editor_music', editor({ rail: 'Music',
    panel: `${searchIn('<span style="color:var(--ink)">lofi study</span>')}<div class="muted sm" style="margin-top:-4px">Search Deezer. Tap a track to hear its 30-second preview. One track per note.</div>
      <div style="border-radius:12px;background:var(--s1);padding:12px;display:flex;flex-direction:column;gap:6px"><b class="sm" style="font-size:12px;color:var(--ink3)">On this note</b>
        <div class="row" style="gap:10px"><div style="width:40px;height:40px;border-radius:8px;background:var(--s3);display:grid;place-items:center">${I('music', 18)}</div><div style="flex:1"><b>Lo-fi Study Session</b><div class="muted sm">Chillhop Music · loops behind every slide</div></div><span class="ib sm">${I('trash', 18)}</span></div>
        <div class="row sm" style="gap:8px">${I('vol', 16)}<span>Volume</span><div class="zoom" style="flex:1"></div></div></div>
      <h4>Results <span>Deezer</span></h4>
      <div class="list" style="gap:2px">${track('Lo-fi Study Session', 'Chillhop Music', '0:30 preview', true, true)}${track('Rainy Library', 'Lofi Fruits', '0:30 preview')}${track('Sunday Morning', 'Chillhop Music', '0:30 preview')}${track('Coffee and Notes', 'Kupla', '0:30 preview')}${track('Late Night Revision', 'Idealism', '0:30 preview')}</div>`,
    board: b.html + `<div class="pop" style="left:${b.x + W - 230}px;top:${b.y + H - 64}px;padding:6px 10px;display:flex;align-items:center;gap:8px;border-radius:999px;font-size:13px;font-weight:600">${I('music', 16)}Lo-fi Study Session ${I('pause', 14)}</div>`,
  }));
}

// 15 elements panel + aspect chooser + shape toolbar
{
  const W = 448, H = 560;
  const b = boardAt(W, H, `<div style="position:absolute;inset:0">${slide('mvc')}</div>`, { top: 64 });
  const sx = b.x + 165, sy = b.y + 124;
  const shapes = ['square', 'circle', 'tri', 'line', 'arrowR', 'minus'];
  add('15_editor_elements', editor({ rail: 'Elements', bar: { title: 'MVC in five minutes', resizeOn: true },
    panel: `${searchIn('Search elements')}
      <h4>Shapes</h4><div class="grid" style="grid-template-columns:repeat(6,1fr);gap:8px">${shapes.map((s) => `<div style="aspect-ratio:1;border-radius:10px;background:var(--s1);display:grid;place-items:center;color:var(--ink2)">${I(s, 24)}</div>`).join('')}</div>
      <h4>Lines and dividers</h4><div class="grid" style="grid-template-columns:repeat(3,1fr);gap:8px">${['solid', 'dashed', 'arrow'].map((s) => `<div style="height:48px;border-radius:10px;background:var(--s1);display:grid;place-items:center"><div style="width:60%;height:0;border-top:2.5px ${s === 'dashed' ? 'dashed' : 'solid'} var(--ink2)"></div></div>`).join('')}</div>
      <h4>Blocks</h4><div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
        <div style="border-radius:10px;background:var(--s1);padding:12px;display:flex;flex-direction:column;gap:6px;height:96px"><div class="row" style="gap:6px;font-weight:650">${I('code', 18)}Code block</div><div style="font:12px/1.4 Consolas,monospace;color:var(--ink2)">SELECT * FROM<br>"NOTE_T";</div></div>
        <div style="border-radius:10px;background:var(--s1);padding:12px;display:flex;flex-direction:column;gap:6px;height:96px"><div class="row" style="gap:6px;font-weight:650">${I('table', 18)}Table</div><div class="muted sm">3 × 3 to start, add rows and columns later</div></div></div>`,
    ctx: `<span class="tb2" title="Fill"><span style="width:20px;height:20px;border-radius:6px;background:var(--ink2)"></span>Fill</span><span class="tb2">${I('border', 18)}Border</span><span class="tb2 dd">2 px ${I('down', 12)}</span><span class="tb2">Corner 8</span><span class="sep"></span><span class="tb2">${I('type', 16)}Add text</span><span class="tb2">${I('drop', 18)}</span><span class="tb2">${I('layers', 16)}Position</span><span class="sep"></span><span class="tb2">${I('lock', 18)}</span><span class="tb2">${I('copy', 18)}</span><span class="tb2">${I('trash', 18)}</span>`,
    board: b.html + selBox(sx, sy, 116, 54),
    ctxStyle: 'left:auto;right:16px;transform:none',
    over: `<div class="pop" style="left:497px;top:52px;width:270px;padding:14px;display:flex;flex-direction:column;gap:10px">
        <b>Slide size</b><span class="muted sm" style="margin-top:-6px">Applies to all 5 slides. Elements are scaled to fit.</span>
        ${[['4:5', 'Portrait', 'Default for the feed', 36, 45, false], ['9:16', 'Full screen', 'Fills a phone screen', 27, 48, false], ['16:9', 'Widescreen', 'Matches lecture slides', 56, 32, false]].map(([r, n, d, w, h], k) =>
          `<div class="li ${k === 0 ? 'on' : ''}" style="padding:10px"><div style="width:60px;display:grid;place-items:center"><div style="width:${w}px;height:${h}px;border-radius:4px;box-shadow:inset 0 0 0 2px var(--ink2);background:#fff"></div></div><div class="t"><div class="n">${r} ${n}</div><div class="s">${d}</div></div>${k === 0 ? I('check', 18) : ''}</div>`).join('')}
        <div class="row" style="justify-content:flex-end"><span class="b sm">Cancel</span><span class="b sm p">Resize</span></div></div>`,
    bottom: { thumbs: ['mvc', 'mvc', 'blank', 'blank', 'blank'], cur: 0 },
  }));
}

// 16 uploads panel with validation error + page notes
{
  const W = 360, H = 450;
  const b = boardAt(W, H, `<div style="position:absolute;inset:0">${slide('norm')}</div>`, { top: 20, wsH: EH - 80 });
  add('16_editor_uploads', editor({ rail: 'Uploads',
    panel: `<span class="b p w">${I('upload', 18)}Upload files</span>
      <div style="border-radius:12px;background:var(--s1);padding:22px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;box-shadow:inset 0 0 0 2px var(--s3)">${I('image', 28)}<b>Drop images here</b><span class="muted sm">JPEG, PNG or WebP, up to 5 MB each</span></div>
      <div style="border-radius:12px;background:#fff;box-shadow:inset 0 0 0 2px var(--ink2);padding:12px;display:flex;gap:10px" role="alert">${I('info', 20)}<div><b class="sm" style="font-size:13px">er_diagram_full.png was not added</b><div class="muted sm">The file is 7.2 MB. Export it smaller than 5 MB and try again.</div></div></div>
      <h4>Your uploads <span>12</span></h4>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">${Array.from({ length: 9 }, (_, k) => `<div class="ph" style="aspect-ratio:1;background:${['#d3d3d8', '#c2c2c8', '#dcdce0'][k % 3]};display:grid;place-items:end start;padding:4px"><span style="font-size:10px;font-weight:650;color:var(--ink2)">${['erd_v2.png', 'lab4.jpg', 'whiteboard.webp'][k % 3]}</span></div>`).join('')}</div>`,
    board: b.html, bottom: { notes: true },
  }));
}

// 17 mobile editor
add('17_editor_mobile', `<div class="m" style="background:var(--s2)">${sbar}
  <div style="height:52px;display:flex;align-items:center;gap:6px;padding:0 10px;background:#fff"><span class="ib sm">${I('left', 22)}</span><b style="font-size:15px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Normalisation, 1NF to 3NF</b><span class="ib sm">${I('undo', 20)}</span><span class="ib sm" style="opacity:.45">${I('redo', 20)}</span><span class="b sm p">Publish</span></div>
  <div style="position:absolute;top:116px;left:20px;width:350px;height:438px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.08)">${slide('norm')}</div>
  ${selBox(20 + 24, 116 + 50, 302, 58)}
  <div style="position:absolute;top:574px;left:0;right:0;display:flex;justify-content:center;gap:8px">${[0, 1, 2, 3].map((k) => `<div class="thm ${k === 1 ? 'on' : ''}" style="width:40px;height:50px">${k === 1 ? slide('norm') : k === 0 ? cover('Normalisation', 'b') : ''}</div>`).join('')}<div class="addp" style="width:40px;height:50px">${I('plus', 18)}</div></div>
  <div style="position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:16px 16px 0 0;box-shadow:0 -4px 16px rgba(0,0,0,.08);padding-bottom:30px">
    <div style="display:flex;gap:4px;padding:10px 10px 8px;overflow:hidden;box-shadow:inset 0 -1px 0 var(--line)"><span class="tb2 dd" style="white-space:nowrap">Source Sans 3 ${I('down', 12)}</span><span class="tb2 dd">32</span><span class="tb2"><b style="font-size:15px">A</b></span><span class="tb2 on">${I('bold', 18)}</span><span class="tb2">${I('italic', 18)}</span><span class="tb2">${I('alignL', 18)}</span><span class="tb2">${I('more', 18)}</span></div>
    <div style="display:flex;justify-content:space-around;padding:10px 4px 0">${ERAIL.map(([n, ic], k) => `<div class="er ${k === 2 ? 'on' : ''}" style="width:50px;height:56px;font-size:10px">${I(ic, 22)}${n === 'Background' ? 'Bkgd' : n === 'Templates' ? 'Layouts' : n}</div>`).join('')}</div></div>
  <div class="home"></div></div>`, true);

// 18 publish dialog
{
  const W = 448, H = 560;
  const b = boardAt(W, H, `<div style="position:absolute;inset:0">${slide('norm')}</div>`, { top: 64 });
  const vis = [['globe', 'Public', 'Anyone on PARP. Appears in For You and search.'], ['friends', 'Contacts only', 'Only friends: people you follow who follow you back.'], ['lock', 'Private draft', 'Only you. Kept in Drafts, never in the feed.']];
  const body = `<div style="display:flex;gap:20px">
    <div style="width:180px;flex:none;display:flex;flex-direction:column;gap:8px"><div style="width:180px;height:225px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px var(--line)">${slide('norm')}</div><span class="muted sm">6 slides · 4:5 Portrait</span></div>
    <div style="flex:1;display:flex;flex-direction:column;gap:16px">
      <div class="fld"><label>Who can see this note</label><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">${vis.map(([ic, n, d], k) => `<div style="border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:6px;background:${k === 0 ? '#fff' : 'var(--s1)'};box-shadow:inset 0 0 0 ${k === 0 ? '2px var(--ink)' : '1px var(--line)'}"><div class="row" style="justify-content:space-between">${I(ic, 22)}<span class="radio ${k === 0 ? 'on' : ''}"></span></div><b>${n}</b><span class="muted sm" style="line-height:1.4">${d}</span></div>`).join('')}</div></div>
      <div class="fld"><label>Module</label><div class="in v">${I('book', 18)}CT030-3-2 Database Systems<span class="end">${I('down', 16)}</span></div></div>
      <div class="fld"><label>Hashtags <span class="muted" style="font-weight:500">3 of 5</span></label><div class="in fo v" style="flex-wrap:wrap;gap:6px;padding:8px 10px"><span class="tag">#normalisation ${I('x', 12)}</span><span class="tag">#sql ${I('x', 12)}</span><span class="tag">#ct030 ${I('x', 12)}</span><span>#erd</span><span style="width:1.5px;height:18px;background:var(--ink)"></span></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="fld"><label>Slide size</label><div class="seg"><span class="on">4:5</span><span>9:16</span><span>16:9</span></div></div>
        <div class="fld"><label>Background music</label><div class="in v" style="height:40px">${I('music', 16)}Lo-fi Study Session<span class="end muted">${I('x', 14)}</span></div></div></div></div></div>`;
  add('18_publish_dialog', editor({ rail: 'Templates', panel: false, board: boardAt(W, H, `<div style="position:absolute;inset:0">${slide('norm')}</div>`, { wsW: 1364, top: 64 }).html, bottom: { left: 76 },
    over: dlg(820, 'Publish note', body, `<span class="b">Cancel</span><span class="b p">${I('upload', 16)}Publish</span>`) }));
}

// 19 drafts
add('19_drafts', app('Profile', `<div class="content" style="padding:0 32px">
  <div class="muted" style="margin:-8px 0 20px;font-size:15px">Only you can see drafts. They never appear in the feed or in search.</div>
  <div class="grid" style="grid-template-columns:repeat(5,1fr);gap:20px">
    <div><div class="tile" style="background:var(--s1);display:grid;place-items:center;color:var(--ink2)"><div class="col" style="align-items:center;gap:8px">${I('plus', 28)}<b>New note</b></div></div></div>
    ${[['Indexing: B-tree vs hash', 'a', 'CT030-3-2', 'Edited 2h ago · 4 slides'], ['React hooks cheat sheet', 'b', 'CT076-3-2', 'Edited yesterday · 7 slides'], ['Untitled note', 'blank', '', 'Edited 3 Oct · 1 slide'], ['Page replacement: LRU', 'c', 'CT050-3-2', 'Edited 28 Sep · 5 slides']].map(([t, v, c, s]) =>
    `<div><div class="tile">${v === 'blank' ? '<div class="sl"></div>' : cover(t, v, c)}<span class="ib s sm" style="position:absolute;top:8px;right:8px;background:rgba(255,255,255,.95)">${I('more', 16)}</span></div><div class="tcap">${t}</div><div class="tsub">${s}</div></div>`).join('')}
  </div>
  <div class="pop" style="left:${32 + 2 * (1168 - 80) / 5 + 40 + 120}px;top:96px;width:200px">${[['pencil', 'Continue editing'], ['copy', 'Duplicate'], ['trash', 'Delete draft']].map(([ic, t], k) => `<div class="mi ${k === 0 ? 'on' : ''}">${I(ic, 18)}${t}</div>`).join('')}</div></div>`, { left: backT('Drafts') + '<span class="muted" style="font-size:15px;font-weight:600">4</span>' }));

// 20 my profile
const profileHead = (o) => `<div style="display:flex;gap:28px;align-items:flex-start;padding:0 48px">
  ${av(o.i, 128, o.dark)}<div style="display:flex;flex-direction:column;gap:10px;padding-top:6px;flex:1">
    <div class="row" style="gap:10px;align-items:baseline"><span style="font-size:28px;font-weight:800;letter-spacing:-.03em">${o.n}</span>${o.lect ? VB(false, 22) : ''}<span class="muted" style="font-size:16px;font-weight:600">${o.h}</span></div>
    <div style="font-size:15px;color:var(--ink2)">${o.prog}</div>
    <div class="row" style="gap:10px">${o.btns}</div>
    <div class="row" style="gap:22px;font-size:15px"><span><b style="font-size:17px">${o.c[0]}</b> <span class="muted">Following</span></span><span><b style="font-size:17px">${o.c[1]}</b> <span class="muted">Followers</span></span><span><b style="font-size:17px">${o.c[2]}</b> <span class="muted">Likes</span></span></div>
    <div style="font-size:15px;max-width:560px;line-height:1.45">${o.bio}</div></div></div>`;
add('20_my_profile', app('Profile', `<div class="content" style="top:56px">${profileHead({ i: 'LQ', n: 'Lim Qi Cai', h: '@limqicai', prog: 'BSc (Hons) Software Engineering · Year 3', c: ['128', '342', '2.1K'],
  btns: `<span class="b p">Edit profile</span><span class="b">${I('notes', 16)}Drafts 4</span><span class="ib s">${I('share', 18)}</span><span class="ib s">${I('sliders', 18)}</span>`, bio: 'Final-year SE student. Database and algorithms notes, checked against the lecture slides before I post.' })}
  <div class="tabs" style="margin:24px 48px 16px"><span class="tab on">${I('gridI', 18)}Notes</span><span class="tab">${I('lock', 16)}Saved</span><span class="tab">${I('heart', 18)}Liked</span></div>
  <div class="grid" style="grid-template-columns:repeat(6,1fr);gap:12px;padding:0 48px">${COVERS.map((c, k) => tile(c, { pinned: k === 0, priv: k === 4 })).join('')}</div></div>`));

// 21 user profile (lecturer, Friends state)
add('21_user_profile', app('Explore', `<div class="content" style="top:56px">${profileHead({ i: 'LC', dark: true, lect: true, n: 'Dr Lee Chin Wei', h: '@drlee', prog: 'Lecturer · School of Computing · CT030-3-2, CT046-3-M', c: ['41', '1.8K', '12.4K'],
  btns: `<span class="b">${I('friends', 18)}Friends ${I('down', 14)}</span><span class="b p">${I('msg', 16)}Message</span><span class="ib s">${I('share', 18)}</span><span class="ib s">${I('more', 18)}</span>`, bio: 'I Super Like notes I have checked against the module syllabus. Office hours on Tuesdays, Block D, level 4.' })}
    <div class="tabs" style="margin:24px 48px 16px"><span class="tab on">${I('gridI', 18)}Notes</span><span class="tab">${I('heart', 18)}Liked</span></div>
  <div class="grid" style="grid-template-columns:repeat(6,1fr);gap:12px;padding:0 48px">${[COVERS[2], COVERS[0], COVERS[9], COVERS[1], COVERS[5], COVERS[10]].map((c, k) => tile(c, { priv: k === 3 })).join('')}</div></div>`, {}));

// 22 edit profile
add('22_edit_profile', app('Profile', `<div class="content" style="top:56px">${profileHead({ i: 'LQ', n: 'Lim Qi Cai', h: '@limqicai', prog: 'BSc (Hons) Software Engineering · Year 3', c: ['128', '342', '2.1K'], btns: '<span class="b p">Edit profile</span>', bio: '' })}</div>`,
  { over: dlg(600, 'Edit profile', `
    ${[['Profile photo', `<div style="position:relative">${av('LQ', 96)}<span class="ib s sm" style="position:absolute;right:-4px;bottom:-4px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2)">${I('pencil', 16)}</span></div><span class="help" style="align-self:flex-end">JPEG or PNG, up to 2 MB</span>`],
       ['Name', '<div class="in v" style="flex:1">Lim Qi Cai</div>'],
       ['Username', '<div class="fld" style="flex:1;gap:4px"><div class="in v">limqicai</div><span class="help">parp.app/@limqicai · change once every 30 days</span></div>'],
       ['Programme', `<div class="in v" style="flex:1">BSc (Hons) Software Engineering<span class="end">${I('down', 16)}</span></div>`],
       ['Bio', '<div class="fld" style="flex:1;gap:4px"><div class="in v ta">Final-year SE student. Database and algorithms notes, checked against the lecture slides before I post.</div><span class="help" style="text-align:right">104 / 300</span></div>']]
      .map(([l, c]) => `<div style="display:flex;gap:20px;align-items:flex-start;padding:4px 0"><b style="width:120px;padding-top:12px;font-size:14px">${l}</b><div class="row" style="flex:1;align-items:flex-start;gap:12px">${c}</div></div>`).join('')}`,
    '<span class="b">Cancel</span><span class="b p">Save</span>') }));

// 23 profile mobile
add('23_profile_mobile', mob(`${mTop(`<span class="ib sm">${I('userPlus', 22)}</span>`, 'Lim Qi Cai', `<span class="ib sm">${I('menu', 22)}</span>`)}
  <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:6px 16px 0">${av('LQ', 96)}<b style="font-size:16px">@limqicai</b>
    <div class="row" style="gap:28px;text-align:center">${[['128', 'Following'], ['342', 'Followers'], ['2.1K', 'Likes']].map(([n, l]) => `<div><b style="font-size:17px">${n}</b><div class="muted sm">${l}</div></div>`).join('')}</div>
    <div class="row" style="gap:8px"><span class="b sm" style="width:120px">Edit profile</span><span class="b sm">Drafts 4</span><span class="ib s sm">${I('share', 16)}</span></div>
    <div style="font-size:13px;text-align:center;color:var(--ink2);max-width:320px">Final-year SE student. Database and algorithms notes, checked before I post.</div></div>
  <div class="tabs" style="justify-content:space-around;margin-top:10px"><span class="tab on" style="width:80px;justify-content:center">${I('gridI', 20)}</span><span class="tab" style="width:80px;justify-content:center">${I('lock', 20)}</span><span class="tab" style="width:80px;justify-content:center">${I('heart', 20)}</span></div>
  <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:2px;margin-top:2px">${COVERS.slice(0, 6).map((c, k) => tile(c, { pinned: k === 0 })).join('').replaceAll('border-radius:10px', 'border-radius:0')}</div>`, { tab: 'Profile' }), true);

// 24 search (Top tab)
const filterBar = (open) => `<div class="row" style="gap:8px;flex-wrap:wrap"><span class="chip ${open ? 'on' : 'o'}">${I('filter', 15)}Filters 2</span><span class="chip on">${I('check', 14)}Lecturer content</span><span class="chip o">Lecturer: any ${I('down', 13)}</span><span class="chip on">Semester 1, 2026/27 ${I('down', 13)}</span><span class="chip o">${I('cal', 14)}Any date</span><span class="chip o">Module: any ${I('down', 13)}</span><span class="muted sm" style="margin-left:auto">48 results · 0.21 s</span></div>`;
const searchTop = (q) => `<div class="in v" style="width:520px;height:44px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 2px var(--ink)">${I('search', 18)}${q}<span class="end muted">${I('x', 16)}</span></div>`;
const person = (i, n, s, st, dark, lect) => `<div class="li" style="background:var(--s1);padding:14px;flex:1">${av(i, 52, dark)}<div class="t"><div class="n">${n}${lect ? VB(false, 15) : ''}</div><div class="s">${s}</div></div><span class="b sm ${st === 'Follow' ? 'p' : ''}">${st}</span></div>`;
add('24_search', app('Explore', `<div class="content" style="padding:0 32px;display:flex;flex-direction:column;gap:16px">
  <div class="tabs">${['Top', 'Notes', 'People', 'Hashtags', 'Modules'].map((t, k) => `<span class="tab ${k === 0 ? 'on' : ''}">${t}</span>`).join('')}</div>
  ${filterBar()}
  <div class="row" style="justify-content:space-between"><b style="font-size:16px">People</b><span class="muted sm" style="font-weight:650">See all</span></div>
  <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:12px">${person('LC', 'Dr Lee Chin Wei', 'Lecturer · 1.8K followers', 'Friends', true, true)}${person('TM', 'Tan Mei Ling', 'Computer Science · 210 followers', 'Following')}${person('AH', 'Aiman Hakim', 'Information Technology · 96', 'Follow back')}</div>
  <div class="row" style="gap:8px"><b style="font-size:16px;margin-right:8px">Hashtags</b><span class="chip">#normalisation · 214 notes</span><span class="chip">#normalform · 18</span><span class="chip">#bcnf · 9</span><span class="chip">${I('book', 14)}CT030-3-2 Database Systems</span></div>
  <div class="row" style="justify-content:space-between"><b style="font-size:16px">Notes</b><span class="muted sm" style="font-weight:650">See all</span></div>
  <div class="grid" style="grid-template-columns:repeat(6,1fr);gap:14px">${[COVERS[0], COVERS[9], COVERS[1], COVERS[0], COVERS[9], COVERS[1]].map((c, k) => tile([k === 3 ? 'Normal forms with ENROL_T' : k === 4 ? 'Functional dependency basics' : k === 5 ? 'Denormalising for reports' : c[0], c[1], c[2], c[3], k !== 2 && k !== 5], { cap: true, sub: ['Aina Rahman', 'Dr Lee Chin Wei', 'Chloe Wong', 'Lim Qi Cai', 'Dr Siti Aminah', 'Hafiz Ismail'][k] })).join('')}</div></div>`,
  { left: searchTop('#normalisation') }));

// 25 search filters open
add('25_search_filters', app('Explore', `<div class="content" style="padding:0 32px;display:flex;flex-direction:column;gap:16px">
  <div class="tabs">${['Top', 'Notes', 'People', 'Hashtags', 'Modules'].map((t, k) => `<span class="tab ${k === 1 ? 'on' : ''}">${t}${k === 1 ? ' 14' : ''}</span>`).join('')}</div>
  ${filterBar(true).replace('Lecturer: any', 'Lecturer: Dr Lee Chin Wei').replace('48 results', '14 results')}
  <div class="col" style="gap:10px;width:760px">${[['Normalisation, 1NF to 3NF in one page', 'Aina Rahman', 'CT030-3-2', '12 Sep 2026', true], ["Crow's foot notation", 'Dr Lee Chin Wei', 'CT030-3-2', '9 Sep 2026', true], ['Functional dependency basics', 'Dr Lee Chin Wei', 'CT030-3-2', '2 Sep 2026', true], ['Normal forms with ENROL_T', 'Lim Qi Cai', 'CT030-3-2', '29 Aug 2026', true]].map(([t, a, m, d, v], k) =>
    `<div class="li" style="background:var(--s1);padding:10px;gap:16px"><div style="width:96px;height:120px;border-radius:8px;overflow:hidden;flex:none">${cover(t, ['a', 'c', 'b', 'a'][k], m)}</div><div class="t" style="display:flex;flex-direction:column;gap:6px"><div class="n" style="font-size:16px">${t}</div><div class="s">${a} · ${m} Database Systems · ${d}</div><div class="row" style="gap:6px">${v ? `<span class="tag" style="background:var(--ink);color:#fff">${I('check', 12)}Verified by Dr Lee</span>` : ''}<span class="tag">#normalisation</span></div></div><div class="muted sm row" style="gap:4px">${I('heart', 16)}${['1.2K', '511', '402', '96'][k]}</div></div>`).join('')}</div></div>
  <div class="pop" style="left:32px;top:166px;width:420px;padding:20px;display:flex;flex-direction:column;gap:16px">
    <div class="row" style="justify-content:space-between"><b style="font-size:16px">Filters</b><span class="b sm g">Reset</span></div>
    <div class="row" style="justify-content:space-between"><div><b>Lecturer content only</b><div class="muted sm">Notes posted or Super Liked by a lecturer</div></div><span class="tog on"></span></div>
    <div class="fld"><label>Specific lecturer</label><div class="in v">${av('LC', 24, true)}Dr Lee Chin Wei<span class="end">${I('down', 16)}</span></div></div>
    <div class="fld" style="position:relative"><label>Academic term</label><div class="in fo v">${I('cal', 18)}Semester 1, 2026/27<span class="end">${I('up', 16)}</span></div>
      <div class="pop" style="top:72px;left:0;right:0">${[['Semester 1, 2026/27', 'Sep to Dec 2026'], ['Semester 2, 2025/26', 'Feb to Jun 2026'], ['Semester 1, 2025/26', 'Sep to Dec 2025']].map(([t, d], k) => `<div class="mi ${k === 0 ? 'on' : ''}" style="min-height:46px"><div><div style="font-weight:650">${t}</div><div class="muted sm">${d}</div></div>${k === 0 ? `<span class="k">${I('check', 16)}</span>` : ''}</div>`).join('')}</div></div>
    <div class="fld"><label>Or a date range</label><div class="row" style="gap:8px"><div class="in" style="flex:1">${I('cal', 16)}From</div><div class="in" style="flex:1">${I('cal', 16)}To</div></div></div>
    <div class="fld"><label>Module</label><div class="in v">${I('book', 18)}CT030-3-2 Database Systems<span class="end">${I('down', 16)}</span></div></div>
    <span class="b p w">Show 14 notes</span></div>`, { left: searchTop('#normalisation') }));

// 26 search mobile
add('26_search_mobile', mob(`<div style="display:flex;gap:10px;align-items:center;padding:6px 16px 10px">${I('left', 24)}<div class="in v" style="flex:1;height:40px;border-radius:999px">${I('search', 18)}#dsa</div><b class="sm" style="font-size:14px">Search</b></div>
  <div class="tabs" style="padding:0 16px;gap:22px">${['Top', 'Notes', 'People', 'Hashtags', 'Modules'].map((t, k) => `<span class="tab ${k === 1 ? 'on' : ''}" style="font-size:14px">${t}</span>`).join('')}</div>
  <div class="row" style="gap:6px;padding:12px 16px;overflow:hidden"><span class="chip on">${I('filter', 14)}2</span><span class="chip on">Lecturer content</span><span class="chip o">Semester 1 ${I('down', 12)}</span><span class="chip o">Module</span></div>
  <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;padding:0 16px">${[COVERS[7], COVERS[2], COVERS[10], COVERS[5]].map((c, k) => tile(c, { cap: true, sub: ['Arjun Kumar', 'Dr Lee Chin Wei', 'Hafiz Ismail', 'Tan Mei Ling'][k] })).join('')}</div>`, { tab: 'Discover' }), true);

// 27 saved
add('27_saved', app('Saved', `<div class="content" style="padding:0 32px;display:flex;flex-direction:column;gap:18px">
  <div class="row" style="gap:8px"><span class="chip on">All 32</span><span class="chip">CT030-3-2 Database Systems 11</span><span class="chip">CT044-3-2 Algorithms and Data Structures 9</span><span class="chip">AICT004 Software Engineering 7</span><span class="chip">Other 5</span><span class="chip o" style="margin-left:auto">Recently saved ${I('down', 13)}</span></div>
  <div class="grid" style="grid-template-columns:repeat(6,1fr);gap:16px">${COVERS.map((c, k) => tile(c, { cap: true, sub: `${['Aina Rahman', 'Chloe Wong', 'Dr Lee Chin Wei', 'Lim Qi Cai', 'Arjun Kumar', 'Tan Mei Ling'][k % 6]} · saved ${k + 1}d ago` })).join('')}</div></div>`,
  { left: title('Saved', '32 notes · only you can see this') }));

// 28 report dialog (over feed)
add('28_report_dialog', app('For You', feedBody(feedCard({ verified: 'Dr Lee', idx: 1 }), rail({ liked: true })), { center: ftabs(), me: 'LC',
  over: dlg(480, 'Report note', `<div class="muted" style="margin-top:-10px">“Normalisation, 1NF to 3NF in one page” by Aina Rahman. The author is not told who reported it.</div>
    <div class="col" style="gap:4px">${['Inaccurate content', 'Inappropriate content', 'Spam or advertising', 'Plagiarism', 'Copyright violation', 'Something else'].map((r, k) => `<div class="li ${k === 3 ? 'on' : ''}" style="padding:10px 12px"><span class="radio ${k === 3 ? 'on' : ''}"></span><div class="t"><div class="n" style="font-weight:${k === 3 ? 700 : 550}">${r}</div>${k === 3 || k === 4 ? '<div class="s">Lecturers only</div>' : ''}</div></div>`).join('')}</div>
    <div class="fld"><label>Details <span class="muted" style="font-weight:500">optional</span></label><div class="in v ta">Slides 2 to 4 copy the CT030 Week 6 lecture deck word for word without credit.</div><span class="help" style="text-align:right">76 / 500</span></div>`,
    '<span class="b">Cancel</span><span class="b p">Submit report</span>') }));

// 29 super like dialog
add('29_superlike_dialog', app('For You', feedBody(feedCard({ aspect: '16:9', kind: 'sort', author: 'Hafiz Ismail', title: 'Sorting algorithms compared', desc: 'Best, average and worst case in one table. <b>#dsa</b> <b>#sorting</b>', mod: MODS.ads, idx: 0, count: 4, music: false }), rail({ superlike: true, av: 'HI', likes: '386', comments: '12', saves: '97' })), { collapsed: true, center: ftabs(), me: 'LC',
  over: dlg(500, 'Super Like this note?', `<div style="color:var(--ink2);margin-top:-8px;line-height:1.5">A Super Like tells students you have checked this note. It adds “Verified by Dr Lee” to the card and raises the note in everyone's For You feed.</div>
    <div class="li" style="background:var(--s1);padding:10px"><div style="width:96px;height:54px;border-radius:6px;overflow:hidden;flex:none">${slide('sort', { aspect: '16:9' })}</div><div class="t"><div class="n">Sorting algorithms compared</div><div class="s">Hafiz Ismail · CT044-3-2 · 4 slides</div></div></div>
    <div class="fld"><label>Remark for the author <span class="muted" style="font-weight:500">optional, shown with the badge</span></label><div class="in v ta" style="min-height:72px">Matches the Week 3 lecture. Quick sort's worst case is correct.</div></div>
    <div class="help">You can remove your Super Like later from the same button.</div>`,
    `<span class="b">Cancel</span><span class="b p">${I('starF', 16)}Super Like</span>`, { icon: `<span style="width:52px;height:52px;border-radius:50%;background:var(--s2);display:grid;place-items:center">${I('star', 28)}</span>` }) }));

// 30 notifications drawer (desktop, nav collapsed)
const nrow = (a, dark, txt, time, end, o = {}) => `<div class="li" style="padding:10px 8px;align-items:flex-start">${o.icon ? `<div style="width:44px;height:44px;border-radius:50%;background:var(--s2);display:grid;place-items:center;flex:none">${I(o.icon, 22)}</div>` : av(a, 44, dark)}<div class="t" style="font-size:14px;line-height:1.4">${txt}<div class="muted sm" style="margin-top:2px">${time}</div></div>${end || ''}</div>`;
const nthumb = (k) => `<div style="width:44px;height:56px;border-radius:6px;overflow:hidden;flex:none">${cover(COVERS[k][0], COVERS[k][1], '')}</div>`;
add('30_notifications', `<div class="app">${nav('Notifications', { collapsed: true })}
  <div style="width:440px;flex:none;background:#fff;box-shadow:8px 0 24px rgba(0,0,0,.08);z-index:4;display:flex;flex-direction:column;padding:20px 16px 0;gap:12px">
    <div class="row" style="justify-content:space-between;padding:0 8px"><b style="font-size:22px;letter-spacing:-.02em">Notifications</b><span class="ib sm">${I('x', 20)}</span></div>
    <div class="row" style="gap:6px;flex-wrap:wrap;padding:0 8px">${['All', 'Mentions', 'Follows', 'Super Likes', 'Requests', 'System'].map((t, k) => `<span class="chip ${k === 0 ? 'on' : ''}">${t}</span>`).join('')}</div>
    <div class="li" style="background:var(--s1);padding:12px"><div style="width:44px;height:44px;border-radius:50%;background:#fff;display:grid;place-items:center">${I('inbox', 22)}</div><div class="t"><div class="n">Message requests</div><div class="s">Hafiz Ismail and 1 other want to message you</div></div><span class="cnt" style="margin-left:0">2</span>${I('right', 18)}</div>
    <div class="muted sm" style="font-weight:700;padding:4px 8px 0">Today</div>
    ${nrow('LC', true, '<b>Dr Lee Chin Wei</b> Super Liked your note. “Matches the Week 3 lecture.”', '12 min ago', nthumb(2))}
    ${nrow('AR', false, '<b>Aina Rahman</b> mentioned you in a comment: <span class="at">@priyanair</span> is this the same as the tutorial answer?', '1 h ago', nthumb(0))}
    ${nrow('HI', false, '<b>Hafiz Ismail</b> started following you.', '3 h ago', '<span class="b sm p">Follow back</span>')}
    <div class="muted sm" style="font-weight:700;padding:4px 8px 0">This week</div>
    ${nrow('', false, '<b>Lecturer account approved.</b> You can now Super Like notes and your profile shows the lecturer badge.', 'Mon', '', { icon: 'shield' })}
    ${nrow('', false, '<b>Your note was hidden by an administrator.</b> “Lab 4 answers” broke the rule on sharing assessed work.', 'Sun', '<span class="b sm">Details</span>', { icon: 'flag' })}
    ${nrow('TM', false, '<b>Tan Mei Ling</b> and 3 others liked “TCP vs UDP”.', 'Sat', nthumb(4))}</div>
  <div class="main"><div class="top"><div class="l"></div><div>${ftabs()}</div><div class="r">${util('PN')}</div></div>${feedBody(feedCard({ verified: 'Dr Lee', idx: 1 }), rail({ liked: true }), { noArrows: true })}</div></div>`);

// 31 inbox mobile (notifications + chats)
add('31_inbox_mobile', mob(`${mTop('', 'Inbox', `<span class="ib sm">${I('plus', 22)}</span>`)}
  <div style="padding:0 8px">${[['userPlus', 'New followers', 'Hafiz Ismail started following you', '1'], ['bell', 'Activity', 'Dr Lee Super Liked your note', '3'], ['inbox', 'Message requests', 'Chloe Wong wants to message you', '2'], ['shield', 'System notifications', 'Lecturer applications are reviewed in 2 days', '']].map(([ic, t, s, c]) =>
    `<div class="li"><div style="width:52px;height:52px;border-radius:50%;background:var(--s2);display:grid;place-items:center;flex:none">${I(ic, 24)}</div><div class="t"><div class="n">${t}</div><div class="s">${s}</div></div>${c ? `<span class="cnt" style="margin-left:0">${c}</span>` : ''}${I('right', 18)}</div>`).join('')}
    <div class="muted sm" style="font-weight:700;padding:10px 12px 2px">Messages</div>
    ${[['AR', 'Aina Rahman', 'Shared a note: Normalisation, 1NF…', '2m', false], ['FY', 'FYP Team, CT046', 'Arjun: I will do the sequence diagrams', '1h', false], ['LC', 'Dr Lee Chin Wei', 'You: Thank you, Dr Lee', 'Mon', true], ['TM', 'Tan Mei Ling', 'See you at the library', 'Sun', false]].map(([i, n, s, t, d]) =>
    `<div class="li">${av(i, 52, d)}<div class="t"><div class="n">${n}</div><div class="s">${s}</div></div><span class="muted sm">${t}</span></div>`).join('')}</div>`, { tab: 'Inbox' }), true);

// 32 messages
const convList = (on, o = {}) => `<div style="width:360px;flex:none;display:flex;flex-direction:column;gap:6px;padding:0 12px 0 20px">
  <div class="li ${o.reqOn ? 'on' : ''}" style="padding:12px;${o.reqOn ? '' : 'background:var(--s1)'}"><div style="width:48px;height:48px;border-radius:50%;background:${o.reqOn ? '#fff' : 'var(--s2)'};display:grid;place-items:center">${I('inbox', 22)}</div><div class="t"><div class="n">Message requests</div><div class="s">From people who are not your friends</div></div><span class="cnt" style="margin-left:0">2</span></div>
  ${[['AR', 'Aina Rahman', 'Shared a note: Normalisation, 1NF…', '2m'], ['FY', 'FYP Team, CT046', 'Arjun: I will do the sequence diagrams', '1h'], ['LC', 'Dr Lee Chin Wei', 'You: Thank you, Dr Lee', 'Mon'], ['TM', 'Tan Mei Ling', 'See you at the library at 3', 'Sun'], ['AK', 'Arjun Kumar', 'Sent a note: Stack vs queue', 'Sat']].map(([i, n, s, t]) =>
    `<div class="li ${n === on ? 'on' : ''}">${av(i, 48, i === 'LC')}<div class="t"><div class="n">${n}</div><div class="s">${s}</div></div><span class="muted sm">${t}</span></div>`).join('')}</div>`;
const shareCard = (me, k = 0) => `<div class="ncard ${me ? 'me' : ''}"><div class="th">${k === 0 ? `<div style="width:120px;height:150px">${slide('norm')}</div>` : `<div style="width:120px;height:150px">${slide('stack')}</div>`}</div><div class="mt"><b>${k === 0 ? 'Normalisation, 1NF to 3NF in one page' : 'Stack vs queue, with real examples'}</b><span class="muted sm">${k === 0 ? 'Aina Rahman · CT030-3-2' : 'Arjun Kumar · CT044-3-2'}</span></div></div>`;
const chatPane = (head, msgs, input = true) => `<div style="flex:1;display:flex;flex-direction:column;background:var(--s0);border-radius:16px 0 0 0;overflow:hidden">
  <div class="row" style="padding:14px 20px;background:#fff">${head}</div>
  <div style="flex:1;padding:20px 24px;display:flex;flex-direction:column;gap:10px;overflow:hidden">${msgs}</div>
  ${input ? `<div class="inbar" style="padding:12px 20px 18px"><span class="ib s">${I('clip', 20)}</span><div class="in" style="flex:1;border-radius:999px;background:#fff">Send a message…<span class="end">${I('smile', 18)}</span></div><span class="ib s" style="background:var(--acc);color:#fff">${I('send', 18)}</span></div>` : ''}</div>`;
add('32_messages', app('Messages', `<div class="content" style="display:flex">${convList('Aina Rahman')}${chatPane(`${av('AR', 40)}<div><div style="font-weight:700">Aina Rahman</div><div class="muted sm row" style="gap:4px">${I('friends', 14)}Friends · active now</div></div><span class="ib" style="margin-left:auto">${I('info', 20)}</span>`,
  `<div class="muted sm" style="text-align:center">Today 14:02</div>${shareCard(false)}<div class="bub">Is slide 2 the same as the tutorial 6 answer?</div>
   <div class="bub me">Almost. The tutorial splits ENROL_T first, then removes the partial dependency.</div><div class="bub me">I can add that as a slide tonight.</div><div class="bub">That would help a lot, thanks!</div>
   <div class="muted sm" style="text-align:right">Seen</div>`)}</div>`, { left: title('Messages'), right: `<span class="ib s">${I('users', 20)}</span>${util()}` }));

// 33 message request (recipient view)
add('33_message_request', app('Messages', `<div class="content" style="display:flex">${convList('', { reqOn: true })}
  <div style="flex:1;display:flex;background:var(--s0);border-radius:16px 0 0 0;overflow:hidden">
    <div style="width:300px;background:#fff;padding:16px 12px;display:flex;flex-direction:column;gap:6px"><b style="padding:4px 8px 8px">Requests 2</b>
      ${[['HI', 'Hafiz Ismail', 'Asked about: Normalisation, 1NF…', true], ['CW', 'Chloe Wong', 'Hi, could you share the ERD…', false]].map(([i, n, s, on]) => `<div class="li ${on ? 'on' : ''}">${av(i, 44)}<div class="t"><div class="n">${n}</div><div class="s">${s}</div></div></div>`).join('')}</div>
    <div style="flex:1;display:flex;flex-direction:column">
      <div class="row" style="padding:14px 20px;background:#fff">${av('HI', 40)}<div><div style="font-weight:700">Hafiz Ismail</div><div class="muted sm">Follows you · you do not follow back</div></div></div>
      <div style="flex:1;padding:24px;display:flex;flex-direction:column;gap:10px">${shareCard(false)}<div class="bub">Hi, on slide 3, why does customer_name move out but order_date stays in ORDER_T?</div></div>
      <div style="background:#fff;padding:18px 24px 22px;display:flex;flex-direction:column;gap:12px;align-items:center;text-align:center">
        <div style="max-width:520px;color:var(--ink2)">Hafiz is not your friend, so this is a request. Accept to reply; it opens this conversation only and does not make you friends. Hafiz cannot see that you have read it.</div>
        <div class="row" style="gap:10px"><span class="b" style="width:140px">${I('flag', 16)}Report</span><span class="b" style="width:140px">${I('trash', 16)}Delete</span><span class="b p" style="width:140px">${I('check', 16)}Accept</span></div></div></div></div></div>`, { left: title('Messages') }));

// 34 new group
add('34_new_group', app('Messages', `<div class="content" style="display:flex">${convList('Aina Rahman')}${chatPane(`${av('AR', 40)}<div><div style="font-weight:700">Aina Rahman</div><div class="muted sm">Friends</div></div>`, `${shareCard(false)}<div class="bub">Is slide 2 the same as the tutorial 6 answer?</div>`)}</div>`, { left: title('Messages'),
  over: dlg(480, 'New group', `<div class="fld"><label>Group name</label><div class="in v">FYP Team, CT046</div></div>
    <div class="fld"><label>Add friends <span class="muted" style="font-weight:500">at least 2</span></label><div class="in" style="flex-wrap:wrap;gap:6px;padding:8px 10px"><span class="tag">Aina Rahman ${I('x', 12)}</span><span class="tag">Arjun Kumar ${I('x', 12)}</span>${I('search', 16)}Search friends</div></div>
    <div class="col" style="gap:2px">${[['AR', 'Aina Rahman', true], ['AK', 'Arjun Kumar', true], ['TM', 'Tan Mei Ling', false], ['AH', 'Aiman Hakim', false]].map(([i, n, on]) => `<div class="li" style="padding:8px">${av(i, 40)}<div class="t"><div class="n">${n}</div><div class="s">Friend</div></div><span class="chk ${on ? 'on' : ''}">${on ? I('check', 14) : ''}</span></div>`).join('')}</div>
    <div class="help">Only friends can be added, so nobody joins a chat with someone they have not accepted.</div>`, '<span class="b">Cancel</span><span class="b p">Create group (3)</span>') }));

// 35 group chat with info panel
add('35_group_chat', app('Messages', `<div class="content" style="display:flex">${convList('FYP Team, CT046')}${chatPane(`<div style="display:flex">${av('AR', 32)}<div style="margin-left:-10px">${av('AK', 32)}</div></div><div><div style="font-weight:700">FYP Team, CT046</div><div class="muted sm">3 members</div></div><span class="ib s" style="margin-left:auto">${I('info', 20)}</span>`,
  `<div class="row" style="gap:8px;align-items:flex-end">${av('AR', 28)}<div class="col" style="gap:4px"><span class="muted sm">Aina</span>${shareCard(false)}</div></div>
   <div class="row" style="gap:8px">${av('AK', 28)}<div class="bub" style="max-width:none">I will do the sequence diagrams for UC15 to UC18.</div></div>
   <div class="bub me">Great, I'll take the class diagram.</div>${shareCard(true, 1)}`)}
  <div style="width:300px;flex:none;background:#fff;padding:20px;display:flex;flex-direction:column;gap:14px">
    <b style="font-size:16px">Group details</b>
    <div class="fld"><label>Name</label><div class="in v">FYP Team, CT046<span class="end">${I('pencil', 16)}</span></div></div>
    <b class="sm" style="font-size:13px;color:var(--ink2)">Members 3</b>
    ${[['LQ', 'Lim Qi Cai', 'You · owner'], ['AR', 'Aina Rahman', 'Friend'], ['AK', 'Arjun Kumar', 'Friend']].map(([i, n, s], k) => `<div class="row" style="gap:10px">${av(i, 36)}<div style="flex:1"><div style="font-weight:650">${n}</div><div class="muted sm">${s}</div></div>${k ? `<span class="ib sm">${I('more', 16)}</span>` : ''}</div>`).join('')}
    <span class="b">${I('userPlus', 16)}Add member</span><span class="b g" style="margin-top:auto">${I('logout', 16)}Leave group</span></div></div>`, { left: title('Messages') }));

// 36 mobile chat
add('36_chat_mobile', mob(`<div style="height:56px;display:flex;align-items:center;gap:10px;padding:0 12px;box-shadow:inset 0 -1px 0 var(--line)">${I('left', 24)}${av('AR', 36)}<div style="flex:1"><b>Aina Rahman</b><div class="muted sm">Friends · active now</div></div>${I('info', 22)}</div>
  <div style="padding:14px;display:flex;flex-direction:column;gap:8px;background:var(--s0);height:640px">
    <div class="muted sm" style="text-align:center">Today 14:02</div>${shareCard(false).replace('width:300px', 'width:250px')}<div class="bub" style="max-width:80%">Is slide 2 the same as the tutorial 6 answer?</div>
    <div class="bub me" style="max-width:80%">Almost. The tutorial splits ENROL_T first.</div><div class="bub" style="max-width:80%">Thanks!</div></div>
  <div style="position:absolute;left:0;right:0;bottom:0;padding:10px 12px 34px;display:flex;gap:8px;align-items:center;background:#fff;box-shadow:inset 0 1px 0 var(--line)"><span class="ib s sm">${I('clip', 18)}</span><div class="in" style="flex:1;height:40px;border-radius:999px">Message…</div><span class="ib s sm" style="background:var(--acc);color:#fff">${I('send', 16)}</span></div>`, { tab: false }), true);

// ---------- admin
const adminApp = (on, body, o = {}) => app(on, body, { admin: true, me: 'AD', ...o });
add('37_admin_reports', adminApp('Reports', `<div class="content" style="display:flex;gap:0">
  <div style="width:440px;flex:none;padding:0 16px 0 32px;display:flex;flex-direction:column;gap:10px">
    <div class="row" style="gap:6px"><span class="chip on">Open 5</span><span class="chip">Resolved</span><span class="chip o" style="margin-left:auto">Oldest first ${I('down', 12)}</span></div>
    ${[['Lab 4 answers', 'Hafiz Ismail', ['Plagiarism', 'Spam'], 3, '2d', 'b'], ['ER notation, wrong arrows', 'Chloe Wong', ['Inaccurate'], 1, '1d', 'c'], ['Cheap tutoring, DM me', 'student_k82', ['Spam'], 2, '20h', 'a'], ['Week 6 lecture deck', 'Arjun Kumar', ['Copyright'], 1, '6h', 'b']].map(([t, a, rs, n, age, v], k) =>
      `<div class="li ${k === 0 ? 'on' : ''}" style="padding:12px;${k ? 'background:var(--s1)' : ''}"><div style="width:56px;height:70px;border-radius:6px;overflow:hidden;flex:none">${cover(t, v, '')}</div><div class="t" style="display:flex;flex-direction:column;gap:5px"><div class="n">${t}</div><div class="s">${a} · oldest report ${age} ago</div><div class="row" style="gap:6px">${rs.map((r) => `<span class="tag" style="${k === 0 ? 'background:#fff' : ''}">${r}</span>`).join('')}</div></div><b style="font-size:13px;white-space:nowrap">${n} report${n > 1 ? 's' : ''}</b></div>`).join('')}</div>
  <div style="flex:1;background:var(--s0);border-radius:16px 0 0 0;padding:24px;display:flex;gap:24px">
    <div style="width:200px;flex:none;display:flex;flex-direction:column;gap:10px"><div style="width:200px;height:250px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px var(--line)">${cover('Lab 4 answers', 'b', 'CT030-3-2')}</div><span class="b sm">${I('eye', 16)}Open note</span></div>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:14px">
      <div><b style="font-size:18px">Lab 4 answers</b><div class="muted sm">Hafiz Ismail · CT030-3-2 · Public · posted 4 Oct · 2 earlier upheld reports</div></div>
      <b class="sm" style="font-size:13px;color:var(--ink2)">Reports 3</b>
      ${[['LC', 'Dr Lee Chin Wei', 'Plagiarism', 'This is the assessed lab, copied from the marking guide.', true], ['TM', 'Tan Mei Ling', 'Plagiarism', '', false], ['AK', 'Arjun Kumar', 'Spam', 'Posted three times today.', false]].map(([i, n, r, d, dk]) => `<div class="row" style="gap:10px;align-items:flex-start;background:#fff;border-radius:10px;padding:10px">${av(i, 32, dk)}<div style="flex:1"><div class="row" style="gap:8px"><b class="sm" style="font-size:13px">${n}</b><span class="tag">${r}</span></div>${d ? `<div class="sm" style="font-size:13px;margin-top:4px">${d}</div>` : ''}</div></div>`).join('')}
      <div class="fld"><label>Resolution remark <span class="muted" style="font-weight:500">required</span></label><div class="in v ta" style="background:#fff;min-height:64px">Assessed lab answers shared before the deadline.</div></div>
      <div class="row" style="gap:10px"><span class="b">Dismiss</span><span class="b p">Hide note</span><span class="b">Hide and act on account</span></div></div></div></div>`, { left: title('Reports', '5 open') }));

add('38_admin_users', adminApp('Users', `<div class="content" style="padding:0 32px;display:flex;flex-direction:column;gap:14px">
  <div class="row"><div class="in" style="width:360px;border-radius:999px">${I('search', 18)}Search name or email</div><span class="chip on">All</span><span class="chip">Students</span><span class="chip">Lecturers</span><span class="chip">Suspended</span></div>
  <table class="tbl"><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Upheld reports</th><th>Joined</th><th></th></tr>
  ${[['HI', 'Hafiz Ismail', 'tp071833@mail.apu.edu.my', 'Student', 'Active', 2], ['LC', 'Dr Lee Chin Wei', 'lee.chinwei@apu.edu.my', 'Lecturer', 'Active', 0], ['CW', 'Chloe Wong', 'tp070412@mail.apu.edu.my', 'Student', 'Restricted', 1], ['K8', 'student_k82', 'tp073390@mail.apu.edu.my', 'Student', 'Suspended', 4], ['AR', 'Aina Rahman', 'tp072011@mail.apu.edu.my', 'Student', 'Active', 0]].map(([i, n, e, r, s, u]) =>
    `<tr><td><div class="row" style="gap:10px">${av(i, 32, i === 'LC')}<b>${n}</b></div></td><td class="muted">${e}</td><td>${r}</td><td><span class="st2 ${s === 'Suspended' ? 'd' : ''}">${s}</span></td><td>${u}</td><td class="muted">Sep 2026</td><td><span class="ib sm">${I('more', 18)}</span></td></tr>`).join('')}</table></div>`,
  { left: title('Users', '1,284'), over: dlg(460, 'Suspend Hafiz Ismail?', `<div style="color:var(--ink2);margin-top:-8px">Hafiz will be logged out and cannot sign in until reinstated. Their notes stay hidden while suspended.</div>
    <div class="row" style="gap:8px">${['Restrict posting', 'Suspend', 'Delete account'].map((t, k) => `<span class="chip ${k === 1 ? 'on' : 'o'}">${t}</span>`).join('')}</div>
    <div class="fld"><label>Reason <span class="muted" style="font-weight:500">required, saved to the account history</span></label><div class="in fo v ta">Third upheld plagiarism report: assessed Lab 4 answers shared publicly.</div></div>`, '<span class="b">Cancel</span><span class="b p">Suspend account</span>') }));

add('39_admin_lecturers', adminApp('Lecturer applications', `<div class="content" style="padding:0 32px;display:flex;flex-direction:column;gap:12px;width:980px">
  <div class="muted" style="font-size:15px;margin-bottom:4px">Check each staff ID against the APU staff directory before approving. Approval turns on Super Like and the lecturer badge.</div>
  ${[['PN', 'Priya Nair', 'priya.nair@apu.edu.my', 'S10233', 'School of Computing', '1 day ago', false], ['SA', 'Dr Siti Aminah', 'siti.aminah@apu.edu.my', 'S09871', 'School of Technology', '3 days ago', true]].map(([i, n, e, id, sc, ago, rej]) =>
    `<div style="background:var(--s1);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:14px"><div class="row" style="gap:14px">${av(i, 52)}<div style="flex:1"><b style="font-size:16px">${n}</b><div class="muted sm">${e} · applied ${ago}</div></div>
      <div style="width:110px;margin-right:12px"><div class="muted sm">Staff ID</div><b style="font-size:16px">${id}</b></div><div style="width:190px;margin-right:12px"><div class="muted sm">School</div><b>${sc}</b></div>
      ${rej ? '<span class="b" style="width:110px;box-shadow:inset 0 0 0 2px var(--ink)">Reject</span><span class="b dis" style="width:110px">Approve</span>' : '<span class="b" style="width:110px">Reject</span><span class="b p" style="width:110px">Approve</span>'}</div>
      ${rej ? `<div style="background:#fff;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px"><div class="fld"><label>Reason for rejecting <span class="muted" style="font-weight:500">sent to the applicant</span></label><div class="in fo v">Staff ID S09871 is not in the directory. Please re-apply with the ID on your staff card.</div></div><div class="row" style="justify-content:flex-end;gap:10px"><span class="b">Cancel</span><span class="b p">Reject application</span></div><div class="help">The account stays a student account and can apply again.</div></div>` : ''}</div>`).join('')}</div>`,
  { left: title('Lecturer applications', '2 pending') }));

add('40_admin_modules', adminApp('Modules', `<div class="content" style="padding:0 32px;display:flex;flex-direction:column;gap:14px;width:1000px">
  <div style="background:var(--s1);border-radius:14px;padding:14px;display:flex;gap:10px;align-items:flex-end">
    <div class="fld" style="width:180px"><label>Code</label><div class="in v" style="background:#fff">CT095-3-3</div></div><div class="fld" style="flex:1"><label>Name</label><div class="in fo v">Cloud Infrastructure</div></div><span class="b p" style="height:44px">${I('plus', 16)}Add module</span></div>
  <div class="row"><div class="in" style="width:320px;border-radius:999px">${I('search', 18)}Search code or name</div><span class="muted sm" style="margin-left:auto">Codes are unique. Renaming keeps every note linked.</span></div>
  <table class="tbl"><tr><th style="width:150px">Code</th><th>Name</th><th style="width:110px">Notes</th><th style="width:170px"></th></tr>
  ${[['CT030-3-2', 'Database Systems', 214], ['CT044-3-2', 'Algorithms and Data Structures', 187], ['CT046-3-M', 'Software Engineering Practice', 96], ['CT050-3-2', 'Operating Systems', 72], ['CT060-3-2', 'Computer Networks', 65], ['CT076-3-2', 'Web Application Development', 58]].map(([c, n, k], j) =>
    j === 2 ? `<tr><td><b>${c}</b></td><td><div class="row" style="gap:8px"><div class="in fo v" style="flex:1;min-height:36px;height:36px">Software Engineering Practice and Process</div><span class="b sm p">Save</span><span class="b sm">Cancel</span></div></td><td>${k}</td><td></td></tr>`
      : `<tr><td><b>${c}</b></td><td>${n}</td><td>${k}</td><td><span class="b sm g">${I('pencil', 14)}Rename</span></td></tr>`).join('')}</table></div>`,
  { left: title('Modules', '12') }));

/* ------------------------------------------------------------------ render */
// Each screen is laid out as HTML, serialised to a vector SVG (svg/), then the SVG itself is
// rasterised to png/ so the PNG in the report is exactly what Figma imports.
const outSvg = new URL('./svg/', import.meta.url), outPng = new URL('./png/', import.meta.url);
for (const d of [outSvg, outPng]) {
  mkdirSync(d, { recursive: true });
  for (const f of readdirSync(d)) if (/\.(png|svg)$/.test(f)) unlinkSync(new URL(f, d));
}
const only = process.argv[2];
const browser = await chromium.launch();
for (const [id, html, mobile] of screens) {
  if (only && !id.startsWith(only)) continue;
  const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`);
  const svg = await page.evaluate(domToSvg);
  writeFileSync(fileURLToPath(new URL(`${id}.svg`, outSvg)), svg);
  await page.setContent(`<!doctype html><html><head><style>body{margin:0}svg{display:block}</style></head><body>${svg.replace(/^<\?xml[^>]*>/, '')}</body></html>`);
  await page.screenshot({ path: fileURLToPath(new URL(`${id}.png`, outPng)) });
  await page.close();
}
await browser.close();
console.log(`rendered ${screens.length} wireframes`);
