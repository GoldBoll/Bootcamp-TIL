#!/usr/bin/env node
// ============================================================================
// build-interview-viewer.mjs — CS 모의면접 뷰어 제너레이터 (외부 의존성 0)
//
// 사용법 — md를 고친 뒤 이 스크립트만 재실행하면 뷰어가 다시 생성된다:
//   node tools/build-interview-viewer.mjs
//
// 입력:
//   raw/cs-notion/CS_면접_요약본.md   요약본(43주제) → 메인 카드
//   raw/cs-notion/*.md               나머지 원본 전부 → 뷰어에 임베드
// 출력:
//   raw/cs-notion/interview-viewer.html  자체완결 1파일 (브라우저로 열면 끝)
//
// 뷰어 기능:
//   - 실시간 검색(한글 부분일치 + 매칭 하이라이트), `/` = 검색 포커스
//   - 좌측 도메인 트리 → 카드 점프, 카드 안 🔗연관/NN_*.md#앵커 → 임베드된
//     원본 섹션 오버레이로 뷰어 내 점프 (외부 파일 이동 없음)
//   - 🎤 모의면접 모드: 답 가림 → 카드 클릭 개별 공개, 🎲 랜덤 문제
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'raw', 'cs-notion');
const SUMMARY_NAME = 'CS_면접_요약본.md';
const OUT_PATH = path.join(SRC_DIR, 'interview-viewer.html');

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------
const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 헤딩 텍스트에서 인라인 md 표기 제거 (슬러그·네비 라벨용)
const stripInlineMd = (s) =>
  s
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    .replace(/\*\*/g, '');

// GitHub 스타일 슬러그: 소문자화, 문자·숫자·_·-만 유지, 공백→하이픈
function githubSlug(text) {
  let out = '';
  for (const ch of stripInlineMd(text).trim().toLowerCase()) {
    if (/[\p{L}\p{N}_-]/u.test(ch)) out += ch;
    else if (ch === ' ') out += '-';
  }
  return out;
}

// 앵커 표기 편차(·, 하이픈 위치 등) 흡수용 정규화 키: 문자·숫자만 남김
const canonKey = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// ---------------------------------------------------------------------------
// 1) 원본 파일 로드 + 헤딩 레지스트리 (pass 1)
// ---------------------------------------------------------------------------
const stats = {
  resolved: 0,      // 앵커까지 해석된 링크
  fileTop: 0,       // 파일은 찾았지만 앵커 미해석 → 파일 상단 폴백
  fallbackList: [], // 폴백된 file#anchor 목록
  deadFile: [],     // 대상 파일 자체가 없는 링크
  external: 0,      // http(s) 외부 링크
};

const allMd = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.md'));
if (!allMd.includes(SUMMARY_NAME)) {
  console.error(`✖ ${SUMMARY_NAME} 이(가) ${SRC_DIR} 에 없습니다.`);
  process.exit(1);
}
const embedNames = allMd.filter((f) => f !== SUMMARY_NAME).sort();

// filename → {id, name, lines, headings, slugToDom, canonToDom, html}
const registry = new Map();

for (const name of embedNames) {
  const lines = fs.readFileSync(path.join(SRC_DIR, name), 'utf8').split(/\r?\n/);
  const id = name.replace(/\.md$/, '').replace(/[^\w가-힣]/gu, '_');
  const file = { id, name, lines, headings: [], slugToDom: new Map(), canonToDom: new Map(), html: '' };

  // 헤딩 수집 (코드펜스 내부 제외), 중복 슬러그는 -1, -2 …
  const dup = new Map();
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (!m) continue;
    let slug = githubSlug(m[2]);
    const n = dup.get(slug) || 0;
    dup.set(slug, n + 1);
    if (n > 0) slug = `${slug}-${n}`;
    const domId = `f-${id}--${slug}`;
    file.headings.push({ level: m[1].length, raw: m[2], slug, domId });
    file.slugToDom.set(slug, domId);
    const ck = canonKey(slug);
    if (!file.canonToDom.has(ck)) file.canonToDom.set(ck, domId);
  }
  registry.set(name, file);
}

