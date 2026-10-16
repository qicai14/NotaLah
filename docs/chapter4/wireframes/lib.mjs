// Shared styles and components for the NotaLah wireframes (v3, low fidelity).
// Greyscale boxes, real text only for labels, headings and buttons; every descriptive line is lorem ipsum (L()).
// Image placeholders are crossed boxes (.xb). Layout follows TikTok web/mobile and a Canva-style editor.
import { P } from './icons.mjs';

/* ------------------------------------------------------------------ tokens + base styles */
export const css = `
:root{--bg:#fff;--s0:#fafafa;--s1:#f2f2f2;--s2:#e6e6e6;--s3:#cdcdcd;--line:#d6d6d6;--ink:#1c1c1c;--ink2:#474747;--ink3:#6b6b6b;
--acc:#3a3a3a;--media:#ededed;--media2:#e3e3e3;--hl:#d2d2d2;--r1:8px;--r2:12px;--r3:16px}
*{box-sizing:border-box;margin:0;padding:0}
body{font:14px/1.45 "Segoe UI",Arial,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
b,strong{font-weight:600}
.i{fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none;display:block}
.i .f{fill:currentColor;stroke:none}
.app{width:1440px;height:900px;display:flex;position:relative;overflow:hidden;background:var(--bg)}
.full{width:1440px;height:900px;position:relative;overflow:hidden;background:var(--bg)}
.xb{background-color:var(--s1);box-shadow:inset 0 0 0 1.5px var(--s3);
 background-image:linear-gradient(to top right,transparent calc(50% - .8px),var(--s3) calc(50% - .8px),var(--s3) calc(50% + .8px),transparent calc(50% + .8px)),
 linear-gradient(to bottom right,transparent calc(50% - .8px),var(--s3) calc(50% - .8px),var(--s3) calc(50% + .8px),transparent calc(50% + .8px))}
.dim{opacity:.4}

/* nav */
.nav{width:240px;flex:none;background:var(--s0);display:flex;flex-direction:column;padding:16px 12px 16px;gap:2px;position:relative;z-index:3;box-shadow:inset -1px 0 0 var(--line)}
.nav-head{display:flex;align-items:center;justify-content:space-between;height:40px;padding:0 4px 0 8px;margin-bottom:12px}
.logo{display:flex;align-items:center;gap:8px;font-size:21px;font-weight:700;letter-spacing:-.03em}
.mark{width:30px;height:30px;border-radius:9px;background:var(--ink);color:#fff;display:grid;place-items:center;font-size:16px;font-weight:700;letter-spacing:0}
.nsearch{height:40px;border-radius:999px;background:var(--s2);display:flex;align-items:center;gap:10px;padding:0 14px;color:var(--ink3);margin-bottom:10px}
.ni{white-space:nowrap;height:44px;border-radius:10px;display:flex;align-items:center;gap:14px;padding:0 12px;font-size:15px;font-weight:400;color:var(--ink2);position:relative}
.ni.on{background:var(--s2);color:var(--ink);font-weight:700}
.ni .cr{width:26px;height:26px;border-radius:8px;background:var(--acc);color:#fff;display:grid;place-items:center;margin:0 -1px}
.cnt{margin-left:auto;min-width:20px;height:20px;border-radius:999px;background:var(--acc);color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center;padding:0 6px}
.ngrp{font-size:12px;font-weight:600;color:var(--ink3);padding:14px 12px 4px}
.nfoot{margin-top:auto;padding:12px 12px 0;font-size:12px;color:var(--ink3);line-height:1.7}
.nav.c{width:72px;padding:16px 12px;align-items:center}
.nav.c .nav-head{flex-direction:column;height:auto;gap:12px;padding:0;margin-bottom:12px}
.nav.c .ni{width:48px;height:48px;padding:0;justify-content:center}
.nav.c .dot{position:absolute;top:9px;right:9px;width:9px;height:9px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 2px var(--s0)}
.ib{width:40px;height:40px;border-radius:999px;display:grid;place-items:center;color:var(--ink2);flex:none}
.ib.s{background:var(--s2);color:var(--ink)}
.ib.sm{width:32px;height:32px}
.gbox{margin:14px 4px 4px;padding:14px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--line);background:#fff;display:flex;flex-direction:column;gap:10px;font-size:13px;color:var(--ink2);line-height:1.4}

/* main + top band */
.main{flex:1;position:relative;overflow:hidden}
.top{position:absolute;top:0;left:0;right:0;height:72px;display:flex;align-items:center;padding:0 24px 0 32px;z-index:6}
.top .l{display:flex;align-items:center;gap:12px;flex:1}
.top .r{display:flex;align-items:center;gap:12px;flex:1;justify-content:flex-end}
.top h1{font-size:22px;font-weight:700;letter-spacing:-.02em}
.content{position:absolute;top:72px;left:0;right:0;bottom:0}
.av{border-radius:50%;background:var(--s1);box-shadow:inset 0 0 0 1.5px var(--s3);flex:none}
.iph{border-radius:50%;background:var(--s1);box-shadow:inset 0 0 0 1.5px var(--s3);flex:none;display:block}
.ilab{font-size:12px;font-weight:600;white-space:nowrap;color:var(--ink2)}
.stk{display:flex}.stk>*+*{margin-left:-10px}.stk.v{flex-direction:column}.stk.v>*+*{margin:-14px 0 0}.stk .av{box-shadow:0 0 0 2px #fff,inset 0 0 0 1.5px var(--s3)}

/* buttons, fields, chips, tabs */
.b{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 18px;border-radius:999px;font-weight:600;font-size:14px;background:var(--s2);color:var(--ink);white-space:nowrap;flex:none}
.b.p{background:var(--acc);color:#fff}
.b.g{background:transparent}
.b.o{background:#fff;box-shadow:inset 0 0 0 1.5px var(--s3)}
.b.sm{height:32px;padding:0 14px;font-size:13px}
.b.lg{height:48px;padding:0 26px;font-size:15px}
.b.w{width:100%}
.b.dis{background:var(--s1);color:var(--ink3)}
.fld{display:flex;flex-direction:column;gap:6px}
.fld>label{font-size:13px;font-weight:600;color:var(--ink2)}
.in{min-height:44px;border-radius:10px;background:var(--s1);box-shadow:inset 0 0 0 1px var(--line);padding:0 14px;display:flex;align-items:center;gap:8px;color:var(--ink3);font-size:14px}
.in.v{color:var(--ink)}
.in.fo{background:#fff;box-shadow:inset 0 0 0 2px var(--ink)}
.in.bad{background:#fff;box-shadow:inset 0 0 0 2px var(--ink2)}
.in.ta{align-items:flex-start;padding-top:12px;min-height:88px}
.in .end{margin-left:auto;display:flex;align-items:center;gap:6px}
.help{font-size:12px;color:var(--ink3)}
.err{font-size:13px;color:var(--ink);font-weight:600;display:flex;gap:6px;align-items:center}
.chip{height:32px;padding:0 12px;border-radius:999px;background:var(--s2);font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;color:var(--ink2);flex:none}
.chip.on{background:var(--acc);color:#fff}
.chip.o{background:#fff;box-shadow:inset 0 0 0 1.5px var(--s3)}
.tag{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 10px;border-radius:999px;background:var(--s2);font-size:12px;font-weight:600;color:var(--ink2);white-space:nowrap}
.tabs{display:flex;gap:28px;box-shadow:inset 0 -1px 0 var(--line)}
.tab{padding:12px 0;font-weight:600;font-size:15px;color:var(--ink3);position:relative;display:flex;gap:6px;align-items:center}
.tab.on{color:var(--ink)}
.tab.on::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2.5px;background:var(--ink);border-radius:2px}
.ftabs{display:flex;gap:28px;font-size:17px;font-weight:700;color:var(--ink3)}
.ftabs span{position:relative;padding:6px 0}
.ftabs .on{color:var(--ink)}
.ftabs .on::after{content:"";position:absolute;left:50%;bottom:0;width:24px;margin-left:-12px;height:3px;border-radius:2px;background:var(--ink)}
.seg{display:inline-flex;background:var(--s2);border-radius:999px;padding:3px;gap:2px}
.seg span{height:32px;padding:0 14px;border-radius:999px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--ink2)}
.seg .on{background:#fff;color:var(--ink);box-shadow:inset 0 0 0 1px var(--s3)}
.muted{color:var(--ink3)}
.sm{font-size:12px}
.row{display:flex;align-items:center;gap:12px}
.col{display:flex;flex-direction:column;gap:12px}
.vb{width:16px;height:16px;border-radius:50%;background:var(--ink);color:#fff;display:inline-grid;place-items:center;flex:none;vertical-align:-3px}
.vb.w{background:#fff;color:var(--ink);box-shadow:inset 0 0 0 1px var(--s3)}
.lect{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 7px;border-radius:6px;background:var(--s2);font-size:11px;font-weight:700;color:var(--ink2)}
.radio{width:20px;height:20px;border-radius:50%;box-shadow:inset 0 0 0 2px var(--s3);flex:none;display:grid;place-items:center;background:#fff}
.radio.on{box-shadow:inset 0 0 0 6px var(--acc)}
.chk{width:20px;height:20px;border-radius:6px;box-shadow:inset 0 0 0 2px var(--s3);flex:none;display:grid;place-items:center;background:#fff}
.chk.on{background:var(--acc);box-shadow:none;color:#fff}
.tog{width:40px;height:24px;border-radius:999px;background:var(--s3);position:relative;flex:none}
.tog::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff}
.tog.on{background:var(--acc)}.tog.on::after{left:19px}

/* floating surfaces */
.pop{position:absolute;background:#fff;border-radius:var(--r2);box-shadow:0 0 0 1.5px var(--ink3);padding:6px;z-index:30}
.mi{min-height:38px;padding:0 10px;border-radius:8px;display:flex;align-items:center;gap:10px;font-size:14px;color:var(--ink)}
.mi.on{background:var(--s2);font-weight:600}
.mi .k{margin-left:auto;color:var(--ink3);font-size:12px}
.scrim{position:absolute;inset:0;background:rgba(40,40,40,.4);display:grid;place-items:center;z-index:40}
.dlg{background:#fff;border-radius:20px;box-shadow:0 0 0 1.5px var(--ink3);padding:24px;display:flex;flex-direction:column;gap:18px;position:relative}
.dlg h2{font-size:20px;font-weight:700;letter-spacing:-.02em}
.dlg .x{position:absolute;top:16px;right:16px}
.dlg .acts{display:flex;justify-content:flex-end;gap:10px;padding-top:4px}

/* feed card */
.stage{position:absolute;inset:0;display:flex;justify-content:center;align-items:flex-start}
.frow{display:flex;align-items:flex-end;gap:16px;position:relative}
.card{position:relative;border-radius:var(--r3);background:var(--media);overflow:hidden;color:var(--ink);flex:none;box-shadow:inset 0 0 0 1.5px var(--s3)}
.dots{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:center;align-items:center;gap:6px;z-index:3}
.dots span{width:7px;height:7px;border-radius:4px;background:var(--s3)}
.dots .on{width:18px;background:var(--ink)}
.ctop{position:absolute;top:14px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:center;z-index:3}
.vpill{height:28px;padding:0 10px 0 6px;border-radius:999px;background:#fff;color:var(--ink);font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px;box-shadow:inset 0 0 0 1px var(--s3)}
.vpill.ed{border:1.5px dashed var(--ink2);box-shadow:none;padding:0 10px 0 7px}
.why{height:28px;padding:0 10px 0 8px;border-radius:999px;background:var(--s2);color:var(--ink);font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px}
.why.on{background:#fff;box-shadow:inset 0 0 0 1.5px var(--ink)}
.cslide{position:absolute;left:0;right:0}
.sarr{position:absolute;width:32px;height:32px;border-radius:50%;background:#fff;color:var(--ink);display:grid;place-items:center;box-shadow:inset 0 0 0 1px var(--s3);z-index:3}
.cap{position:absolute;left:16px;right:16px;bottom:16px;display:flex;flex-direction:column;gap:6px;z-index:3}
.cap .nm{font-size:16px;font-weight:700;display:flex;align-items:center;gap:6px}
.cap .tt{font-size:15px;font-weight:600;line-height:1.3}
.cap .ds{font-size:14px;color:var(--ink2);line-height:1.35}
.cap .ds b{color:var(--ink)}
.mod{white-space:nowrap;flex:none;display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:7px;background:var(--s2);font-size:12px;font-weight:600;align-self:flex-start}
.mus{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:400;margin-top:2px}
.pp{width:28px;height:28px;border-radius:50%;background:#fff;color:var(--ink);display:grid;place-items:center;flex:none;box-shadow:inset 0 0 0 1px var(--s3)}
.rail{display:flex;flex-direction:column;align-items:center;gap:14px;width:56px;flex:none}
.rb{white-space:nowrap;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;font-weight:600;color:var(--ink2)}
.rb .c{width:48px;height:48px;border-radius:50%;background:var(--s2);display:grid;place-items:center;color:var(--ink)}
.rb.on .c{background:var(--acc);color:#fff}
.rb.sup .c{background:#fff;color:var(--ink);box-shadow:inset 0 0 0 2.5px var(--ink)}
.rav{position:relative;margin-bottom:10px}
.rav .pl{position:absolute;bottom:-9px;left:50%;margin-left:-10px;width:20px;height:20px;border-radius:50%;background:var(--acc);color:#fff;display:grid;place-items:center;box-shadow:0 0 0 2px #fff}
.arrows{position:absolute;right:24px;top:50%;margin-top:-50px;display:flex;flex-direction:column;gap:12px;z-index:4}

/* slides (content scales with container width) */
.sl{background:#fff;color:var(--ink);container-type:inline-size;position:relative;overflow:hidden;width:100%;height:100%}
.sl.tall .sp{padding-top:24cqw}
.sl.dk,.sl.gy{background:var(--s1)}
.sp{position:absolute;inset:0;padding:7cqw;display:flex;flex-direction:column;gap:3.2cqw}
.sl .k{font-size:3cqw;font-weight:600;color:var(--ink3)}
.sl h3{font-size:7.4cqw;font-weight:700;letter-spacing:-.025em;line-height:1.08}
.sl .p{font-size:3.6cqw;line-height:1.4;color:var(--ink2)}
.sl .nf{display:flex;gap:3cqw;align-items:baseline;background:var(--s1);border-radius:2.4cqw;padding:3cqw 3.4cqw}
.sl .nf b{font-size:4.4cqw;min-width:10cqw}
.sl .nf span{font-size:3.6cqw;line-height:1.35;color:var(--ink2)}
.sl .ex{font-size:3.3cqw;line-height:1.4;color:var(--ink2);background:var(--s2);border-radius:2.4cqw;padding:3cqw 3.4cqw}
.sl mark{background:var(--hl);color:inherit;border-radius:.6cqw;padding:0 .4cqw}
.sl mark sup{font-size:2.4cqw;font-weight:700;margin-left:.4cqw}
.ln.hl{background:var(--s3)}
.anum{width:4.4cqw;height:4.4cqw;border-radius:50%;background:var(--ink);color:#fff;font-size:2.6cqw;font-weight:700;display:grid;place-items:center;flex:none}
.sl.w .sp{padding:5cqw 6cqw;gap:2cqw}
.sl.w .k{font-size:1.8cqw}
.sl.w h3{font-size:4.4cqw}
.sl table{border-collapse:collapse;width:100%;font-size:2.2cqw}
.sl th{text-align:left;font-weight:700;padding:1.1cqw 1.4cqw;background:var(--s2)}
.sl td{padding:1.4cqw}
.sl tr:nth-child(odd) td{background:var(--s1)}
.boxes{display:flex;gap:2cqw;align-items:flex-end}
.bx{border-radius:1.6cqw;background:var(--s2);font-size:3.4cqw;font-weight:700;display:grid;place-items:center}
.bx.d{background:var(--ink2);color:#fff}
.ln{height:2.2cqw;border-radius:1cqw;background:var(--s2)}
.big{font-size:12cqw;font-weight:700;letter-spacing:-.04em;line-height:1}

/* tiles */
.grid{display:grid;gap:12px}
.grid>*{min-width:0}
.tile{position:relative;aspect-ratio:3/4;border-radius:10px;overflow:hidden;background:var(--media);box-shadow:inset 0 0 0 1px var(--s3)}
.tile .sl{position:absolute;inset:1px;width:auto;height:auto;border-radius:9px}
.tile .st{position:absolute;left:8px;bottom:8px;color:var(--ink);font-size:12px;font-weight:700;display:flex;gap:4px;align-items:center;background:#fff;border-radius:6px;padding:2px 6px}
.tile .tl{position:absolute;left:8px;top:8px;display:flex;gap:4px}
.tile .tlab{height:20px;padding:0 6px;border-radius:5px;background:#fff;color:var(--ink);font-size:11px;font-weight:700;display:flex;align-items:center;gap:3px;box-shadow:inset 0 0 0 1px var(--s3)}
.tcap{font-size:13px;font-weight:600;margin-top:6px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tsub{font-size:12px;color:var(--ink3);display:flex;gap:6px;align-items:center}

/* panels */
.side{position:absolute;top:72px;right:0;bottom:0;background:var(--s0);display:flex;flex-direction:column;z-index:5;box-shadow:inset 1px 0 0 var(--line)}
.cm{display:flex;gap:10px;padding:12px 0}
.cm .bd{flex:1;display:flex;flex-direction:column;gap:3px;font-size:14px;line-height:1.4}
.cm .who{font-size:13px;font-weight:600;color:var(--ink2);display:flex;gap:6px;align-items:center}
.cm .meta{font-size:12px;color:var(--ink3);display:flex;gap:14px;margin-top:2px}
.cm .lk{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:12px;color:var(--ink3);padding-top:16px}
.at{font-weight:600;color:var(--ink);background:var(--s2);border-radius:4px;padding:0 3px}
.reply{margin-left:46px}
.pin{font-size:11px;font-weight:700;color:var(--ink3);display:flex;gap:4px;align-items:center}
.inbar{padding:12px 20px 16px;display:flex;gap:10px;align-items:center;background:var(--s0)}
.list{display:flex;flex-direction:column}
.li{display:flex;gap:12px;align-items:center;padding:10px 12px;border-radius:12px}
.li.on{background:var(--s2)}
.li .t{flex:1;min-width:0}
.li .n{font-weight:600;font-size:14px;display:flex;gap:6px;align-items:center}
.li .s{font-size:13px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bub{align-self:flex-start;max-width:62%;padding:10px 14px;border-radius:18px;background:var(--s2);font-size:14px;line-height:1.4}
.bub.me{align-self:flex-end;margin-left:auto;background:var(--acc);color:#fff}
.ncard{width:300px;border-radius:16px;background:var(--s1);overflow:hidden;box-shadow:inset 0 0 0 1px var(--line);flex:none}
.ncard.me{margin-left:auto}
.ncard .th{height:150px;background:var(--media);display:grid;place-items:center;overflow:hidden}
.ncard .mt{padding:10px 12px;display:flex;flex-direction:column;gap:2px}
.banner{display:flex;gap:12px;align-items:center;padding:12px 16px;border-radius:12px;background:#fff;box-shadow:inset 0 0 0 1.5px var(--ink2)}

/* tables */
.tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:14px}
.tbl th{text-align:left;font-size:12px;font-weight:600;color:var(--ink3);padding:10px 12px;background:var(--s1)}
.tbl th:first-child{border-radius:10px 0 0 10px}.tbl th:last-child{border-radius:0 10px 10px 0}
.tbl td{padding:14px 12px;box-shadow:inset 0 -1px 0 var(--line);vertical-align:middle}
.st2{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:999px;background:var(--s2);font-size:12px;font-weight:600;color:var(--ink2)}
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
.ctx{position:absolute;top:12px;left:50%;transform:translateX(-50%);height:48px;background:#fff;border-radius:12px;box-shadow:0 0 0 1px var(--s3);display:flex;align-items:center;padding:0 6px;gap:2px;white-space:nowrap;z-index:6}
.tb2{height:36px;min-width:36px;padding:0 8px;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:600;color:var(--ink)}
.tb2.on{background:var(--s2)}
.tb2.dd{box-shadow:inset 0 0 0 1px var(--s3)}
.sep{width:1px;height:24px;background:var(--line);margin:0 4px;flex:none}
.board{position:absolute;background:#fff;box-shadow:0 0 0 1px var(--s3);container-type:inline-size}
.sel{outline:2px solid var(--ink);outline-offset:2px}
.hd{position:absolute;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px var(--ink)}
.hd.e{width:8px;height:18px;border-radius:4px}
.hd.n{width:18px;height:8px;border-radius:4px}
.guide{position:absolute;background:var(--ink2);z-index:5}
.gl{position:absolute;font-size:11px;font-weight:700;background:var(--ink2);color:#fff;border-radius:4px;padding:1px 5px;z-index:5}
.rot{position:absolute;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 0 0 1px var(--s3);display:grid;place-items:center;color:var(--ink)}
.ebot{position:absolute;left:0;right:0;bottom:0;background:#fff;box-shadow:inset 0 1px 0 var(--line)}
.thumbs{display:flex;gap:10px;align-items:center;padding:12px 20px 8px;height:100px}
.thm{position:relative;border-radius:8px;overflow:hidden;box-shadow:0 0 0 1px var(--line);flex:none;background:#fff}
.thm.on{box-shadow:0 0 0 2.5px var(--ink)}
.thm .no{position:absolute;left:4px;bottom:4px;font-size:10px;font-weight:700;background:#fff;border-radius:4px;padding:0 4px}
.addp{width:52px;height:72px;border-radius:8px;background:var(--s1);display:grid;place-items:center;color:var(--ink2);flex:none}
.stbar{height:44px;display:flex;align-items:center;gap:12px;padding:0 16px;font-size:13px;color:var(--ink2);font-weight:600}
.zoom{width:120px;height:4px;border-radius:2px;background:var(--s3);position:relative}
.zoom::after{content:"";position:absolute;left:44%;top:-6px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px var(--ink2)}
.tpl{border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px var(--line);position:relative}

/* mobile */
.m{width:390px;height:844px;position:relative;overflow:hidden;background:#fff}
.sb{height:44px;display:flex;justify-content:space-between;align-items:center;padding:0 26px 0 30px;font-weight:600;font-size:15px;position:relative;z-index:9}
.sbi{display:flex;gap:6px;align-items:center}
.tbar{position:absolute;bottom:0;left:0;right:0;height:84px;padding-bottom:24px;display:flex;justify-content:space-around;align-items:center;background:#fff;z-index:9;box-shadow:inset 0 1px 0 var(--line)}
.tbi{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;font-weight:600;color:var(--ink3);width:64px;position:relative}
.tbi.on{color:var(--ink)}
.tbc{width:46px;height:32px;border-radius:10px;background:var(--acc);color:#fff;display:grid;place-items:center}
.tbi .bd{position:absolute;top:-4px;left:36px;min-width:18px;height:18px;border-radius:999px;background:var(--acc);color:#fff;font-size:10px;font-weight:700;display:grid;place-items:center;padding:0 5px;box-shadow:0 0 0 2px #fff}
.home{position:absolute;bottom:8px;left:50%;margin-left:-67px;width:134px;height:5px;border-radius:3px;background:var(--ink);z-index:10}
.mrail{position:absolute;right:8px;display:flex;flex-direction:column;align-items:center;gap:16px;z-index:4}
.mrb{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:12px;font-weight:600;color:var(--ink)}
.mrb .c{width:46px;height:46px;border-radius:50%;background:var(--s2);color:var(--ink);display:grid;place-items:center}
.mrb.on .c{background:var(--acc);color:#fff}
.sheet{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:16px 16px 0 0;z-index:20;display:flex;flex-direction:column;color:var(--ink);box-shadow:0 0 0 1.5px var(--ink3)}
.grab{width:36px;height:5px;border-radius:3px;background:var(--s3);margin:8px auto 0}
`;

/* ------------------------------------------------------------------ primitives */
export const I = (n, s = 20) => `<svg class="i" data-n="${n}" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;
export const VB = (w = false, s = 16) => `<span class="vb ${w ? 'w' : ''}" style="width:${s}px;height:${s}px">${I('check', s * 0.7)}</span>`;
// avatars are plain crossed circles (initials are kept only as a title for the source)
export const av = (t, s = 36) => `<div class="av xc" title="${t}" style="width:${s}px;height:${s}px"></div>`;
export const stack = (ids, s = 28) => `<div class="stk">${ids.map((i, k) => av(i, s, k === 0)).join('')}</div>`;
export const LECT = `<span class="lect">${I('check', 11)}Lecturer</span>`;
export const xb = (style = '') => `<div class="xb" style="${style}"></div>`;

// Deterministic lorem ipsum: each call continues where the last one stopped, so screens differ but rebuilds match.
const LW = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua '
  + 'ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in '
  + 'reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa').split(' ');
let lo = 0;
export const L = (n, sentence = true) => {
  const w = Array.from({ length: n }, (_, i) => LW[(lo + i) % LW.length]);
  lo = (lo + n + 5) % LW.length;
  const s = w.join(' ');
  return sentence ? `${s[0].toUpperCase()}${s.slice(1)}.` : s;
};

/* ------------------------------------------------------------------ sample labels */
export const ME = { n: 'Lim Qi Cai', i: 'LQ' };
export const MODS = {
  db: 'CT030-3-2 Database Systems', ads: 'CT044-3-2 Algorithms and Data Structures', se: 'AICT004 Software Engineering',
  net: 'CT060-3-2 Computer Networks', os: 'CT050-3-2 Operating Systems', web: 'CT076-3-2 Web Application Development',
};
export const MUSIC = 'Track title · Artist';

/* slides: one lo-fi layout for every kind (kicker, title, grey text lines, crossed image box); container-query units */
const SLIDES = {
  norm: ['CT030-3-2 · Week 6', 'Normalisation, 1NF to 3NF'], sort: ['CT044-3-2 · Week 8', 'Sorting at a glance'],
  stack: ['CT044-3-2 · #dsa', 'Stack vs queue'], mvc: ['AICT004 · Week 4', 'Model, view, controller'], img: ['CT060-3-2 · Week 3', 'TCP handshake'],
};
export const slide = (kind, opt = {}) => {
  const lines = (ws) => ws.map((w) => `<div class="ln" style="width:${w}%"></div>`).join('');
  // hl: three text-anchored annotation markers (numbered) on highlighted lines
  const ann = (n, w) => `<div style="display:flex;gap:1.6cqw;align-items:center"><div class="ln hl" style="width:${w}%"></div><span class="anum">${n}</span><div class="ln" style="flex:1"></div></div>`;
  const s = SLIDES[kind];
  const body = !s ? '' : opt.aspect === '16:9' && !opt.hl
    ? `<div class="sp"><div class="k">${s[0]}</div><h3>${s[1]}</h3><div style="flex:1;display:flex;gap:4cqw"><div style="flex:1;display:flex;flex-direction:column;gap:2.4cqw">${lines([92, 78, 86, 64])}</div>${xb('flex:1;border-radius:2cqw')}</div></div>`
    : `<div class="sp"><div class="k">${s[0]}</div><h3>${s[1]}</h3>${opt.hl ? `${ann(1, 34)}${lines([88])}${ann(2, 46)}${lines([72])}${ann(3, 28)}` : lines([92, 78, 86])}${xb('flex:1;border-radius:2cqw')}${lines([90, 64])}</div>`;
  const wide = opt.aspect === '16:9';
  return `<div class="sl ${wide ? 'w' : ''} ${opt.cls || ''}" style="width:100%;height:100%">${body}</div>`;
};
// slide position indicator, shown at the bottom of every slide (n dots, current one elongated)
export const dots = (n = 6, idx = 1, style = '') => `<div class="dots" style="${style}">${Array.from({ length: n }, (_, i) => `<span class="${i === idx ? 'on' : ''}"></span>`).join('')}</div>`;
// cover art for grids and thumbnails is a crossed box
export const cover = () => `<div class="sl">${xb('position:absolute;inset:0')}</div>`;
export const COVERS = [
  ['Normalisation, 1NF to 3NF', 'a', 'CT030-3-2', '1.2K', true], ['SQL joins in one page', 'b', 'CT030-3-2', '864', false], ['O(n log n)', 'd', 'CT044-3-2', '2.4K', true],
  ['Use case diagrams: include vs extend', 'c', 'AICT004', '415', false], ['TCP vs UDP', 'b', 'CT060-3-2', '1.1K', true], ['Recursion, traced', 'a', 'CT044-3-2', '378', false],
  ['Scrum ceremonies', 'c', 'CT038-3-2', '292', false], ['Stack vs queue', 'a', 'CT044-3-2', '957', true], ['Deadlock: four conditions', 'b', 'CT050-3-2', '640', false],
  ["Crow's foot notation", 'c', 'CT030-3-2', '511', false], ['Merge sort step by step', 'a', 'CT044-3-2', '733', false], ['REST in five rules', 'b', 'CT076-3-2', '188', false],
];
export const tile = (c, o = {}) => `<div><div class="tile">${cover(c[0], c[1], c[2])}
  <div class="tl">${o.pinned ? `<span class="tlab">${I('pin', 11)}Pinned</span>` : ''}${c[4] && !o.pinned ? `<span class="tlab">${I('check', 11)}Verified</span>` : ''}${o.priv ? `<span class="tlab">${I('lock', 11)}Friends only</span>` : ''}${o.co ? `<span class="tlab">${I('users', 11)}Co-authored</span>` : ''}</div>
  <div class="st">${I('heart', 14)}${c[3]}</div></div>${o.cap ? `<div class="tcap">${c[0]}</div><div class="tsub">${o.sub || c[2]}</div>` : ''}</div>`;

/* ------------------------------------------------------------------ shell */
const NAV = [['Feed', 'home'], ['Following', 'users'], ['Explore', 'compass'], ['Create', 'plus'], ['Messages', 'msg'], ['Notifications', 'bell'], ['Saved', 'bookmark'], ['Profile', 'user'], ['More', 'more']];
const GUEST_NAV = [['Feed', 'home'], ['Explore', 'compass']];
const ADMIN = [['Reports', 'flag', 5], ['Users', 'users'], ['Lecturer applications', 'shield'], ['Modules', 'book'], ['Terms', 'cal']];
export const nav = (on, o = {}) => {
  const badge = (n) => (n === 'Notifications' ? 3 : n === 'Messages' ? 2 : 0);
  const icon = (n, ic) => (n === 'Create' ? `<span class="cr">${I('plus', 18)}</span>` : I(ic, 24));
  if (o.collapsed) {
    return `<nav class="nav c"><div class="nav-head"><div class="mark">N</div><div class="ib" title="Expand menu">${I('sidebar', 22)}</div></div>
      <div class="ni" style="background:var(--s2);border-radius:999px">${I('search', 22)}</div>
      ${NAV.map(([n, ic]) => `<div class="ni ${n === on ? 'on' : ''}" title="${n}">${icon(n, ic)}${badge(n) ? '<span class="dot"></span>' : ''}</div>`).join('')}
      ${o.admin ? `<div style="height:1px;width:32px;background:var(--line);margin:8px 0"></div>${ADMIN.map(([n, ic]) => `<div class="ni ${n === on ? 'on' : ''}">${I(ic, 24)}</div>`).join('')}` : ''}
      <div style="margin-top:auto"></div></nav>`;
  }
  if (o.guest) {
    return `<nav class="nav"><div class="nav-head"><div class="logo"><span class="mark">N</span>NotaLah</div><div class="ib">${I('sidebar', 22)}</div></div>
      <div class="nsearch">${I('search', 18)}Search</div>
      ${GUEST_NAV.map(([n, ic]) => `<div class="ni ${n === on ? 'on' : ''}">${I(ic, 24)}${n}</div>`).join('')}
      <div class="gbox"><span>${L(12)}</span><span class="b p w">Log in</span><span class="b o w">Register</span></div>
      <div class="nfoot">About · Help · Terms · Privacy<br>© 2026 NotaLah</div></nav>`;
  }
  return `<nav class="nav"><div class="nav-head"><div class="logo"><span class="mark">N</span>NotaLah</div><div class="ib" title="Collapse menu">${I('sidebar', 22)}</div></div>
    <div class="nsearch">${I('search', 18)}Search</div>
    ${NAV.filter(([n]) => !(o.admin && n === 'More')).map(([n, ic]) => `<div class="ni ${n === on ? 'on' : ''}">${icon(n, ic)}${n}${badge(n) ? `<span class="cnt">${badge(n)}</span>` : ''}</div>`).join('')}
    ${o.admin ? `<div class="ngrp">Admin</div>${ADMIN.map(([n, ic, c]) => `<div class="ni ${n === on ? 'on' : ''}">${I(ic, 24)}${n}${c ? `<span class="cnt">${c}</span>` : ''}</div>`).join('')}` : ''}
    <div class="nfoot">About · Help · Terms · Privacy<br>© 2026 NotaLah</div></nav>`;
};
export const util = (me = ME.i) => `<span class="b sm o">${I('plus', 16)}Create</span>${av(me, 36)}`;
export const guestUtil = `<span class="b sm p">${I('login', 16)}Log in</span>`;
export const app = (on, body, o = {}) => `<div class="app">${nav(on, o)}<div class="main">
  <div class="top"><div class="l">${o.left || ''}</div>${o.center ? `<div>${o.center}</div>` : ''}<div class="r">${o.right ?? (o.guest ? guestUtil : util(o.me))}</div></div>
  ${body}</div>${o.over || ''}</div>`;
export const title = (t, sub = '') => `<h1>${t}</h1>${sub ? `<span class="muted" style="font-size:15px;font-weight:600">${sub}</span>` : ''}`;
export const backT = (t) => `<span class="ib s sm">${I('back', 18)}</span><h1>${t}</h1>`;
export const ftabs = (on = 'Feed', tabs = ['Feed', 'Following']) => `<div class="ftabs">${tabs.map((t) => `<span class="${t === on ? 'on' : ''}">${t}</span>`).join('')}</div>`;

/* ------------------------------------------------------------------ feed card + rail */
export const CW = 456, CH = 812;
export const feedCard = (o) => {
  const w = o.w ?? CW, h = o.h ?? CH, a = o.aspect ?? '4:5';
  let sh, top;
  if (a === '9:16') { sh = h; top = 0; } else if (a === '4:5') { sh = Math.round(w * 1.25); top = 64; } else { sh = Math.round(w * 9 / 16); top = Math.round(h * 0.27); }
  const n = o.count ?? 6, idx = o.idx ?? 1;
  const pill = o.edited ? `<span class="vpill ed">${I('warn', 16)}Edited since verification</span>` : o.verified ? `<span class="vpill">${VB(false, 18)}Verified by ${o.verified}</span>` : '<span></span>';
  const who = o.coauthors ? `<span class="stk" style="margin-right:4px">${[o.authorI ?? 'AR', ...o.coauthors.map((c) => c[0])].map((i, k) => av(i, 24, k === 0)).join('')}</span>${o.author ?? 'Aina Rahman'}` : `${o.author ?? 'Aina Rahman'}${o.lect ? ` ${VB(true, 16)}` : ''}`;
  return `<div class="card" style="width:${w}px;height:${h}px">
    <div class="cslide" style="top:${top}px;height:${sh}px">${slide(o.kind ?? 'norm', { aspect: a, cls: a === '9:16' ? 'dk tall' : '' })}${a === '16:9' ? '' : dots(n, idx, a === '9:16' ? 'bottom:236px' : '')}</div>
    <div class="ctop">${pill}<span class="why ${o.whyOn ? 'on' : ''}">${I('info', 16)}Why this note?</span></div>
    ${a === '16:9' ? `<div style="position:absolute;top:${top + sh + 16}px;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:14px;z-index:3;font-size:13px;font-weight:600"><span class="sarr" style="position:static">${I('left', 18)}</span>${dots(n, idx, 'position:static')}<span class="sarr" style="position:static">${I('right', 18)}</span></div>`
      : `<div class="sarr" style="left:10px;top:${top + sh / 2 - 16}px">${I('left', 18)}</div><div class="sarr" style="right:10px;top:${top + sh / 2 - 16}px">${I('right', 18)}</div>`}
    <div class="cap" style="${a === '9:16' ? 'background:#fff;border-radius:12px;padding:10px 12px;left:10px;right:10px;bottom:10px;box-shadow:inset 0 0 0 1px var(--s3)' : ''}"><div class="nm">${who}<span style="font-weight:400;color:var(--ink3);font-size:14px">· ${o.age ?? '2d ago'}</span></div>${o.coauthors ? `<div class="ds" style="margin-top:-4px">with <b>${o.coauthors.map((c) => c[1]).join('</b> and <b>')}</b></div>` : ''}
      <div class="tt">${o.title ?? 'Normalisation, 1NF to 3NF in one page'}</div>
      <div class="ds">${o.desc ?? `${L(6)} <b>#normalisation</b> <b>#sql</b>`}</div>
      <span class="mod">${I('book', 14)}${o.mod ?? MODS.db}</span>
      ${o.music === false ? '' : `<div class="mus"><span class="pp">${I(o.playing === false ? 'play' : 'pause', 14)}</span>${I('music', 16)}${o.music ?? MUSIC}</div>`}</div></div>`;
};
export const rail = (o = {}) => `<div class="rail"><div class="rav">${o.coav ? stack(o.coav, 44).replace("stk", "stk v") : av(o.av ?? 'AR', 48, true)}${o.following || o.coav ? '' : `<span class="pl">${I('plus', 13)}</span>`}</div>
  ${o.superlike ? `<div class="rb sup"><span class="c">${I(o.superlike === 'on' ? 'starF' : 'star', 24)}</span>${o.superlikeLabel ?? 'Super Like'}</div>` : ''}
  <div class="rb ${o.liked ? 'on' : ''}"><span class="c">${I(o.liked ? 'heartF' : 'heart', 24)}</span>${o.likes ?? '1.2K'}</div>
  <div class="rb ${o.commentsOn ? 'on' : ''}"><span class="c">${I('comment', 24)}</span>${o.comments ?? '44'}</div>
  <div class="rb ${o.saved ? 'on' : ''}"><span class="c">${I('bookmark', 22)}</span>${o.saves ?? '318'}</div>
  <div class="rb"><span class="c">${I('share', 22)}</span>Share</div>
  <div class="rb ${o.moreOn ? 'on' : ''}"><span class="c">${I('more', 22)}</span></div></div>`;
export const arrows = `<div class="arrows"><span class="ib s" style="width:44px;height:44px">${I('up', 22)}</span><span class="ib s" style="width:44px;height:44px">${I('down', 22)}</span></div>`;
export const feedBody = (card, r, o = {}) => `<div class="content"><div class="stage" style="${o.right ? `right:${o.right}px` : ''}"><div class="frow">${card}${r}${o.pop || ''}</div></div>${o.noArrows ? '' : arrows}</div>`;

/* ------------------------------------------------------------------ comments */
export const comment = (a, name, body, meta, o = {}) => `<div class="cm ${o.reply ? 'reply' : ''}">${av(a, o.reply ? 28 : 36, o.dark)}<div class="bd">${o.pin ? `<span class="pin">${I('pin', 12)}Pinned by author</span>` : ''}<span class="who">${name}</span><div>${body}</div><div class="meta"><span>${meta}</span><b>Reply</b></div></div><div class="lk">${I('heart', 18)}${o.likes ?? ''}</div></div>`;
export const commentList = (o = {}) => `${comment('LC', `Dr Lee Chin Wei ${LECT}`, L(o.short ? 12 : 20), '2d', { pin: true, likes: 86, dark: true })}
  ${comment('AR', 'Aina Rahman', L(8), '1d', { likes: 12 })}
  ${comment('LQ', 'Lim Qi Cai <span class="lect" style="background:var(--s3)">Author</span>', `<span class="at">@ainarahman</span> ${L(9, false)}.`, '20h', { reply: true, likes: 5 })}
  ${o.short ? '' : `<div class="reply muted sm" style="font-weight:600;margin:-4px 0 4px 46px;display:flex;gap:4px;align-items:center">View 1 more reply ${I('down', 14)}</div>`}
  ${comment('HI', 'Hafiz Ismail', L(7), '5h', { likes: 4 })}
  ${o.short ? '' : comment('CW', 'Chloe Wong', L(9), '3h', { likes: 2 })}`;

/* ------------------------------------------------------------------ mobile parts */
export const sbar = `<div class="sb"><span>9:41</span><span class="sbi">${I('wifi', 17)}${I('battery', 24)}</span></div>`;
export const tabbar = (on, o = {}) => `<div class="tbar">${(o.guest ? [['Home', 'home'], ['Discover', 'compass'], ['Log in', 'login']] : [['Home', 'home'], ['Discover', 'compass'], ['', 'plus'], ['Inbox', 'inbox'], ['Profile', 'user']]).map(([n, ic]) =>
  n === '' ? `<div class="tbi"><span class="tbc">${I('plus', 20)}</span></div>`
    : `<div class="tbi ${n === on ? 'on' : ''}">${I(ic, 24)}${n}${n === 'Inbox' ? '<span class="bd">5</span>' : ''}</div>`).join('')}</div><div class="home"></div>`;
export const mob = (inner, o = {}) => `<div class="m">${sbar}${inner}${o.tab === false ? '<div class="home"></div>' : tabbar(o.tab ?? 'Home', o)}</div>`;
export const mTop = (l, c, r) => `<div style="height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;position:relative;z-index:5"><div style="width:60px">${l || ''}</div><div style="font-weight:700;font-size:17px">${c || ''}</div><div style="width:60px;display:flex;justify-content:flex-end;gap:4px">${r || ''}</div></div>`;
export const mobileFeed = (sheet = '', o = {}) => {
  const sTop = 150, sw = 318, sh = Math.round(318 * 1.25);
  const mb = (ic, c, on) => `<div class="mrb ${on ? 'on' : ''}"><span class="c">${I(ic, 24)}</span>${c}</div>`;
  return mob(`<div style="position:absolute;top:44px;left:0;right:0;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;z-index:5">
      <span class="ib">${I('menu', 24)}</span>${ftabs('Feed', o.guest ? ['Feed'] : ['Feed', 'Following'])}${o.guest ? '<span class="b sm p">Log in</span>' : `<span class="ib">${I('search', 24)}</span>`}</div>
    <div style="position:absolute;top:104px;left:12px;right:12px;display:flex;justify-content:space-between;z-index:4"><span class="vpill">${VB(false, 18)}Verified by Dr Lee</span><span class="why">${I('info', 16)}Why?</span></div>
    <div style="position:absolute;top:${sTop}px;left:12px;width:${sw}px;height:${sh}px;border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px var(--s3)">${slide('norm')}${dots(6, 1)}</div>
    <div class="mrail" style="top:250px;right:6px">
      <div class="rav" style="margin-bottom:4px">${av('AR', 46, true)}<span class="pl">${I('plus', 13)}</span></div>
      ${mb(o.guest ? 'heart' : 'heartF', '1.2K', !o.guest)}${mb('comment', '44')}${mb('bookmark', '318')}${mb('share', 'Share')}</div>
    <div style="position:absolute;left:14px;right:70px;top:${sTop + sh + 16}px;display:flex;flex-direction:column;gap:6px;z-index:4">
      <div style="font-weight:700;font-size:16px">Aina Rahman <span style="color:var(--ink3);font-weight:400;font-size:14px">· 2d ago</span></div>
      <div style="font-size:14px;font-weight:600">Normalisation, 1NF to 3NF in one page <b>#normalisation #sql</b></div>
      <div class="row" style="gap:8px"><span class="mod">${I('book', 14)}CT030-3-2 Database Systems</span></div><div class="mus" style="margin:0;white-space:nowrap"><span class="pp" style="width:24px;height:24px">${I('pause', 12)}</span>${I('music', 15)}${MUSIC}</div></div>${sheet}`, { tab: 'Home', guest: o.guest });
};

/* ------------------------------------------------------------------ editor parts */
export const ERAIL = [['Templates', 'layout'], ['Elements', 'shapes'], ['Text', 'type'], ['Uploads', 'upload'], ['Photos', 'image'], ['Music', 'music'], ['Background', 'palette']];
export const ebar = (o = {}) => `<div class="ebar"><span class="b g sm" style="padding:0 10px">${I('left', 18)}Home</span><span class="sep"></span>
  <span class="tb2" style="font-size:14px;font-weight:600">${o.title ?? 'Normalisation, 1NF to 3NF'} ${o.locked ? '' : I('pencil', 14)}</span>
  <span class="row muted sm" style="gap:6px;margin-left:6px">${I('cloud', 18)}${o.locked ? 'View only' : 'Saved 14:32'}</span><span class="sep"></span>
  <span class="ib sm ${o.locked ? 'dim' : ''}">${I('undo', 20)}</span><span class="ib sm" style="opacity:.45">${I('redo', 20)}</span><span class="sep"></span>
  <span class="tb2 dd ${o.resizeOn ? 'on' : ''} ${o.locked ? 'dim' : ''}">${I('resize', 16)}${o.aspect ?? '4:5 Portrait'} ${I('down', 14)}</span>
  <div style="margin-left:auto" class="row">${o.people ? `${stack(o.people, 32)}` : ''}${o.locked
    ? `<span class="b sm dis">Save draft</span>${o.owner ? `<span class="b sm p">${I('upload', 16)}Publish ${I('down', 14)}</span>` : `<span class="b sm dis" title="Only the owner can publish">Publish ${I('down', 14)}</span>`}`
    : `<span class="b sm g">${I('present', 16)}Preview</span><span class="b sm ${o.shareOn ? 'p' : 'o'}">${I('users', 16)}Share</span><span class="b sm">Save draft</span><span class="b sm p">${I('upload', 16)}Publish</span>`}</div></div>`;
export const erail = (on, dim) => `<div class="erail">${ERAIL.map(([n, ic]) => `<div class="er ${n === on ? 'on' : ''} ${dim ? 'dim' : ''}">${I(ic, 22)}${n}</div>`).join('')}</div>`;
export const ebottom = (o = {}) => {
  const a = o.aspect ?? '4:5';
  const [tw, th] = a === '16:9' ? [128, 72] : a === '9:16' ? [41, 72] : [58, 72];
  const kinds = o.thumbs ?? ['cover:Normalisation, 1NF to 3NF', 'norm', 'blank', 'blank', 'blank', 'blank'];
  return `<div class="ebot" style="left:${o.left ?? 416}px">${o.notes ? `<div style="padding:12px 20px 0;display:flex;flex-direction:column;gap:6px"><div class="row" style="justify-content:space-between"><b class="sm" style="font-size:13px">Page notes · slide 2</b><span class="muted sm">Only you see page notes</span></div><div class="in v ta" style="min-height:64px;background:#fff">${L(22)}</div></div>` : ''}
  <div class="thumbs">${kinds.map((k, i) => `<div class="thm ${i === (o.cur ?? 1) ? 'on' : ''}" style="width:${tw}px;height:${th}px">${k.startsWith('cover:') ? cover(k.slice(6), 'b', 'CT030-3-2') : slide(k, { aspect: a })}<span class="no">${i + 1}</span></div>`).join('')}
    ${o.locked ? '' : `<div class="addp" style="height:${th}px">${I('plus', 22)}</div><div class="addp" style="height:${th}px" title="Duplicate slide">${I('copy', 20)}</div>`}</div>
  <div class="stbar"><span class="b sm g" style="${o.notes ? 'background:var(--s2)' : ''}">${I('notes', 16)}Notes</span><span class="muted">${o.locked ? 'Read only' : 'Drag thumbnails to reorder'}</span>
    <div style="margin-left:auto" class="row"><span>Slide ${(o.cur ?? 1) + 1} of ${kinds.length}</span><span class="sep"></span><div class="zoom"></div><span>${o.zoom ?? '64%'}</span><span class="ib sm">${I('gridI', 18)}</span><span class="ib sm">${I('resize', 18)}</span></div></div></div>`;
};
export const selBox = (x, y, w, h, o = {}) => `<div class="sel" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:4;pointer-events:none">
  ${[[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => `<span class="hd" style="left:${a * w - 6 + (a ? 2 : -2)}px;top:${b * h - 6 + (b ? 2 : -2)}px"></span>`).join('')}
  <span class="hd e" style="left:-6px;top:${h / 2 - 9}px"></span><span class="hd e" style="left:${w - 2}px;top:${h / 2 - 9}px"></span>
  ${o.vh ? `<span class="hd n" style="left:${w / 2 - 9}px;top:-6px"></span><span class="hd n" style="left:${w / 2 - 9}px;top:${h - 2}px"></span>` : ''}
  <span class="rot" style="left:${w / 2 - 13}px;top:${h + 14}px">${I('rotate', 14)}</span></div>`;
export const editor = (o) => {
  const panelW = o.panel === false ? 0 : 340;
  const left = 76 + panelW;
  return `<div class="full">${ebar(o.bar)}${erail(o.rail, o.dimRail)}${o.panel === false ? '' : `<div class="epan">${o.panel}</div>`}
    <div class="ws" style="left:${left}px">${o.ctx ? `<div class="ctx" style="${o.ctxStyle || ''}">${o.ctx}</div>` : ''}${o.board}</div>${ebottom({ left, ...(o.bottom || {}) })}${o.over || ''}</div>`;
};
export const EW = 1440 - 416, EH = 900 - 56 - 144; // workspace size with panel open
export const boardAt = (w, h, inner, o = {}) => {
  const ws = o.wsW ?? EW, wh = o.wsH ?? EH, top = o.top ?? 72;
  const x = Math.round((ws - w) / 2), y = Math.round(top + (wh - top - h) / 2);
  return { x, y, html: `<div class="board" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${inner}</div>` };
};
export const searchIn = (t) => `<div class="in" style="height:40px;border-radius:999px">${I('search', 18)}${t}</div>`;

/* ------------------------------------------------------------------ dialogs + rows */
export const dlg = (w, h2, body, acts, o = {}) => `<div class="scrim" style="${o.scrimStyle || ''}"><div class="dlg" style="width:${w}px">${o.icon || ''}<h2>${h2}</h2><span class="ib x">${I('x', 20)}</span>${body}${acts ? `<div class="acts">${acts}</div>` : ''}</div></div>`;
export const nrow = (a, dark, txt, time, end, o = {}) => `<div class="li" style="padding:10px 8px;align-items:flex-start;${o.bg ? 'background:var(--s1)' : ''}">${o.icon ? `<div style="width:44px;height:44px;border-radius:50%;background:var(--s2);display:grid;place-items:center;flex:none">${I(o.icon, 22)}</div>` : av(a, 44, dark)}<div class="t" style="font-size:14px;line-height:1.4">${txt}<div class="muted sm" style="margin-top:2px">${time}</div>${o.below || ''}</div>${end || ''}</div>`;
export const nthumb = (k) => `<div style="width:44px;height:56px;border-radius:6px;overflow:hidden;flex:none;box-shadow:0 0 0 1px var(--s3)">${cover(COVERS[k][0], COVERS[k][1], '')}</div>`;
export const notifDrawer = (rows, chipOn = 'All') => `<div style="width:440px;flex:none;background:#fff;box-shadow:inset -1px 0 0 var(--line);z-index:4;display:flex;flex-direction:column;padding:20px 16px 0;gap:12px">
    <div class="row" style="justify-content:space-between;padding:0 8px"><b style="font-size:22px;letter-spacing:-.02em">Notifications</b><span class="ib sm">${I('x', 20)}</span></div>
    <div class="row" style="gap:6px;flex-wrap:wrap;padding:0 8px">${['All', 'Mentions', 'Follows', 'Super Likes', 'Requests', 'System'].map((t) => `<span class="chip ${t === chipOn ? 'on' : ''}">${t}</span>`).join('')}</div>${rows}</div>`;
export const profileHead = (o) => `<div style="display:flex;gap:28px;align-items:flex-start;padding:0 48px">
  ${av(o.i, 128, o.dark)}<div style="display:flex;flex-direction:column;gap:10px;padding-top:6px;flex:1">
    <div class="row" style="gap:10px;align-items:baseline"><span style="font-size:28px;font-weight:700;letter-spacing:-.03em">${o.n}</span>${o.lect ? VB(false, 22) : ''}<span class="muted" style="font-size:16px;font-weight:600">${o.h}</span></div>
    <div style="font-size:15px;color:var(--ink2)">${o.prog}</div>
    <div class="row" style="gap:10px">${o.btns}</div>
    <div class="row" style="gap:22px;font-size:15px"><span><b style="font-size:17px">${o.c[0]}</b> <span class="muted">Following</span></span><span><b style="font-size:17px">${o.c[1]}</b> <span class="muted">Followers</span></span><span><b style="font-size:17px">${o.c[2]}</b> <span class="muted">Likes</span></span></div>
    <div style="font-size:15px;max-width:560px;line-height:1.45;color:var(--ink2)">${o.bio}</div></div></div>`;
export const person = (i, n, s, st, dark, lect) => `<div class="li" style="background:var(--s1);padding:14px;flex:1">${av(i, 52, dark)}<div class="t"><div class="n">${n}${lect ? VB(false, 15) : ''}</div><div class="s">${s}</div></div><span class="b sm ${st === 'Follow' ? 'p' : ''}">${st}</span></div>`;
export const searchTop = (q) => `<div class="in v" style="width:520px;height:44px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 2px var(--ink)">${I('search', 18)}${q}<span class="end muted">${I('x', 16)}</span></div>`;
export const filterBar = (open) => `<div class="row" style="gap:8px;flex-wrap:wrap"><span class="chip ${open ? 'on' : 'o'}">${I('filter', 15)}Filters 2</span><span class="chip on">${I('check', 14)}Lecturer content</span><span class="chip o">Lecturer: any ${I('down', 13)}</span><span class="chip on">Semester 1, 2026/27 ${I('down', 13)}</span><span class="chip o">${I('cal', 14)}Any date</span><span class="chip o">Module: any ${I('down', 13)}</span><span class="muted sm" style="margin-left:auto">48 results · 0.21 s</span></div>`;