// ---------------------------------------------------------------------------
// 2) 링크 해석
// ---------------------------------------------------------------------------
// ctx: { file: 현재 렌더 중인 원본 파일(없으면 요약본 컨텍스트) }
function makeLink(innerHtml, rawUrl, ctx) {
  const url = rawUrl.trim();
  if (/^https?:\/\//i.test(url)) {
    stats.external++;
    return `<a class="ext" href="${url}" target="_blank" rel="noopener">${innerHtml}</a>`;
  }
  let fileName = '';
  let anchor = '';
  if (url.startsWith('#')) {
    if (!ctx.file) return `<span class="dead">${innerHtml}</span>`; // 요약본 내부 앵커(도메인 지도 등)는 미사용
    fileName = ctx.file.name;
    anchor = url.slice(1);
  } else {
    const hash = url.indexOf('#');
    fileName = hash < 0 ? url : url.slice(0, hash);
    anchor = hash < 0 ? '' : url.slice(hash + 1);
    try { fileName = decodeURIComponent(fileName); anchor = decodeURIComponent(anchor); } catch { /* 그대로 사용 */ }
    fileName = fileName.replace(/^\.\//, ''); // ./NN_x.md 상대 표기 정규화
  }
  const target = registry.get(fileName);
  if (!target) {
    stats.deadFile.push(url);
    return `<span class="dead" title="원본 없음: ${escapeHtml(url)}">${innerHtml}</span>`;
  }
  let domId = '';
  if (anchor) {
    domId = target.slugToDom.get(anchor) || target.canonToDom.get(canonKey(anchor)) || '';
    if (domId) stats.resolved++;
    else { stats.fileTop++; stats.fallbackList.push(`${fileName}#${anchor}`); }
  } else {
    stats.resolved++;
  }
  return `<a class="jump" href="#" data-file="${target.id}" data-target="${domId}">${innerHtml}</a>`;
}

// ---------------------------------------------------------------------------
// 3) 인라인 마크다운 렌더러 (코드스팬 → 링크 → 볼드; *이탤릭은 C++ 오염 방지로 미지원)
// ---------------------------------------------------------------------------
function renderInline(text, ctx) {
  let s = escapeHtml(text);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${c}</code>`);
    return `${codes.length - 1}`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) => {
    const inner = txt.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return makeLink(inner, url, ctx);
  });
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return s.replace(/(\d+)/g, (_, i) => codes[+i]);
}

// ---------------------------------------------------------------------------
// 4) 블록 마크다운 렌더러
//    지원: 헤딩/코드펜스/표/중첩 리스트(ul·ol)/인용/hr/문단
// ---------------------------------------------------------------------------
function renderBlocks(lines, ctx, withHeadingIds) {
  const out = [];
  const listStack = []; // {tag, liOpen}
  let para = [];
  let quote = [];
  let inFence = false;
  let fenceLang = '';
  let fenceBuf = [];
  // withHeadingIds일 때 pass1과 동일한 순서·규칙으로 id 재계산
  const dup = new Map();
  const idFor = (rawText) => {
    let slug = githubSlug(rawText);
    const n = dup.get(slug) || 0;
    dup.set(slug, n + 1);
    if (n > 0) slug = `${slug}-${n}`;
    return `f-${ctx.file.id}--${slug}`;
  };

  const flushPara = () => {
    if (para.length) { out.push(`<p>${renderInline(para.join(' '), ctx)}</p>`); para = []; }
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push(`<blockquote>${quote.map((q) => `<p>${renderInline(q, ctx)}</p>`).join('')}</blockquote>`);
      quote = [];
    }
  };
  const closeOneList = () => {
    const l = listStack.pop();
    if (l.liOpen) out.push('</li>');
    out.push(`</${l.tag}>`);
  };
  const closeAllLists = () => { while (listStack.length) closeOneList(); };
  const closeBlocks = () => { flushPara(); flushQuote(); closeAllLists(); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inFence) {
      if (/^```\s*$/.test(line)) {
        out.push(`<pre><code${fenceLang ? ` class="lang-${escapeHtml(fenceLang)}"` : ''}>${escapeHtml(fenceBuf.join('\n'))}</code></pre>`);
        inFence = false; fenceBuf = [];
      } else fenceBuf.push(line);
      continue;
    }
    const fence = line.match(/^```(.*)$/);
    if (fence) { closeBlocks(); inFence = true; fenceLang = fence[1].trim(); fenceBuf = []; continue; }

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      closeBlocks();
      const lv = h[1].length;
      const idAttr = withHeadingIds ? ` id="${idFor(h[2])}"` : '';
      out.push(`<h${lv}${idAttr}>${renderInline(h[2], ctx)}</h${lv}>`);
      continue;
    }

    if (/^\s*-{3,}\s*$/.test(line)) { closeBlocks(); out.push('<hr>'); continue; }

    const bq = line.match(/^>\s?(.*)$/);
    if (bq) { flushPara(); closeAllLists(); quote.push(bq[1]); continue; }
    flushQuote();

    // 표: |로 시작 + 다음 줄이 구분선
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      closeBlocks();
      const rows = [];
      let j = i;
      while (j < lines.length && /^\s*\|/.test(lines[j])) { rows.push(lines[j]); j++; }
      i = j - 1;
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => renderInline(c.trim(), ctx));
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push('<div class="tbl"><table><thead><tr>' + head.map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
        body.map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }

    const li = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      flushPara();
      const depth = Math.min(Math.floor(li[1].length / 2), 5);
      const tag = /\d/.test(li[2][0]) ? 'ol' : 'ul';
      while (listStack.length > depth + 1) closeOneList();
      if (listStack.length === depth + 1 && listStack[listStack.length - 1].tag !== tag) closeOneList();
      while (listStack.length < depth + 1) { out.push(`<${tag}>`); listStack.push({ tag, liOpen: false }); }
      const top = listStack[listStack.length - 1];
      if (top.liOpen) out.push('</li>');
      out.push(`<li>${renderInline(li[3], ctx)}`);
      top.liOpen = true;
      continue;
    }

    if (!line.trim()) { flushPara(); continue; } // 빈 줄: 문단 종료 (리스트는 유지)

    // 리스트 항목의 연속 줄
    if (listStack.length && /^\s+\S/.test(line)) { out.push(' ' + renderInline(line.trim(), ctx)); continue; }

    closeAllLists();
    para.push(line.trim());
  }
  closeBlocks();
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// 5) 원본 파일 렌더 (pass 2)
// ---------------------------------------------------------------------------
for (const file of registry.values()) {
  file.html = renderBlocks(file.lines, { file }, true);
}
const totalSections = [...registry.values()].reduce((n, f) => n + f.headings.length, 0);

// ---------------------------------------------------------------------------
// 6) 요약본 파싱 → 도메인/주제/색인 섹션
// ---------------------------------------------------------------------------
const summaryLines = fs.readFileSync(path.join(SRC_DIR, SUMMARY_NAME), 'utf8').split(/\r?\n/);
const domains = []; // {num, title, topics:[{num, title, file, bullets:[]}]}
const extras = [];  // {title, lines:[]}
{
  let mode = '';
  let topic = null;
  for (const line of summaryLines) {
    const dom = line.match(/^## (\d+)\.\s*(.+)$/);
    if (dom) { domains.push({ num: dom[1], title: dom[2], topics: [] }); mode = 'domain'; topic = null; continue; }
    const ex = line.match(/^## (.+)$/);
    if (ex) { extras.push({ title: ex[1], lines: [] }); mode = 'extra'; topic = null; continue; }
    if (mode === 'domain') {
      const t = line.match(/^### \[(\d+)\.\s*([^\]]+)\]\(([^)]+)\)/);
      if (t) {
        topic = { num: t[1], title: t[2], file: t[3].split('#')[0], bullets: [] };
        domains[domains.length - 1].topics.push(topic);
        continue;
      }
      const b = line.match(/^- (.*)$/);
      if (b && topic) { topic.bullets.push(b[1]); continue; }
      if (topic && topic.bullets.length && /^\s+\S/.test(line)) {
        topic.bullets[topic.bullets.length - 1] += ' ' + line.trim();
      }
    } else if (mode === 'extra') {
      extras[extras.length - 1].lines.push(line);
    }
  }
  // 색인 섹션 꼬리의 빈 줄·hr 제거
  for (const e of extras) {
    while (e.lines.length && (/^\s*$/.test(e.lines[e.lines.length - 1]) || /^\s*-{3,}\s*$/.test(e.lines[e.lines.length - 1]))) e.lines.pop();
  }
}
const topicCount = domains.reduce((n, d) => n + d.topics.length, 0);

// ---------------------------------------------------------------------------
// 7) 메인 카드 HTML
// ---------------------------------------------------------------------------
const sumCtx = { file: null };
function topicCard(t) {
  const src = registry.get(t.file);
  const srcBtn = src
    ? `<a class="jump srcbtn" href="#" data-file="${src.id}" data-target="" title="${escapeHtml(t.file)} 원본 열기">원본 ↗</a>`
    : '';
  const facts = [];
  const rels = [];
  for (const b of t.bullets) (b.startsWith('🔗') ? rels : facts).push(b);
  return `<article class="card topic" id="t${t.num}">
<header class="card-head"><span class="num">${t.num}</span><h3>${renderInline(t.title, sumCtx)}</h3>${srcBtn}</header>
<div class="card-body">
<ul class="facts">${facts.map((b) => `<li>${renderInline(b, sumCtx)}</li>`).join('\n')}</ul>
${rels.map((b) => `<div class="rel">${renderInline(b, sumCtx)}</div>`).join('\n')}
</div>
</article>`;
}

const mainHtml = [
  ...domains.map((d) => `<section class="dblock" id="d${d.num}">
<h2 class="dtitle">${renderInline(d.title, sumCtx)}</h2>
${d.topics.map(topicCard).join('\n')}
</section>`),
  ...extras.map((e, i) => `<section class="dblock" id="dx${i}">
<article class="card extra" id="extra-${i}">
<header class="card-head"><h3>${renderInline(e.title, sumCtx)}</h3></header>
<div class="card-body">${renderBlocks(e.lines, sumCtx, false)}</div>
</article>
</section>`),
].join('\n');

// ---------------------------------------------------------------------------
// 8) 사이드바 + 오버레이(임베드 원본)
// ---------------------------------------------------------------------------
const navLabel = (s, max = 26) => {
  const t = stripInlineMd(s).trim();
  return escapeHtml(t.length > max ? t.slice(0, max) + '…' : t);
};
const sideHtml = [
  ...domains.map((d) => `<div class="sgroup">
<div class="sgh">${navLabel(d.title, 40)}<em>${d.topics.length}</em></div>
${d.topics.map((t) => `<a class="sitem" href="#" data-card="t${t.num}"><b>${t.num}</b>${navLabel(t.title)}</a>`).join('\n')}
</div>`),
  `<div class="sgroup"><div class="sgh">색인</div>
${extras.map((e, i) => `<a class="sitem" href="#" data-card="extra-${i}">${navLabel(e.title, 30)}</a>`).join('\n')}
</div>`,
].join('\n');

const overlayFiles = [...registry.values()]
  .map((f) => `<section class="srcfile" id="f-${f.id}" hidden>${f.html}</section>`)
  .join('\n');

const fileNamesJson = JSON.stringify(Object.fromEntries([...registry.values()].map((f) => [f.id, f.name]))).replace(/</g, '\\u003c');

// ---------------------------------------------------------------------------
// 9) CSS (다크+골드 디자인 토큰)
// ---------------------------------------------------------------------------
const css = `
:root{--bg:#1b1b1e;--card:#242428;--ink:#e6e1d7;--gold:#e8b931;--muted:#a9a49a;--line:rgba(230,225,215,.09);--codebg:#17171a}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 -apple-system,'Segoe UI','Malgun Gothic','Apple SD Gothic Neo',sans-serif}
body.lock{overflow:hidden}
a{color:var(--gold)}
code{background:var(--codebg);border:1px solid var(--line);border-radius:4px;padding:.08em .35em;font:.88em Consolas,'D2Coding',monospace}
pre{background:var(--codebg);border:1px solid var(--line);border-radius:8px;padding:12px 14px;overflow-x:auto}
pre code{background:none;border:0;padding:0;font-size:13px;line-height:1.55}
mark{background:var(--gold);color:#1b1b1e;border-radius:2px;padding:0 1px}
hr{border:0;border-top:1px solid var(--line);margin:20px 0}
blockquote{margin:10px 0;padding:6px 14px;border-left:3px solid var(--gold);background:rgba(232,185,49,.05);color:var(--muted);border-radius:0 6px 6px 0}
blockquote p{margin:4px 0}
.tbl{overflow-x:auto;margin:10px 0}
table{border-collapse:collapse;font-size:14px;min-width:50%}
th,td{border:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top}
th{color:var(--gold);background:rgba(232,185,49,.06);white-space:nowrap}
/* 헤더 */
#top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:10px;padding:10px 16px;background:rgba(27,27,30,.92);backdrop-filter:blur(6px);border-bottom:1px solid var(--line)}
.brand{font-weight:700;font-size:16px;white-space:nowrap}
.brand span{color:var(--gold);font-size:12px;margin-left:4px}
#q{flex:1;min-width:120px;max-width:520px;background:var(--card);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:8px 12px;font-size:14px;outline:none}
#q:focus{border-color:var(--gold)}
#qcount{color:var(--muted);font-size:12px;min-width:34px}
#top button{background:var(--card);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:8px 13px;font-size:13px;cursor:pointer;white-space:nowrap}
#top button:hover{border-color:var(--gold)}
#top button.on{background:var(--gold);color:#1b1b1e;font-weight:700;border-color:var(--gold)}
/* 레이아웃 */
#wrap{display:flex;max-width:1280px;margin:0 auto;gap:20px;padding:0 16px}
#side{width:270px;flex:none;position:sticky;top:57px;height:calc(100vh - 57px);overflow-y:auto;padding:14px 4px 40px 0;font-size:13px}
#side::-webkit-scrollbar{width:8px}
#side::-webkit-scrollbar-thumb{background:var(--card);border-radius:4px}
.sgroup{margin-bottom:14px}
.sgh{color:var(--gold);font-weight:700;padding:4px 8px;font-size:12.5px;letter-spacing:.02em}
.sgh em{font-style:normal;color:var(--muted);font-weight:400;margin-left:5px}
.sitem{display:flex;gap:7px;align-items:baseline;color:var(--ink);text-decoration:none;padding:3px 8px;border-radius:6px;line-height:1.45}
.sitem:hover{background:var(--card);color:var(--gold)}
.sitem b{color:var(--muted);font-weight:600;font-size:11px;flex:none}
#main{flex:1;min-width:0;padding:16px 0 80px}
.dtitle{color:var(--gold);font-size:19px;margin:30px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.dblock:first-child .dtitle{margin-top:10px}
/* 카드 */
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-bottom:14px;scroll-margin-top:70px;outline:2px solid transparent}
.card-head{display:flex;align-items:baseline;gap:10px}
.card-head h3{margin:0;font-size:16.5px;flex:1}
.num{color:var(--gold);font-weight:800;font-size:13px;background:rgba(232,185,49,.1);border-radius:6px;padding:2px 7px;flex:none}
.srcbtn{font-size:12px;text-decoration:none;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:2px 8px;flex:none}
.srcbtn:hover{color:var(--gold);border-color:var(--gold)}
.facts{margin:10px 0 0;padding-left:20px}
.facts li{margin:5px 0}
.rel{margin-top:9px;padding-top:8px;border-top:1px dashed var(--line);font-size:13.5px;color:var(--muted)}
a.jump{color:var(--gold);text-decoration:none;border-bottom:1px dotted rgba(232,185,49,.5)}
a.jump:hover{border-bottom-style:solid}
.dead{color:var(--muted);border-bottom:1px dotted var(--muted)}
.card.extra .card-body{font-size:14px}
.card.extra h3{font-size:16.5px}
.card.extra .card-body h3,.card.extra .card-body h4{color:var(--gold);font-size:14.5px;margin:16px 0 6px}
/* 모의면접 모드 */
body.quiz .topic{cursor:pointer}
body.quiz .topic .card-body{display:none}
body.quiz .topic.revealed .card-body{display:block}
body.quiz .topic.revealed{cursor:default}
body.quiz .topic:not(.revealed) .card-head::after{content:'🎤 클릭하면 답 공개';color:var(--muted);font-size:12px;flex:none}
body.quiz .topic:not(.revealed) .srcbtn{display:none}
/* 점프 플래시 */
.flash{animation:flash 1.6s ease-out}
@keyframes flash{0%{outline-color:var(--gold)}100%{outline-color:transparent}}
/* 오버레이(임베드 원본) */
#ov{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.62)}
#ovp{position:absolute;inset:3vh 0;margin:0 auto;max-width:900px;width:calc(100% - 32px);background:#202024;border:1px solid var(--line);border-radius:14px;display:flex;flex-direction:column;overflow:hidden}
#ovh{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);background:rgba(232,185,49,.05)}
#ovh button{background:none;border:1px solid var(--line);border-radius:7px;color:var(--ink);padding:4px 11px;cursor:pointer;font-size:13px}
#ovh button:hover{border-color:var(--gold);color:var(--gold)}
#ovtitle{flex:1;font-weight:700;font-size:14px;color:var(--gold);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ovbody{flex:1;overflow-y:auto;padding:8px 26px 60px}
#ovbody h1{font-size:20px;color:var(--gold)}
#ovbody h2{font-size:17.5px;color:var(--gold);margin-top:30px;padding-bottom:5px;border-bottom:1px solid var(--line);scroll-margin-top:10px}
#ovbody h3{font-size:15.5px;margin-top:24px;scroll-margin-top:10px}
#ovbody h4,#ovbody h5{font-size:14.5px;scroll-margin-top:10px}
#ovbody h1,#ovbody h2,#ovbody h3,#ovbody h4{outline:2px solid transparent;border-radius:4px}
@media(max-width:900px){#side{display:none}#wrap{padding:0 12px}.brand span{display:none}}
`;

// ---------------------------------------------------------------------------
// 10) 클라이언트 JS
// ---------------------------------------------------------------------------
const clientJs = `
(function(){
var q=document.getElementById('q'),qc=document.getElementById('qcount');
var quizBtn=document.getElementById('quiz'),randBtn=document.getElementById('rand');
var ov=document.getElementById('ov'),ovBody=document.getElementById('ovbody'),ovTitle=document.getElementById('ovtitle');
var FILE_NAMES=__FILE_NAMES__;
var topics=[].slice.call(document.querySelectorAll('#main .topic'));
var cards=[].slice.call(document.querySelectorAll('#main .card'));
var blocks=[].slice.call(document.querySelectorAll('#main .dblock'));
var texts=new Map();cards.forEach(function(c){texts.set(c,c.textContent.toLowerCase());});
var hist=[];

function flash(el){el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');}

/* ---- 오버레이: 임베드 원본 점프 ---- */
function openSrc(fid,tid,noPush){
  var sec=document.getElementById('f-'+fid);
  if(!sec)return;
  var secs=ovBody.children;
  for(var i=0;i<secs.length;i++)secs[i].hidden=(secs[i]!==sec);
  ovTitle.textContent=FILE_NAMES[fid]||fid;
  if(ov.hidden){ov.hidden=false;document.body.classList.add('lock');}
  if(!noPush)hist.push({f:fid,t:tid||''});
  requestAnimationFrame(function(){
    var el=tid?document.getElementById(tid):null;
    if(el){el.scrollIntoView({block:'start'});flash(el);}
    else ovBody.scrollTop=0;
  });
}
function closeOv(){ov.hidden=true;hist=[];document.body.classList.remove('lock');}
function goBack(){
  if(hist.length<2){closeOv();return;}
  hist.pop();
  var p=hist[hist.length-1];
  openSrc(p.f,p.t,true);
}
document.getElementById('ovx').addEventListener('click',closeOv);
document.getElementById('ovback').addEventListener('click',goBack);
ov.addEventListener('click',function(e){if(e.target===ov)closeOv();});

/* ---- 카드 점프 ---- */
function goCard(id){
  var c=document.getElementById(id);
  if(!c)return;
  if(!ov.hidden)closeOv();
  if(c.hidden){q.value='';applyFilter();}
  c.scrollIntoView({behavior:'smooth',block:'start'});
  flash(c);
}

/* ---- 클릭 위임 ---- */
document.addEventListener('click',function(e){
  var j=e.target.closest?e.target.closest('a.jump'):null;
  if(j){e.preventDefault();openSrc(j.getAttribute('data-file'),j.getAttribute('data-target'));return;}
  var s=e.target.closest?e.target.closest('[data-card]'):null;
  if(s){e.preventDefault();goCard(s.getAttribute('data-card'));return;}
  if(document.body.classList.contains('quiz')){
    var card=e.target.closest?e.target.closest('.topic'):null;
    if(card&&!e.target.closest('a,button'))card.classList.toggle('revealed');
  }
});

/* ---- 검색: 필터 + 하이라이트 ---- */
function clearMarks(){
  var ms=[].slice.call(document.querySelectorAll('#main mark'));
  ms.forEach(function(m){m.replaceWith(document.createTextNode(m.textContent));});
}
function markCard(card,s){
  var w=document.createTreeWalker(card,NodeFilter.SHOW_TEXT),nodes=[];
  while(w.nextNode())nodes.push(w.currentNode);
  nodes.forEach(function(n){
    var t=n.nodeValue,lt=t.toLowerCase(),i=lt.indexOf(s);
    if(i<0)return;
    var frag=document.createDocumentFragment(),last=0;
    while(i>=0){
      frag.appendChild(document.createTextNode(t.slice(last,i)));
      var m=document.createElement('mark');
      m.textContent=t.slice(i,i+s.length);
      frag.appendChild(m);
      last=i+s.length;i=lt.indexOf(s,last);
    }
    frag.appendChild(document.createTextNode(t.slice(last)));
    n.parentNode.replaceChild(frag,n);
  });
}
function applyFilter(){
  var s=q.value.trim().toLowerCase(),n=0;
  clearMarks();
  cards.forEach(function(c){
    var hit=!s||texts.get(c).indexOf(s)>=0;
    c.hidden=!hit;
    if(hit){n++;if(s)markCard(c,s);}
  });
  blocks.forEach(function(b){
    var any=[].slice.call(b.querySelectorAll('.card')).some(function(c){return !c.hidden;});
    b.hidden=!any;
  });
  qc.textContent=s?(n+'건'):'';
}
var deb;
q.addEventListener('input',function(){clearTimeout(deb);deb=setTimeout(applyFilter,80);});

/* ---- 모의면접 모드 + 랜덤 ---- */
function setQuiz(on){
  document.body.classList.toggle('quiz',on);
  quizBtn.classList.toggle('on',on);
  topics.forEach(function(t){t.classList.remove('revealed');});
}
quizBtn.addEventListener('click',function(){setQuiz(!document.body.classList.contains('quiz'));});
randBtn.addEventListener('click',function(){
  if(!document.body.classList.contains('quiz'))setQuiz(true);
  var t=topics[Math.floor(Math.random()*topics.length)];
  t.classList.remove('revealed');
  if(t.hidden){q.value='';applyFilter();}
  if(!ov.hidden)closeOv();
  t.scrollIntoView({behavior:'smooth',block:'center'});
  flash(t);
});

/* ---- 키보드: / 검색, Esc 닫기 ---- */
document.addEventListener('keydown',function(e){
  var tag=document.activeElement?document.activeElement.tagName:'';
  if(e.key==='/'&&tag!=='INPUT'&&tag!=='TEXTAREA'){e.preventDefault();q.focus();q.select();}
  else if(e.key==='Escape'){
    if(!ov.hidden)closeOv();
    else if(q.value||document.activeElement===q){q.value='';applyFilter();q.blur();}
  }
});
})();
`.replace('__FILE_NAMES__', fileNamesJson);

// ---------------------------------------------------------------------------
// 11) 최종 HTML 조립 + 쓰기
// ---------------------------------------------------------------------------
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CS 모의면접 뷰어</title>
<style>${css}</style>
</head>
<body>
<header id="top">
<div class="brand">💻 CS 모의면접<span>${topicCount}주제 · 원본 ${registry.size}파일 임베드</span></div>
<input id="q" type="search" placeholder="검색 — 제목·정의·연관 키워드 ( / )" autocomplete="off">
<span id="qcount"></span>
<button id="quiz" title="답을 가리고 카드 클릭으로 공개">🎤 모의면접</button>
<button id="rand" title="랜덤 주제로 점프 (답 가린 채)">🎲 랜덤</button>
</header>
<div id="wrap">
<nav id="side">
${sideHtml}
</nav>
<main id="main">
${mainHtml}
</main>
</div>
<div id="ov" hidden>
<div id="ovp">
<header id="ovh"><button id="ovback" title="이전 위치">←</button><span id="ovtitle"></span><button id="ovx" title="닫기 (Esc)">✕</button></header>
<div id="ovbody">
${overlayFiles}
</div>
</div>
</div>
<script>${clientJs}</script>
</body>
</html>
`;

fs.writeFileSync(OUT_PATH, html, 'utf8');

// ---------------------------------------------------------------------------
// 12) 빌드 리포트
// ---------------------------------------------------------------------------
const kb = (n) => (n / 1024 >= 1024 ? (n / 1048576).toFixed(2) + ' MB' : Math.round(n / 1024) + ' KB');
const size = fs.statSync(OUT_PATH).size;
console.log(`✔ 주제 카드: ${topicCount}개 (도메인 ${domains.length}개${domains.map((d) => ` · ${d.num}=${d.topics.length}`).join('')})`);
console.log(`✔ 색인 섹션: ${extras.length}개`);
console.log(`✔ 원본 임베드: ${registry.size}파일 / ${totalSections}섹션(헤딩)`);
console.log(`✔ 링크: 해석 ${stats.resolved} · 파일상단 폴백 ${stats.fileTop} · 원본없음 ${stats.deadFile.length} · 외부 ${stats.external}`);
if (stats.fallbackList.length) {
  console.log(`  ⚠ 앵커 미해석(파일 상단으로 폴백) 상위 ${Math.min(20, stats.fallbackList.length)}건:`);
  for (const f of stats.fallbackList.slice(0, 20)) console.log(`    - ${f}`);
}
if (stats.deadFile.length) console.log(`  ⚠ 대상 파일 없음: ${[...new Set(stats.deadFile)].join(', ')}`);
console.log(`✔ ${path.relative(ROOT, OUT_PATH)} (${kb(size)})`);
// 구조 검증: 주제 번호 중복 / 원본 파일 누락
{
  const nums = domains.flatMap((d) => d.topics.map((t) => t.num));
  const dupNums = nums.filter((n, i) => nums.indexOf(n) !== i);
  if (dupNums.length) console.log(`⚠ 주제 번호 중복: ${[...new Set(dupNums)].join(', ')}`);
  const noSrc = domains.flatMap((d) => d.topics).filter((t) => !registry.has(t.file));
  if (noSrc.length) console.log(`⚠ 원본 파일 없는 주제: ${noSrc.map((t) => `${t.num}(${t.file})`).join(', ')}`);
}
