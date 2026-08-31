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
//   raw/cs-notion/interview-viewer.html         자체완결 1파일 (브라우저로 열면 끝)
//   raw/cs-notion/interview-viewer.kwmap.json   키워드 사전 사이드카 [표면형, 링크수, 억제수]
//                                               — check-viewer-links.mjs 의 미링크 분류용
//
// 뷰어 기능:
//   - 실시간 랭킹 검색: 제목→연관→본문 순 정렬 + 원본 섹션(헤딩·섹션 본문) 별도 그룹,
//     조사·어간 완화 AND 매칭, 매칭 스니펫, Enter=첫 결과 점프, `/` = 포커스
//   - 좌측 도메인 트리 → 카드 점프, 카드 안 🔗연관/NN_*.md#앵커 → 임베드된
//     원본 섹션 오버레이로 뷰어 내 점프 (외부 파일 이동 없음)
//   - 키워드 순환 링크망: 주제 제목·연관 키워드·원본 헤딩·괄호 별칭으로 만든
//     사전을 카드 본문·임베드 원본에 자동 링크化(문단당 1회, 코드·기존 링크 제외)
//     → 키워드↔설명 무한 순환. 꼬리물기 브레드크럼(🧭)으로 경로 표시·되돌아가기
//   - 검색 즉답 패널: 최상위 결과의 정의 2~3줄을 검색창 바로 아래 즉시 표시
//   - 🎤 모의면접 모드: 답 가림 → 카드 클릭 개별 공개, 🎲 랜덤 문제
//   - 면접 실전 카드 순서(P13): ①정의(핵심 답변) 최상단 강조 → ②동작·차이·해결
//     → ③원본의 "학습 영역" 파생 블록은 하단 <details> 접힘 → ④🔗연관 맨 아래.
//     좌측 목차는 스크롤 스파이로 현재 카드 하이라이트
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { githubSlug, stripInlineMd } from './slug.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'raw', 'cs-notion');
const SUMMARY_NAME = 'CS_면접_요약본.md';
const OUT_PATH = path.join(SRC_DIR, 'interview-viewer.html');

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------
const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 헤딩 텍스트에서 인라인 md 표기 제거 (슬러그·네비 라벨용) · GitHub 슬러그
// 검사기들이 같은 규칙을 써야 한다 — 사본이 어긋나 오탐이 두 번 났다(tools/slug.mjs 머리말).

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

// "## 학습 영역 …" 파생 블록(P13): 면접 실전 순서상 핵심 답변보다 뒤 — 파일 끝으로
// 옮기고 마커 줄로 감싸 renderBlocks가 <details> 접힘으로 렌더한다(콘텐츠 삭제 없음).
// pass1(헤딩 수집)·pass2(렌더)가 같은 줄 배열을 보므로 앵커 id는 그대로 유지된다.
const STUDY_START = '\u0000study\u0000'; // 뒤에 한 줄 라벨
const STUDY_END = '\u0000/study\u0000';
const studyFiles = [];
function hoistStudySection(lines) {
  let inFence = false;
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s{0,7}```/.test(lines[i])) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (start < 0) {
      if (/^##\s+학습 영역/.test(lines[i])) start = i;
    } else if (/^#{1,2}\s/.test(lines[i])) { end = i; break; } // 다음 동급 헤딩 전까지
  }
  if (start < 0) return false;
  const chunk = lines.splice(start, end - start);
  // 블록 꼬리의 빈 줄·hr은 본문 구분선이므로 접힘 안에 넣지 않는다
  while (chunk.length && (/^\s*$/.test(chunk[chunk.length - 1]) || /^\s*-{3,}\s*$/.test(chunk[chunk.length - 1]))) chunk.pop();
  const label = stripInlineMd(chunk[0].replace(/^##\s+/, ''))
    .replace(/^학습 영역(?:\s*전환점)?\s*[—–-]*\s*/, '').trim();
  // 파일 꼬리가 열린 코드펜스면(19번: EOF 직전 고아 ``` 1개) 붙일 블록이 펜스에
  // 삼켜진다 — 꼬리의 고아 여는 펜스는 제거(렌더 출력 없음), 아니면 닫는 펜스 추가
  let open = false;
  for (const l of lines) if (/^\s{0,7}```/.test(l)) open = !open;
  if (open) {
    while (lines.length && /^\s*$/.test(lines[lines.length - 1])) lines.pop();
    if (/^\s{0,7}```/.test(lines[lines.length - 1])) lines.pop();
    else lines.push('```');
  }
  lines.push('', STUDY_START + (label || '학습 영역'), ...chunk, STUDY_END);
  return true;
}

// "## 꼬리질문 대비 — 답변 중 등장 용어 보충" 블록은 하단으로 옮겨 놨지만(2026-08-05) 여전히
// 소제목 없는 통짜다 — 31_socket 은 458줄이라 목차에 한 줄로만 잡히고 훑을 수가 없다.
// 옮기지 않고 그 자리에서 접기만 한다. 마커만 끼우면 renderBlocks 의 <details> 경로를 그대로 탄다.
// 앵커는 헤딩 줄이 접힘 안에 그대로 남으므로 안 바뀐다(목차 클릭 시 details 를 펴는 코드가 이미 있다).
function foldTailQaSection(lines) {
  let inFence = false, start = -1, end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s{0,7}```/.test(lines[i])) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (start < 0) { if (/^##\s+꼬리질문 대비/.test(lines[i])) start = i; }
    else if (/^#{1,2}\s/.test(lines[i])) { end = i; break; }
  }
  if (start < 0) return false;
  let last = end - 1;
  while (last > start && (/^\s*$/.test(lines[last]) || /^\s*-{3,}\s*$/.test(lines[last]))) last--;
  const label = stripInlineMd(lines[start].replace(/^##\s+/, ''))
    .replace(/^꼬리질문 대비\s*[—–-]*\s*/, '').trim();
  lines.splice(last + 1, 0, STUDY_END);
  lines.splice(start, 0, STUDY_START + (label || '답변 중 등장 용어 보충'));
  return true;
}

// filename → {id, name, lines, headings, slugToDom, canonToDom, html}
const registry = new Map();

for (const name of embedNames) {
  const lines = fs.readFileSync(path.join(SRC_DIR, name), 'utf8').split(/\r?\n/);
  if (hoistStudySection(lines)) studyFiles.push(name);
  foldTailQaSection(lines);
  const id = name.replace(/\.md$/, '').replace(/[^\w가-힣]/gu, '_');
  const file = { id, name, lines, headings: [], slugToDom: new Map(), canonToDom: new Map(), html: '' };

  // 헤딩 수집 (코드펜스 내부 제외), 중복 슬러그는 -1, -2 …
  // 헤딩 아래 산문(body)도 같이 모은다 — 검색 인덱스가 헤딩만 담으면 본문에만 있는
  // 키워드("생성자 호출 순서"·"DFS")가 아예 검색되지 않는다. 코드펜스는 제외.
  const dup = new Map();
  let inFence = false;
  let cur = null;
  for (const line of lines) {
    if (/^\s{0,7}```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (!m) {
      if (cur && line.trim() && !line.startsWith(STUDY_START) && line !== STUDY_END) cur.body.push(line);
      continue;
    }
    let slug = githubSlug(m[2]);
    const n = dup.get(slug) || 0;
    dup.set(slug, n + 1);
    if (n > 0) slug = `${slug}-${n}`;
    const domId = `f-${id}--${slug}`;
    cur = { level: m[1].length, raw: m[2], slug, domId, body: [] };
    file.headings.push(cur);
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
//    ctx.autoLink=true면 마지막에 키워드 자동 링크化 (헤딩 등은 noAuto로 제외)
// ---------------------------------------------------------------------------
function renderInline(text, ctx, noAuto) {
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
  if (!noAuto && ctx.autoLink) s = autoLink(s, ctx);
  return s.replace(/(\d+)/g, (_, i) => codes[+i]);
}

// ---------------------------------------------------------------------------
// 4) 블록 마크다운 렌더러
//    지원: 헤딩/코드펜스/표/중첩 리스트(ul·ol)/인용/hr/문단
// ---------------------------------------------------------------------------
// 4구획 헤딩 판정 — 헤딩 레벨은 파일마다 다르다(대부분 h3, CS_추가키워드_복습은 h4,
// 45_algo_*는 h2). 그래서 레벨이 아니라 **헤딩 텍스트 정확 일치**로만 잡는다.
// `## 차이점 비교표` 처럼 이름이 겹치는 개념 절은 구획이 아니다(_work/audit-cs-4구획.mjs와 같은 규칙).
// 래퍼 태그는 <div> 다 — check-viewer-links 가 파일별 산문을
//   /<section class="srcfile" ...>([\s\S]*?)<\/section>/ 논그리디로 자르기 때문에,
//   중첩 <section> 을 쓰면 파일 산문이 첫 </section> 에서 잘려 미링크 오탐이 난다.
const GU_CLASS = new Map([
  ['정의', 'gu-def'],
  ['차이점', 'gu-diff'],
  ['동작', 'gu-act'],
  ['활용·사용법', 'gu-use'],
  ['활용', 'gu-use'],
  // 문제·장애 개념(스택 오버플로·데드락·메모리 누수 …)은 `차이점`·`동작` 대신
  // **정의 → 원인 → 해결** 로 읽는 게 맞다(2026-08-06 사용자 지시).
  // 무엇과 다른가가 아니라 왜 생기고 어떻게 막는가가 그 개념의 뼈대이기 때문이다.
  ['원인', 'gu-cause'],
  ['해결', 'gu-fix'],
]);

function renderBlocks(lines, ctx, withHeadingIds) {
  const out = [];
  const listStack = []; // {tag, liOpen}
  let para = [];
  let quote = [];
  let inFence = false;
  let guOpen = null;   // 열려 있는 4구획 래퍼
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
    if (!para.length) return;
    // `모의면접 답변` 은 원본이 **한 줄에 한 문장**으로 쓰여 있다(구술용). 마크다운 기본대로
    // 이어 붙이면 대여섯 문장이 한 덩어리가 돼 읽기가 어렵다 — 그 절에서만 줄을 살린다.
    if (ctx.answerSec && para.length > 1) {
      for (const ln of para) out.push(`<p class="ansln">${renderInline(ln, ctx)}</p>`);
      para = [];
      return;
    }
    out.push(`<p>${renderInline(para.join(' '), ctx)}</p>`); para = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    // 인용 안의 코드펜스(`> ```cpp`). 본문 펜스 판정은 인용 접두사 `>` 를 못 지나치므로
    // 여기서 잡는다. 안 잡으면 코드가 산문으로 렌더되고 키워드 자동 링크까지 붙는다(실측 372펜스·848링크).
    let html = '', buf = null, lang = '';
    for (const q of quote) {
      const f = q.match(/^\s{0,7}```(.*)$/);
      if (f) {
        if (buf === null) { buf = []; lang = f[1].trim(); }
        else {
          html += `<pre><code${lang ? ` class="lang-${escapeHtml(lang)}"` : ''}>${escapeHtml(buf.join('\n'))}</code></pre>`;
          buf = null; lang = '';
        }
        continue;
      }
      if (buf !== null) buf.push(q);
      else html += `<p>${renderInline(q, ctx)}</p>`;
    }
    if (buf !== null) html += `<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`; // 짝 없는 펜스
    out.push(`<blockquote>${html}</blockquote>`);
    quote = [];
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

    // "학습 영역" 파생 블록 마커(P13) → 기본 접힘 <details> + 한 줄 라벨
    if (line.startsWith(STUDY_START)) {
      closeBlocks();
      if (guOpen) { out.push('</div>'); guOpen = null; }
      out.push(`<details class="study"><summary>▸ 심화: ${escapeHtml(line.slice(STUDY_START.length))}</summary><div class="study-body">`);
      continue;
    }
    if (line === STUDY_END) { closeBlocks(); if (guOpen) { out.push('</div>'); guOpen = null; } out.push('</div></details>'); continue; }

    if (inFence) {
      if (/^\s{0,7}```\s*$/.test(line)) {
        out.push(`<pre><code${fenceLang ? ` class="lang-${escapeHtml(fenceLang)}"` : ''}>${escapeHtml(fenceBuf.join('\n'))}</code></pre>`);
        inFence = false; fenceBuf = [];
      } else fenceBuf.push(line);
      continue;
    }
    const fence = line.match(/^\s{0,7}```(.*)$/);
    if (fence) { closeBlocks(); inFence = true; fenceLang = fence[1].trim(); fenceBuf = []; continue; }

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      closeBlocks();
      const lv = h[1].length;
      // 구획 블록 닫기 — 같은 레벨(다음 구획) 또는 더 상위 헤딩(다음 개념 절)을 만나면 끝.
      // 더 깊은 헤딩(5-1 같은 하위 절)은 그 구획 안에 그대로 남는다.
      if (guOpen && lv <= guOpen.lv) { out.push('</div>'); guOpen = null; }
      // 구획은 개념 절의 **직속 자식**만이다. 이미 열린 구획 안에서 더 깊은 레벨로 나오는
      // 같은 이름 헤딩(예: `### 동작` 안의 `#### 차이점`)은 그 구획의 하위 절이지 구획이 아니다.
      const cls = GU_CLASS.get(stripInlineMd(h[2]).trim());
      if (cls && !guOpen) { out.push(`<div class="gu ${cls}">`); guOpen = { lv }; }
      // 지금 렌더 중인 절이 `모의면접 답변` 인가 (flushPara 가 줄을 살릴지 판단한다)
      ctx.answerSec = /^모의면접 답변|^발표 답변/.test(stripInlineMd(h[2]).trim());
      // 현재 렌더 중인 절 — 자기 절로 가는 링크는 억제하고, 같은 파일 다른 절 링크는 절당 1회
      const hid = withHeadingIds ? idFor(h[2]) : '';
      if (hid) {
        ctx.curSec = hid; ctx.secUsed = new Set();
        // 조상 절 사슬 — 자기 절뿐 아니라 **자기를 품은 상위 절**로 가는 링크도 제자리 이동이다.
        // 이걸 안 보면 `### 정의` 안에서 그 위 `## 컴파일 타임 vs 런타임` 이나 문서 h1 로 가는
        // 링크가 통과해, 눌러도 화면이 거의 안 움직이는 링크가 생긴다.
        ctx.secChain = (ctx.secChain || []).filter((x) => x.lv < lv);
        ctx.secChain.push({ lv, id: hid });
      }
      const idAttr = hid ? ` id="${hid}"` : '';
      out.push(`<h${lv}${idAttr}>${renderInline(h[2], ctx, true)}</h${lv}>`);
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
      ctx.sharedUsed = new Set(); // 표 전체에서 키워드당 자동 링크 1회 (셀마다 반복 방지)
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      delete ctx.sharedUsed;
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
  if (guOpen) out.push('</div>');
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// 5) 요약본 파싱 → 도메인/주제/색인 섹션
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
// 6) 키워드 사전 — 주제 제목 + 🔗연관 키워드 + 원본 헤딩 + 괄호 병기 별칭
//    각 표면형(텍스트에서 찾을 문자열) → 정의 위치(주제 카드 or 원본 섹션) 매핑.
//    본문 자동 링크化 규칙: 최장 일치 우선, 코드·기존 링크 제외, 자기 문서 제외,
//    같은 문단 내 동일 키워드는 첫 1회만.
// ---------------------------------------------------------------------------
// 일반어·구조어 — 사전에 넣으면 온 문단이 링크로 오염되는 단어들 (canonKey 기준)
// 2자 라틴 약어 화이트리스트. 여기 없는 2자는 표면형이 되지 못한다.
// 뺀 것: RR·PI·GR·MD — 각각 error·/GR-·/MD 같은 조각에서 나온 가짜 약어였다(링크 1~4건).
const KW_ABBR2 = new Set(['GC', 'OS', 'IP', 'UB', 'UI', 'DP', 'L1', 'L2', 'L3', '3C']);
const KW_STOP = new Set([
  '목차', '개요', '요약', '정의', '정리', '결론', '비교', '예시', '예제', '함정', '해결', '핵심',
  '참고', '보강', '질문', '답변', '면접', '핵심 개념', '핵심 요약 카드', '모의면접 답변', '학습 영역',
  '꼬리질문', '꼬리질문 대비', '비교 테이블', '실무 사례', '동작', '원리', '구조', '종류', '특징',
  '차이', '차이점', '장점', '단점', '주의', '기타', '사례', '활용', '응용', '연결', '흐름', '확인',
  '기준', '상태', '상황', '문제', '문제 상황', '이유', '방법', '개념', '내부', '외부', '이론', '실전',
  '실측', '코드', '목표', '배경', '원인', '결과', '의미', '역할', '관계', '전체', '부분', '기본',
  '심화', '추가', '최종', '비용', '성능', '속도', '시간', '공간', '한 줄 정의', '총정리', '선택 기준',
  '답변 흐름', '게임에서의 의미', '핵심 차이', '내부 동작', 'ascii', '학습 매핑', '면접 답변',
  // 온 문서에 등장하는 일반 명사 — 링크 폭증 방지
  '메모리', '게임', '언리얼', '순서', '값', '엔진', '이름', '크기', '종합', '위험', '데이터',
  '패턴', '파일', '연관', '충돌', '반환', '삽입', '해제', '키워드', '권장', '순회', '물리', '알고리즘',
  // 링크 텍스트 사전 등록 후 폭증한 일반 명사 (각 70~450건)
  '객체', '복사', '공유', '위치', '선택', '매핑', '한계', '설계', '타입', '클래스',
  // 동음이의 — 발행본 실측 결과 뜻이 갈려 하나의 정본으로 못 보내는 표면형 (근거: _work/done-W17.txt)
  // 한 표면형은 코퍼스 전체에서 항상 같은 곳으로 가므로, 뜻이 반반이면 절반이 엉뚱한 데로 간다.
  '범위',   // 값의 범위·접근 범위·노출 범위·복제 도달 범위·범위 조회 — 5갈래
  '배치',   // 메모리 배치 / 월드 배치(AActor) / "…순서로 배치했습니다" 서술 / 배치 처리
  '확장',   // A* 노드 확장 · 스택 확장 · 주소 확장 · DP 상태 확장 · 캐시 프로토콜 확장
  '정책',   // 방화벽 정책 · 페이지 교체 정책 · 캐시 정책 · vector 성장 정책 · TCP 전송 정책
  '헤더',   // vtable 헤더 · 힙 관리 헤더 · TCP/UDP 헤더 · 헤더 파일(UHT) · <algorithm> 헤더
  '초기화', // 멤버 초기화 리스트 · calloc · vptr · TLS/CRT · UE 컴포넌트 · 소켓 — 정본 절이 없다
  'L3',     // 캐시 L3(12건) vs OSI 3계층 L3/L4(14건) — 반반 (KW_ABBR2 에 남아 있어도 여기가 이긴다)
  // 개념이 아니라 플랫폼 이름 — 링크가 붙던 절(VS 링커·플랫폼별 스택 크기)과 문맥이 무관하다
  'Windows', 'Linux',
  // 표면형 자체가 조각·수식어라 보낼 정본 절이 없다 — 실측 근거 _work/done-W28.txt. 주석에 쉼표 금지(검사기가 쉼표로 쪼개 읽는다)
  // ('평균 O'·'최악 O' 는 kwValid 의 복잡도 절단 규칙이 대신 막는다 — 2026-08-05)
  '최대',    // 전량이 수량 수식어("최대 2회"·"최대 크기"·"최대 4번") — 40건. 개념어가 아니다
  '상세',    // 전량이 "상세: →"·"상세는 44번" 안내 문구 — 19건
  // W49 — 헤딩에서 기계적으로 잘려 나온 서술구 조각. 개념이 아니라 문장 토막이라 보낼 정본 절이 아예 없다 (건수 근거 _work/done-W49.txt)
  '가장 빠름', '실효', '괄호', '정렬 전제', '스레드별 독립', 'null 불가', 'BP 노출',
  '런타임 비용', '타입 검사', '연결 상태', '비결정적 스케줄링', '두 갈래',
  '언리얼 최상위 베이스', '잦은 splice', 'PCB/TCB에 저장', '실패 시 nullptr',
  'UObject에 TSharedPtr 금지', '결과가 실행 순서에 의존', '되돌리기', '복사를 막는 방법',
  '이중 close', '이중 unlock', '노드 포인터만 재연결', 'virtual 소멸자 필수',
  '간선 비용이 모두 같을 때', '막는 이유', 'list는 큰 객체', 'vector 재할당과 같은 패턴',
  '키가 좁은 정수 범위면 배열', '힙을 공유하고 스택', '3단으로 나누는 설계 의도',
  '발표 Q&A', '선택 기준 1줄', '이론 복잡도 표', '힙이 조각나', 'GC가 수명 관리',
  '모든 쌍', '투 포인터의 전제', '이진 탐색의 전제', '기본 선택은 벡터',
  '먼저 넣은 것을 먼저 꺼내는 FIFO', 'iterator 전체 무효화', 'vector 의 메모리 레이아웃',
  'Code/Data/Heap 공유', 'std 비교', '상태 머신 전체',
  // 수량 표기 조각이면서 동음이의 — 캐시 4-way associative 와 TCP 4-way termination 으로 뜻이 갈린다
  '4-way',
  // 문서 상호참조 라벨 — "30번"·"14번 §3" 은 개념명이 아니라 파일 번호다 (KW_JUNK 상호참조 규칙과 같은 취지)
  '30번 TCP vs UDP', '01번 메모리 4영역', '26번 페이지 폴트', '23번 §7', '23번 동기화',
  '14번 §3 내부 동작', '왜 3번',
  // B군 101종 전수 판정(2026-08-04) 결과 — 절을 만들 게 아니라 사전에서 빼야 할 조각 13종.
  // 판정 요지: B군 219건 중 절 신설 대상은 0종이었다. 대부분은 착지가 이미 정확한데
  // "절 제목에 표면형이 문자 그대로 없다"는 이유로 잡힌 것이고, 아래만 진짜 문장 토막이다.
  'V+E',                       // 인접 리스트 공간·탐색 복잡도 표기(표 셀) — 13건
  '정렬 O(n log n)',           // 같은 복잡도 표기 조각 — 4건
  '붕어빵',                    // 클래스/객체 비유어. 개념이 아니라 수사
  '그 위치를 찾는 데 O(n)',    // 문장 중간 조각
  '어댑터 네 갈래',            // "시퀀스·연관·비순서 연관·어댑터 네 갈래로" 에서 잘려 오독을 부른다
  '캐시 친화성이라는 성질 자체', // 서술문. 사전 키는 '캐시 친화성' 으로 충분
  'TMap은 TSet 기반 해시 테이블', // 은/는이 붙은 문장 조각 (수동 링크는 그대로 산다)
  '쓰는 쪽 release',           // "쓰는 쪽 release·읽는 쪽 acquire" 에서 잘림
  '비교 정렬의 하한 Ω(n log n)', // 개념 키는 '비교 정렬의 하한'
  '정렬을 전제로 얻는 O(log n)', // 연관 문서의 링크 설명문
  'Stack만 독립',              // "Code/Data/Heap 공유, Stack만 독립(TCB)" 에서 잘림
  // 착지(45_algo_03 §차이점)는 맞지만 `SRWLock 대기열`·`스폰 대기열` 처럼 자료구조가 아닌
  // 문맥에도 걸려 정밀도를 깎는다. 자료구조로 배우려는 사람은 `큐` 로 들어온다 (사용자 결정)
  '대기열',
  // A군 20종 전수 확인(2026-08-05) — 검사기의 "더 나은 절" 제안은 휴리스틱이라 그대로 못 쓴다.
  // 13종은 현재 착지가 오히려 더 정확했고(정적 바인딩·레드블랙 트리 등 정본 비교표), 아래 6종만
  // 애초에 사전에 있으면 안 되는 것이었다.
  'vs 64비트',           // "32비트 vs 64비트" 에서 잘림
  'Protocol',            // 단독으로는 일반명사 — 방화벽 5-tuple 절로 가고 있었다
  '05_vtable', '08_vtable_deepdive', '10_pointer_deepdive',  // 파일명은 개념어가 아니다
  // 표본 점검(2026-08-05) — 누르는 사람이 그 낱말의 정의를 보러 누르지 않는다.
  // 착지가 있어도 문맥과 무관해서 "누르면 배신하는 링크"가 된다.
  '상수',    // → 24_floating_point § 상수 (문맥은 "상수 시간"·"상수 폴딩" 등 제각각)
  'raw',     // → 31_socket § Socket의 종류 Stream/Datagram/Raw (문맥은 "raw 포인터")
  '목적',    // → 32_firewall § 목적
  '사실상',  // → 13_vector_vs_list § 7-4
  '상한', '하한',  // → 45_algo_01 § 차이점 (문맥은 lower_bound·upper_bound 등)
  '정답', '지원', '비교표', '사용 사례', '한 줄로',
  // 코퍼스에 정본이 없다 — 유일한 착지가 `25 §15.6 행렬 곱 열 우선`(캐시 예시)인데,
  // `행렬` 을 누르는 사람이 캐시 최적화 예시를 보러 누르지 않는다. 절을 만들 일이 아니다(17건)
  '행렬',
  // 슬라이딩 윈도우·Windows OS·윈도우 매니저·레지스터 윈도우·메모리 매핑 윈도우로 갈린다.
  // TCP 윈도우 용례는 20건 중 소수라 어느 절로 보내도 대다수가 오독된다
  '윈도우',
].map(canonKey));

// 헤딩·제목 원문 → 키워드 표면형들 (번호·이모지 제거, — 앞부분, 괄호 안팎, ·/병기 분리)
// linkText=true면 질문형 꼬리 필터를 끈다 — 사람이 직접 쓴 링크 텍스트("가상메모리란",
// "해시 충돌이란?")는 헤딩에서 기계적으로 뽑은 문구와 달리 그 자체가 검색·클릭 표면형이다.
function kwVariants(raw, linkText) {
  const base = stripInlineMd(raw)
    .replace(/[\p{Extended_Pictographic}\u{FE0F}⭐①-⑳→←↑↓]/gu, ' ') // 이모지·번호기호·화살표는 표면형이 아님
    .replace(/^\s*(?:\d+(?:[.\-–]\d+)*[.)]?|q\d+[.)]?)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[?!.:…]+$/, '')
    .trim();
  const set = new Set();
  const push = (v) => {
    v = v.replace(/\s+/g, ' ').replace(/^[\s·—–-]+|[\s·—–-]+$/g, '').trim();
    // 짝 없는 괄호 꼬리 제거 — "언리얼 통합)"·"(tcmalloc" 같은 표면형은 산문과 절대 안 맞는다
    if (/\)$/.test(v) && !v.includes('(')) v = v.replace(/\)+$/, '').trim();
    if (/^\(/.test(v) && !v.includes(')')) v = v.replace(/^\(+/, '').trim();
    // 괄호 제거가 조사를 홀로 떼어낸 조각 복원 — "연산자(operator)란" → "연산자 란" → "연산자란".
    // 산문 표기는 붙여 쓴 쪽이므로 붙였을 때 산문에 있으면 그 표기를 쓴다(매칭 위치·건수는 그대로).
    // 붙여도 산문에 없으면 손대지 않고 그대로 둔다 — 아래 KW_JUNK 조사 규칙이 걷어낸다.
    const j = v.match(/^(.*\S)\s+(란|이란|이|가|은|는|을|를|의|에|와|과|로|으로)$/);
    if (j && corpusHasLoose(j[1] + j[2])) v = j[1] + j[2];
    if (v) set.add(v);
  };
  push(base);
  const dash = base.split(/\s+[—–]\s+/); // "TLB — 가상 주소의 캐시" → "TLB"
  if (dash.length > 1) push(dash[0]);
  for (const b of [...set]) { // 괄호 병기: 바깥 + 안쪽 (vtable (가상함수 테이블) → 둘 다)
    const outside = b.replace(/\s*\([^()]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    if (outside !== b) push(outside);
    for (const m of b.matchAll(/\(([^()]+)\)/g)) push(m[1]);
  }
  for (const b of [...set]) { // "캐시 히트 / 미스"·"MMU·TLB·Page Walk" 병기 분리
    // 괄호가 남아 있는 형태는 쪼개지 않는다 — "그래프 입문 (인접 리스트·행렬)"을 ·로 자르면
    // "그래프 입문 (인접 리스트" 같은 짝 안 맞는 조각이 나온다(산문과 절대 안 맞음).
    // 괄호 안쪽 "인접 리스트·행렬"은 위에서 이미 따로 push 됐고 그게 여기서 정상 분해된다.
    if (b.includes('(') || b.includes(')')) continue;
    if (/\s\/|\/\s/.test(b)) b.split(/\s+\/\s*|\s*\/\s+/).forEach(push);
    if (b.includes('·')) b.split('·').forEach(push);
  }
  // 괄호 병기 통짜("vtable (가상함수 테이블)")는 산문에 그 표기 그대로 있을 때만 남긴다.
  // 안/밖은 이미 독립 표면형으로 등록됐으므로, 본문에 없는 통짜는 영원히 링크 0인 죽은 항목이다.
  return [...set].filter((v) => kwValid(v, linkText) && (!/[()]/.test(v) || corpusHas(v)));
}
// 자동 링크가 실제로 훑는 영역(= 산문)만 모은 사본 — 헤딩·코드펜스는 뺀다.
// 헤딩까지 넣으면 "헤딩에서 뽑은 표면형은 항상 발견됨"이 되어 검사 자체가 무의미해진다.
let corpusBlob = null;
let corpusLc = null;
let corpusSq = null; // 공백 제거본 — autoLink 의 sq 매칭("객체 란" ↔ "객체란")과 같은 기준
function buildCorpus() {
  if (corpusBlob !== null) return;
  const buf = [];
  for (const f of registry.values()) {
    let inFence = false;
    for (const line of f.lines) {
      if (/^\s{0,7}```/.test(line)) { inFence = !inFence; continue; }
      if (!inFence && !/^#{1,6}\s/.test(line)) buf.push(line);
    }
  }
  corpusBlob = buf.join('\n');
  // 느슨한 검사에는 요약본도 넣는다 — 카드 본문은 요약본에서 나오고 autoLink 는 그 위도 훑는다.
  // 인라인 md 표기(**·`)는 렌더되면 사라지므로 지운다 — "**TLB** shootdown" 은 산문에서 "TLB shootdown".
  corpusLc = `${corpusBlob}\n${summaryLines.join('\n')}`.replace(/[*`~]/g, '').toLowerCase();
  corpusSq = corpusLc.replace(/\s+/g, '');
}
function corpusHas(v) { buildCorpus(); return corpusBlob.includes(v); }
// autoLink 가 실제로 잡을 수 있는 표기인가 — 대소문자 무시(583행)·공백 무시(sq) 까지 흡수한다.
// false 면 그 표면형은 사전에 넣어도 링크가 0인 것이 확정이므로 안전하게 버릴 수 있다.
function corpusHasLoose(v) {
  buildCorpus();
  const l = v.toLowerCase();
  return corpusLc.includes(l) || (/\s/.test(l) && corpusSq.includes(l.replace(/\s+/g, '')));
}
// 헤딩에서 기계적으로 유도되지만 개념명이 아닌 것들 — 문서 구조 라벨·상호참조·조사 조각.
// 개별 문자열을 나열하는 대신 모양으로 잡는다. 판정은 항상 "산문에 그 표기가 없다"와 AND 로
// 묶으므로(kwValid), 링크가 붙을 수 있는 표면형은 이 규칙에 걸려도 사전에 남는다.
const KW_JUNK = [
  /(^|\s)(란|이란|이|가|은|는|을|를|의|에|와|과|로|으로|도|만|나|에서)$/, // 조사 꼬리 — "std::map 이란"
  /(^|\s)(뭔가|뭔지|뭔데|무엇인가)$/,                                     // 의존명사 꼬리 — "힙 이 뭔가"
  /\d+\s*(초|분|시간|자|줄|가지|개|종|쪽|문장|단어)(\s*(버전|답변|정리|요약|스크립트|카드|설명|스피치))?$/, // 분량·시간 라벨 — "3분"·"RTTI 30초"·"단점 4가지"
  /\s\d{1,2}$/,                                                            // 순번 라벨 — "보충 1"·"케이스 4"
  /(^|\s|\[)\d+번(\s|$|\]|\.)/,                                            // 상호참조 — "13번 [vector vs list] 와의 연결"
  /\.md(\b|$)/i,                                                           // 파일명 — "26_page_fault.md"
  /^\d{2,}_[a-z0-9_]+$/i,                                                  // 파일 stem — "45_algo_02_vector"
  /^\d{1,2}\/\d{1,2}(\s|$|[—–-])/,                                         // 날짜 — "04/29 — std::map"
  /\s\d{1,2}\s[—–-]\s/,                                                    // 번호 + 구분선 — "알고리즘 07 — 정렬"
  /^["“]/,                                                                 // 인용된 질문 문장 — '"rehash가 일어나는 시점과 비용은?"'
];
// 문서 구조어로 끝나는 절 이름 — "비용 비교 표"·"꼬리질문 연결 맵"·"30초 답변 카드"
const KW_DOC_TAIL = new Set(['표', '카드', '맵', '목록', '가이드', '버전', '스크립트', '체크리스트',
  '치트시트', '다이어그램', '도식', '템플릿', '시나리오', '요약본', '정리표', '비교표', '종합표']);
const kwJunk = (v) => KW_JUNK.some((re) => re.test(v))
  || KW_DOC_TAIL.has(v.split(/\s+/).pop())
  || /(정리표|비교표|종합표|대응표|요약표)$/.test(v);

// 조사가 붙은 채 등록되는 표면형 — "언리얼은"·"언리얼이"·"결론부터" 는 "명사 + 조사"라 개념이 아니다.
// 산문에 그 표기 그대로 있어서 링크가 붙기 때문에, KW_JUNK 판정("산문에 없으면 버린다")으로는 못 걷어낸다.
// KW_JUNK 의 조사 규칙이 잡는 건 "std::map 이란" 처럼 **띄어 쓴** 조각뿐이다.
// 조사를 뗀 어간이 우리 어휘(KW_STOP · 이미 등록된 표면형)에 있을 때만 자른다 — 어휘 밖 어간은
// 그 글자가 조사인지 단어의 일부인지 판별할 근거가 없다. 이 조건 덕에 "매크로"(매크)·"시간
// 복잡도"(시간 복잡)·"정밀도"(정밀)·"최단 경로"(최단 경) 같은 정상 기술어는 걸리지 않는다.
// 조사 목록에서 뺀 것: 도·만·나 — 파생 명사를 만드는 접미사와 겹친다("연관도"는 캐시 연관도로
// 어간 "연관"이 KW_STOP 에 있어 오탐이 난다).
const KW_JOSA_TAIL = /(?<=[가-힣])(?:은|는|이|가|을|를|으로|로|에서|까지|부터)$/;
function josaAttached(v) {
  const m = v.match(KW_JOSA_TAIL);
  if (!m) return false;
  const stem = canonKey(v.slice(0, -m[0].length));
  return stem.length >= 2 && (KW_STOP.has(stem) || kwDict.has(stem));
}

function kwValid(v, linkText) {
  if (v.length > 60) return false;
  // 링크 텍스트 출신도 예외 없다 — "언리얼은"은 요약본 링크 텍스트를 '/'로 쪼갠 조각에서 나온다.
  if (josaAttached(v)) return false;
  if (!linkText && /(세요|시오|는가|은가|인가|한가|할까|일까|나요|까요)$/.test(v)) return false; // 질문형 헤딩 꼬리
  // 사람이 고른 링크 텍스트는 그 자체가 검색·클릭 표면형이라 제외하지 않는다(미링크 지표의 대상).
  if (!linkText && kwJunk(v) && !corpusHasLoose(v)) return false;
  // 복잡도 표기가 여는 괄호에서 잘린 조각 — "그 위치를 찾는 데 O(n)" 에서 괄호 안을 떼면
  // "그 위치를 찾는 데 O" 가 남는다. 이 계열이 사전에 계속 쌓여서(평균 O·최악 O·삽입 O·정렬 O·
  // LCS O·비교 정렬의 하한 Ω·정렬을 전제로 얻는 O) 낱개로 KW_STOP 에 박아 왔는데,
  // 원인이 하나이므로 여기서 한 번에 막는다 (B군 68종 판정 2026-08-05).
  if (/(^|[\s·])[OoΩΘθ]$/.test(v)) return false;
  const ck = canonKey(v);
  if (!ck || ck.length < 2 || KW_STOP.has(ck)) return false;
  if (/^\d+$/.test(ck)) return false;
  if (/[가-힣]/.test(v)) return true; // 한글 포함: canonKey 2자 이상
  const core = v.replace(/[^A-Za-z0-9+#._:]/g, '');
  // 라틴 3자+ 는 통과. 2자는 화이트리스트만 — "대문자 2자면 약어"로 열어 두면
  // canonKey 가 기호를 지워 /MD·/RR 같은 컴파일 옵션 조각까지 사전에 들어온다.
  return core.length >= 3 || KW_ABBR2.has(v.trim());
}

const kwDict = new Map(); // canonKey(표면형) → {surface, lc, len, latinEnd, target, pri}
function addKw(raw, target, pri, linkText) {
  for (const surface of kwVariants(raw, linkText)) {
    const key = canonKey(surface);
    const old = kwDict.get(key);
    // 충돌: 주제 제목 > 연관 키워드 > 원본 헤딩. 같은 등급이면 산문에 나올 표기(공백 있는 쪽)를 택한다
    // — canonKey가 같으면 사전에 literal 하나만 남으므로 `condition_variable` 이 이기면 "Condition
    //   Variable" 은 영원히 매칭되지 않는다.
    if (old && (old.pri > pri || (old.pri === pri && (!surface.includes(' ') || old.surface.includes(' '))))) continue;
    const esc = escapeHtml(surface);
    const lc = esc.toLowerCase();
    // sq = 공백 뺀 소문자형. 표면형에 공백이 있으면 "공백만 다른" 산문 표기도 매칭한다
    // ("가상함수 테이블" ↔ "가상 함수 테이블", "OS · 동시성" ↔ "OS·동시성").
    kwDict.set(key, { key, surface, lc, len: esc.length, sq: /\s/.test(lc) ? lc.replace(/\s+/g, '') : '', latinEnd: /[a-z0-9]$/i.test(surface), target, pri });
  }
}
// 연관 키워드 링크 URL → 원본 섹션 타깃 (makeLink와 같은 해석 규칙)
function resolveSecTarget(url) {
  if (/^https?:\/\//i.test(url)) return null;
  const hash = url.indexOf('#');
  let fileName = hash < 0 ? url : url.slice(0, hash);
  let anchor = hash < 0 ? '' : url.slice(hash + 1);
  try { fileName = decodeURIComponent(fileName); anchor = decodeURIComponent(anchor); } catch { /* 그대로 사용 */ }
  const f = registry.get(fileName.replace(/^\.\//, ''));
  if (!f) return null;
  const dom = anchor ? (f.slugToDom.get(anchor) || f.canonToDom.get(canonKey(anchor)) || '') : '';
  return { kind: 'sec', f: f.id, name: f.name, dom };
}
for (const d of domains) for (const t of d.topics) addKw(t.title, { kind: 'card', c: `t${t.num}`, file: t.file }, 3);
for (const d of domains) for (const t of d.topics) {
  for (const b of t.bullets) {
    if (!b.startsWith('🔗')) continue;
    for (const m of b.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
      const target = resolveSecTarget(m[2]);
      if (target) addKw(m[1], target, 2, true);
    }
  }
}
for (const f of registry.values()) for (const h of f.headings) addKw(h.raw, { kind: 'sec', f: f.id, name: f.name, dom: h.domId }, 1);

// 표기 별칭 — 영문·다른 표기만 사전에 있어 한글로 쓴 자리가 링크되지 않던 개념들.
// 예: 헤딩이 "Critical Section — 임계 영역"이라 산문의 "임계 구역"은 링크가 안 붙었다.
// 새 절도 새 산문도 만들지 않는다. 이미 본문에 있는 표기를 기존 정본에 매어 줄 뿐이다.
// 근거(각 표기가 어느 파일 몇 줄에 실제로 있는지): _work/링크추가-후보.md
//
// **등록은 선언이지 보장이 아니다.** 위의 연관 키워드 패스가 먼저 돌고 pri 가 같아서,
// 공백 든 표면형끼리 부딪히면 691행 타이브레이크가 기존 것을 유지해 **여기 적은 줄이 조용히 진다**
// (실측 `추상 클래스` 1건 — W56 전수 확인). 목적지만 바꾸려면 KW_RETARGET 을 써라 —
// 그건 사전 등록이 끝난 뒤 target 을 덮으므로 우선순위 싸움 자체가 없다.
// 진 줄은 `node _work/별칭검증.mjs` 의 `✗ 다른 곳에 착지` 로 드러난다(check-cs ⑥에 물려 있다).
const KW_ALIAS = [
  ['힙 할당', '01_runtime.md#힙-할당--할당기가-자유-블록을-찾는-일'],
  ['제어 블록', '11_smart_pointer.md#제어-블록-control-block-구조'],
  ['순서 보장', '23_race_condition.md#7-memory-orderingmemory-barrier--acquirerelease-페어'],
  ['리플리케이션', '38_unreal_replication.md#3-property-replication--지속-상태의-단방향-복제'],
  ['스케줄러', '21_context_switching.md#8-스케줄링-알고리즘과의-연관--선점형비선점형rr우선순위'],
  ['이동 생성자', 'CS_추가키워드_복습.md#무브-시멘틱스-move-semantics'],
  ['커널 모드', '21_context_switching.md#특권-모드커널-모드란'],
  ['참조 카운트', '11_smart_pointer.md#참조-카운팅-동작--참조-카운트가-오르내리는-시점'],
  ['임계 구역', '23_race_condition.md#4-critical-section--임계-영역의-개념'],
  ['원자성', '23_race_condition.md#6-lock-freeatomiccas--락-없는-동기화'],
  ['선점', '21_context_switching.md#선점형-vs-비선점형'],
  // W55 — 보조 문서(CS_추가키워드_복습)로 가던 것을 정본으로 돌린다. 04번 §다형성 은 정의 절이
  // 컴파일 타임(오버로딩)·런타임(오버라이딩) 두 갈래를 세우고, 바로 아래 §차이점 이 그 비교표,
  // §동작 이 갈래마다 코드 예제를 준다 — 오버라이딩·오버로딩을 한자리에서 정의하는 곳은 여기다.
  ['오버라이딩', '04_oop.md#다형성-polymorphism'],
  ['로드 팩터', '15_hash_rehash_followup.md#2-load-factor--평균-충돌-정도의-지표'],
  ['균형 이진 탐색 트리', '37_stdmap_vs_tmap.md#4-레드블랙-트리가-stdmap의-내부-구현인-이유'],
  ['가상 함수 테이블', '05_vtable.md#vtable이란'],
  ['깊은 복사', '12_prevent_copy.md#얕은-복사와-깊은-복사'],
  ['핸드셰이크', 'CS_추가키워드_복습.md#tcp-3-way-handshake-30_tcp_vs_udpmd-31_socketmd'],
  ['혼잡 제어', '30_tcp_vs_udp.md#64-congestion-control'],
  ['스핀락', '23_race_condition.md#51-mutex-배타적-락'],
  ['메모이제이션', '45_algo_13_dp_intro.md#정의'],
  ['분할 정복', '45_algo_13_dp_intro.md#차이점'],
  ['병합 정렬', '18_list_sort.md#4-정렬-알고리즘-차이--introsort-vs-병합-정렬-merge-sort'],
  ['안정 정렬', '45_algo_07_sorting.md#차이점'],
  ['최단 경로', '45_algo_20_dijkstra.md#정의'],
  ['위상 정렬', '45_algo_18_graph_intro.md#정의'],
  ['길찾기', '45_algo_21_astar.md#정의'],
  ['휴리스틱', '45_algo_21_astar.md#동작'],
  ['open list', '45_algo_21_astar.md#동작'],
  ['가지치기', '45_algo_11_backtracking.md#동작'],
  ['점화식', '45_algo_13_dp_intro.md#동작'],
  // 이 통짜 표기는 산문에 없다. kwVariants 가 `/` 로 갈라 `최적 부분 구조`(6건) ·
  // `중복 부분 문제`(3건) 로 등록되고 그 둘이 실제로 링크된다 — 지우지 마라(W56 확인)
  ['최적 부분 구조 / 중복 부분 문제', '45_algo_13_dp_intro.md#정의'],
  // 2차 — _work/kw-별칭-후보2.md (유형: 한글↔영문 14 · 표기 변형 14 · 긴 헤딩의 짧은 본체 29)
  ['게임 스레드', '42_unreal_thread_model.md#3-gamethread--무엇을-그릴지-결정하는-메인-스레드'],
  ['다운캐스트', '09_rtti_raii.md#dynamic_cast--안전한-다운캐스트'],
  ['인터닝', '36_unreal_strings.md#4-fname--인터닝된-식별자-식별'],
  ['드로우콜', '42_unreal_thread_model.md#4-renderthread--어떻게-그릴지-드로우콜-생성-1프레임-뒤'],
  ['이중 해제', '10_pointer_deepdive.md#②-unique_ptr--소유권-단독화로-double-free-원천-차단'],
  ['연결 지향', '30_tcp_vs_udp.md#31-연결-지향connection-oriented의-의미'],
  ['비연결', '30_tcp_vs_udp.md#41-비연결connectionless의-의미'],
  ['멀티플렉싱', '31_socket.md#8-io-멀티플렉싱--selectpollepolliocp'],
  ['벨만-포드', '45_algo_20_dijkstra.md#차이점'],
  ['빅오', '45_algo_01_complexity.md#정의'],
  ['점근', '45_algo_01_complexity.md#정의'],
  ['프리페치', '25_cache_hit_miss.md#11-prefetching--hardwaresoftware'],
  ['완벽 전달', '15_pushback_vs_emplaceback.md#2-3-perfect-forwarding-의-의미'],
  ['이터레이터 무효화', '13_vector_vs_list.md#5-1-iterator-무효화-규칙'],
  ['사용자 모드', '21_context_switching.md#5-모드-스위치--컨텍스트-스위치--자주-헷갈리는-구분'],
  ['컨텍스트 스위치', '21_context_switching.md#5-모드-스위치--컨텍스트-스위치--자주-헷갈리는-구분'],
  ['프로세스 전환', '21_context_switching.md#프로세스-컨텍스트-스위치-단계-다른-프로세스로'],
  ['스레드 전환', '21_context_switching.md#스레드-컨텍스트-스위치-단계-같은-프로세스-내'],
  ['유저 모드', '21_context_switching.md#5-모드-스위치--컨텍스트-스위치--자주-헷갈리는-구분'],
  ['탐욕', '45_algo_12_greedy.md#정의'],
  ['복사 생성자', '12_prevent_copy.md#rule-of-three-c98--소멸자--복사-생성자--복사-대입-연산자'],
  ['퀵 정렬', '45_algo_07_sorting.md#정의'],
  ['약한 참조', '11_smart_pointer.md#4-weak_ptr--순환-참조-해결'],
  ['대입 연산자', '12_prevent_copy.md#rule-of-three-c98--소멸자--복사-생성자--복사-대입-연산자'],
  ['깊이 우선', '45_algo_19_dfs_bfs.md#정의'],
  ['공간 복잡도', '45_algo_01_complexity.md#정의'],
  ['거리 필드', '45_algo_19_dfs_bfs.md#활용사용법'],
  ['너비 우선', '45_algo_19_dfs_bfs.md#정의'],
  ['버킷', '14_std_map_followup.md#11-2-버킷--해시-테이블의-슬롯'],
  ['연결 리스트', '16_stl_containers.md#33-stdlist--이중-연결-리스트'],
  ['연속 메모리', '13_vector_vs_list.md#2-1-vector--연속-메모리'],
  ['가상 주소', '29_memory_hierarchy.md#가상-주소-virtual-address'],
  ['값 타입', '34_ustruct_vs_uclass.md#4-결정적-차이-②-값-타입-vs-참조-타입'],
  ['역참조', '07_pointer_reference.md#역참조-문법'],
  ['동기화 객체', '23_race_condition.md#5-동기화-객체-카탈로그--mutexsemaphorecritical-sectionsrwlockeventcondition-variable'],
  ['메시지 경계', '31_socket.md#53-메시지-경계-처리'],
  ['동시 접근', '23_race_condition.md#31-발생-4조건'],
  ['참조 타입', '34_ustruct_vs_uclass.md#4-결정적-차이-②-값-타입-vs-참조-타입'],
  ['커널 진입', '21_context_switching.md#비용-요소-5--커널-진입모드-스위치-자체-비용'],
  ['인터럽트', '21_context_switching.md#발생-시점-1--타이머-인터럽트-timer-interrupt'],
  ['단독 소유', '11_smart_pointer.md#2-unique_ptr--단독-소유'],
  ['깊은 재귀', '20_stack_overflow.md#원인-2--너무-깊은-재귀'],
  ['물리 주소', '29_memory_hierarchy.md#61-가상물리-주소-변환'],
  ['공유 소유', '11_smart_pointer.md#3-shared_ptr--공유-소유--참조-카운팅'],
  ['노드 안정성', '16_stl_containers.md#iterator-무효화--노드-안정성'],
  ['프레임 펜스', '42_unreal_thread_model.md#6-세-스레드-간-데이터-흐름과-동기화-enqueue_render_command펜스'],
  ['신뢰 경계', '32_firewall.md#2-방화벽의-정의와-목적--신뢰-경계의-문지기'],
  ['선형 탐색', '17_find_vs_binary_search.md#2-stdfind--선형-탐색'],
  ['인라이닝', '키워드-보강-2026-07-28.md#inline과-스택의-관계--인라이닝이-불가능한-경우'],
  ['멀티프로세스', '19_process_vs_thread.md#7-멀티프로세스-vs-멀티스레드--언제-무엇을-쓰나'],
  ['커널 경유', '22_ipc.md#분류축-2--커널-경유-vs-사용자-모드-직접'],
  ['순환 대기', '23_race_condition.md#931-lock-ordering-순환-대기-깨기'],
  ['피보나치', '20_stack_overflow.md#9-c-코드-예시--피보나치--거대-배열--명시적-스택'],
  ['페이지 교체', '26_page_fault.md#9-페이지-교체-알고리즘'],
  ['가변 템플릿', '15_pushback_vs_emplaceback.md#2-내부-동작--가변-템플릿--perfect-forwarding'],
  // `템플릿` 은 KW_DOC_TAIL 에 있어(문서 구조어 "답변 템플릿"·"비교표" 계열) 헤딩 자동 등록에서
  // junk 로 걸러진다. addKw 는 junk 검사를 안 거치므로 여기서만 넣을 수 있다.
  // 검색이 "템플릿" 을 C++ 템플릿으로 못 찾던 원인이고(사용자 지적), kwCanon 이 이 줄을 읽어
  // 질의가 표면형과 같을 때 정본 절을 즉답으로 올린다.
  ['템플릿', '01_runtime.md#템플릿-template--컴파일-타임에-코드를-찍어-내는-틀'],
  ['template', '01_runtime.md#템플릿-template--컴파일-타임에-코드를-찍어-내는-틀'],
  ['명령 재배치', '44_memory_barrier.md#2-왜-필요한가--컴파일러cpu의-명령-재배치'],
  ['교환 논증', '45_algo_12_greedy.md#동작'],
  // 3차 — _work/kw-별칭-후보3.md (새 자리 22건 + 더 정확한 절로 재지정 25건)
  ['메모리 접근', '25_cache_hit_miss.md#32-평균-메모리-접근-시간-amat'],
  ['주소 공간', '28_os_32bit_vs_64bit.md#3-가상-주소-공간--4gb-vs-256tb'],
  ['멤버 함수', '18_list_sort.md#정답--멤버-함수-사용'],
  ['컴포넌트', '43_actor_scene_primitive_component.md#3-각-컴포넌트의-역할과-책임'],
  ['멀티스레드', '19_process_vs_thread.md#7-멀티프로세스-vs-멀티스레드--언제-무엇을-쓰나'],
  ['물리 메모리', '29_memory_hierarchy.md#물리-메모리-physical-memory'],
  ['비동기', '19_process_vs_thread.md#94-stdasync--stdfuture--비동기-작업'],
  ['멀티코어', '29_memory_hierarchy.md#5-캐시-일관성--mesi와-멀티코어'],
  ['캐시 콜드', '21_context_switching.md#비용-요소-2--캐시-콜드-cache-cold--가장-큰-간접-비용'],
  ['raw 포인터', '33_uobject.md#6-포인터-다루기--raw-포인터-위험tobjectptr약참조'],
  ['표준 RTTI', '39_rtti_cast.md#2-c-표준-rtti--vtable-옆-type_info'],
  ['지역 변수', '20_stack_overflow.md#원인-3--거대한-지역-변수'],
  ['TLB miss', '25_cache_hit_miss.md#123-tlb-miss-증상'],
  ['단일 스레드', '19_process_vs_thread.md#단일-스레드-vs-멀티스레드-메모리-레이아웃'],
  ['블로킹', '31_socket.md#7-blocking-vs-non-blocking'],
  ['STL 컨테이너', '16_stl_containers.md#2-stl-컨테이너-4대-분류'],
  ['GC 대상', '34_ustruct_vs_uclass.md#3-결정적-차이-①-gc-대상-여부와-수명-관리'],
  ['부분 문제', '45_algo_13_dp_intro.md#정의'],
  ['스택 크기', '20_stack_overflow.md#5-플랫폼별-스택-크기--windows--linux--워커--언리얼'],
  ['OS 스레드', '19_process_vs_thread.md#8-사용자-스레드-vs-커널-스레드--11--n1--mn-모델'],
  ['생성자 호출', 'CS_추가키워드_복습.md#생성자소멸자-호출-순서-06_virtual_destructormd-08_vtable_deepdivemd'],
  ['major fault', '26_page_fault.md#42-major-page-fault-hard-fault'],
  ['vector 재할당', '15_pushback_vs_emplaceback.md#5-5-vector-재할당-vs-unordered_map-rehash--데칼코마니'],
  ['스택 영역', '20_stack_overflow.md#메모리-4영역-다시-보기'],
  ['프레임 예산', '29_memory_hierarchy.md#121-60fps-프레임-예산-관점'],
  ['메모리 영역', '19_process_vs_thread.md#메모리-영역-4구역-복기-01_runtime-03_new_vs_malloc-회귀'],
  // 사용자 지적(2026-08-26): "프로세스/스레드" 검색 즉답이 하위 "2. 한 줄 정의"로 가던 것을
  // 최상단 모의면접 답변으로 재지정한다.
  ['프로세스와 스레드', '19_process_vs_thread.md#모의면접-답변'],
  ['프로세스 스레드', '19_process_vs_thread.md#모의면접-답변'],
  // 사용자 지적(2026-08-26): "생성자 소멸자 순수가상함수" 즉답이 카드 "06 virtual 소멸자"로
  // 새던 것을 08번 §추가 단점(생성자/소멸자 내부 가상 함수 호출)으로 고정한다.
  ['생성자 소멸자 순수가상함수', '08_vtable_deepdive.md#추가-단점-생성자소멸자-내부-가상-함수-호출'],
  ['생성자 소멸자 가상함수', '08_vtable_deepdive.md#추가-단점-생성자소멸자-내부-가상-함수-호출'],
  ['UObject 포인터', '34_ustruct_vs_uclass.md#6-gc-통로--ustruct-안의-uobject-포인터'],
  ['상속 계층', '43_actor_scene_primitive_component.md#2-상속-계층-다이어그램'],
  ['vtable 슬롯', 'CS_추가키워드_복습.md#_purecall--순수-가상-함수의-vtable-슬롯-08_vtable_deepdivemd'],
  ['가상 소멸자', '06_virtual_destructor.md#해결책--virtual-소멸자'],
  // W55 — 보조 문서로 가던 것을 정본으로. 06번 §해결책 정의 절이 "기반 포인터로 delete 해도
  // 실제 타입의 소멸자부터 체인이 시작된다"이고, 바로 아래 §동작에 `소멸자 체인 순서(생성의 역순)`
  // 코드가 붙는다. 복습본 절은 지우지 않는다 — 보조 문서의 역할은 따로 있다.
  ['소멸자 호출', '06_virtual_destructor.md#해결책--virtual-소멸자'],
  ['재귀 호출', '45_algo_08_recursion.md#정의'],
  ['minor fault', '26_page_fault.md#41-minor-page-fault-soft-fault'],
  ['최상위 베이스', '33_uobject.md#2-uobject의-정의와-위치--언리얼의-최상위-베이스'],
  ['메모리 누수', '키워드-보강-2026-07-28.md#메모리-누수-확인-도구-crt-디버그-힙'],
  ['스레드 풀', '21_context_switching.md#stdasync--stdfuture--스레드-풀-또는-새-스레드'],
  ['균형 BST', '14_std_map.md#3-1-왜-자기-균형-bst-가-필요한가'],
  // 앵커 표기가 그 사이 "9.3 워킹 셋 (Working Set Model)"로 바뀌어 `#93-working-set-model` 은
  // 해석에 실패, 6건이 26번 **파일 상단**으로 떨어지고 있었다(경고 없이 폴백). 실제 슬러그로 교정.
  ['Working Set', '26_page_fault.md#93-워킹-셋-working-set-model'],
  ['인접 행렬', '45_algo_18_graph_intro.md#정의'],
  ['BSD Socket', '31_socket.md#6-bsd-socket-api--서버클라이언트-호출-흐름'],
  ['원시 포인터', '07_pointer_reference.md#원시-포인터-vs-tobjectptr'],
  ['unordered_map rehash', '14_std_map.md#unordered_map-rehash-무효화--댕글링'],
  ['atomic 카운터', '23_race_condition.md#145-fthreadsafecounter--atomic-카운터'],
  ['NAT Traversal', '30_tcp_vs_udp.md#106-nat-traversal-용이'],
  ['데이터 레이스', '23_race_condition.md#race-condition-vs-data-race'],
  ['Data Race', '23_race_condition.md#race-condition-vs-data-race'],
  ['가비지 컬렉터', '02_class_vs_struct.md#q5-1-uclass와-가비지-컬렉터gc의-연결'],
  // 4차 — 헤딩이 "A와 B" 통짜라 개별 용어가 안 잡히는 자리
  ['기반 클래스', '04_oop.md#기반-클래스와-파생-클래스'],
  ['파생 클래스', '04_oop.md#기반-클래스와-파생-클래스'],
  // 5차 — 정의 절은 있는데 헤딩이 "…란" 이라 표면형이 안 맞던 것
  ['iterator', '17_find_vs_binary_search.md#9-1-iterator란'],
  // 8차 — "람다" 단독 검색이 14번 §2-3 람다 (대소문자 무시 정렬, 활용 하위절)에 착지하던 것.
  // 정의를 세우는 곳은 41번 §람다와 캡처(정의·동작·캡처 방식까지)라 그리로 돌린다.
  ['람다', '41_unreal_delegate.md#람다와-캡처--컴파일러가-만드는-익명-함수-객체'],
  ['lambda', '41_unreal_delegate.md#람다와-캡처--컴파일러가-만드는-익명-함수-객체'],
  ['캡처', '41_unreal_delegate.md#람다와-캡처--컴파일러가-만드는-익명-함수-객체'],
  ['이터레이터', '17_find_vs_binary_search.md#9-1-iterator란'],
  // 6차 — 신설 OS 정본 절이 커널의 정의도 담는다(§차이점 "OS와 커널의 경계")
  ['커널', '21_context_switching.md#커널-kernel'],
  // 7차 — 신설 정본 절 16개가 아직 못 받고 있던 표기(_work/done-W34.txt). 산문 실측 후 남은 것만.
  // 04번 §기반 클래스와 파생 클래스: 같은 관계를 부르는 세 가지 우리말 표기.
  ['자식 클래스', '04_oop.md#부모-클래스--자식-클래스--베이스-클래스--같은-관계의-다른-표기'],
  ['베이스 클래스', '04_oop.md#부모-클래스--자식-클래스--베이스-클래스--같은-관계의-다른-표기'],
  ['부모 클래스', '04_oop.md#부모-클래스--자식-클래스--베이스-클래스--같은-관계의-다른-표기'],
  // 16번 §자료구조 (Data Structure) — 산문이 "데이터 구조"로 쓴 자리(헤딩 표기는 "자료구조")
  ['데이터 구조', '16_stl_containers.md#자료구조-data-structure'],
  // 26번 §페이지 테이블 — 그 절이 "항목 하나가 PTE"라고 못 박는다. 약어만 사전에 없었다
  ['PTE', '26_page_fault.md#페이지-테이블-page-table'],
  // 33번 §액터 (AActor) — 헤딩에서 나온 표면형은 "액터"와 "AActor" 둘뿐이라, 산문이 접두사 없이
  // 쓴 "Actor"(Actor의 위치·Actor 리플리케이션·Actor 채널)가 통째로 비어 있었다.
  // 좌우 경계 검사가 AActor·Actors·UActorComponent 안쪽 매칭은 이미 막는다.
  ['Actor', '33_uobject.md#액터-aactor'],
  ['가상주소', '29_memory_hierarchy.md#가상-주소-virtual-address'],
  // W44 — 제목이 서술문이라 단독 용어가 안 잡히는 절
  ['이름 가리기', '05_vtable.md#이름-가리기-name-hiding'],
  ['name hiding', '05_vtable.md#이름-가리기-name-hiding'],
  // 같은 문서 §3 으로 돌린다(2026-08-06 사용자 지적: "순수가상함수도 정의로 안 가고 문제점으로 가").
  // W44 가 이 표면형을 「자식 클래스에 남기는 문제」 절에 매어 뒀는데, 그건 **제목이 서술문이라
  // 안 잡히는 그 절을 닿게 하려던 것**이지 이 용어의 정본을 정한 게 아니다.
  // §3 의 `### 정의` 가 "= 0 으로 선언해 파생이 반드시 채워야 하는 vtable 슬롯" 이라고 세운다.
  // 문제 절은 "자식이 안 채우면 생기는 일" 이라 정의가 아니다 — 바로 아래 `추상 클래스` 와 같은 판정이다.
  ['순수 가상 함수', '08_vtable_deepdive.md#3-순수-가상-함수와-_purecall'],
  // (`추상 클래스` 는 여기 있었지만 **한 번도 먹은 적이 없다** — 연관 키워드 패스가 먼저 등록한
  //  04번 §추상 클래스 vs 인터페이스 와 pri 가 같아 타이브레이크에서 졌다. 양쪽을 읽어 보니
  //  04번이 맞다(정의 절 + 비교표). 08번 절은 "자식이 안 채우면 생기는 문제"라 정의를 세우지
  //  않는다. 판정은 KW_KEEP 으로 옮겼다 — W56)
  // 지목 6주제 — 사전에 표면형이 없어 미연결이던 것
  ['페이지 프레임', '26_page_fault.md#페이지와-프레임'],
  ['프레임 번호', '26_page_fault.md#페이지와-프레임'],
  ['특권 모드', '21_context_switching.md#특권-모드커널-모드란'],
  // W49 — canonKey 가 같은 `ThreadSafe`(40번 ESPMode 표기)가 사전 자리를 먹어 산문의 "thread-safe" 가
  // 통째로 안 잡히고 있었다(요약본 §16 색인 링크가 미링크로 잡힘). 표기를 하이픈형으로 되돌리고,
  // 착지는 그 용어를 제목에 건 19번 Q10 으로 — 색인 문장 자체가 "개별 컨테이너는 thread-safe 아님"이다
  ['thread-safe', '19_process_vs_thread.md#q10-stl-컨테이너는-thread-safe한가요'],
  // 재타깃에 있었으나 사전에 없던 표면형 — 헤딩이 "rehash"라 "재해싱"은 본문에만 있다
  ['재해싱', '15_hash_rehash_followup.md#3-rehash--임계값-초과-시-자동-재해싱'],
  // ── W54 (2026-08-05) — **띄어쓰기 어긋남**으로 통째로 안 걸리던 표기 ──
  // 사용자 실기 지적: "한 번에 한 스레드만 지나가야 하는 코드 구간이 임계 영역"이라 써 놓고
  // 임계 영역에 링커가 없다. 원인은 사전에 없어서가 아니라 **사전 표면형이 붙여쓰기**라서다.
  // addKw 는 표면형에 공백이 있을 때만 sq(공백 무시) 매칭을 켠다 — 붙여 쓴 표면형은 띄어 쓴
  // 산문을 영원히 못 잡는다. 반대로 띄어 쓴 표면형은 붙여 쓴 산문까지 잡으므로 한쪽만 넣으면 된다.
  // 대상은 kwDict 덤프로 전수 조사했다(공백 없는 한글 표면형 4자 이상 × 산문의 띄어 쓴 이형).
  // 착지는 기존 항목 그대로 둔다 — 이번 건은 목적지가 아니라 **표기** 문제다.
  // 2026-08-11 재타깃 — 05 에 `## 가상 함수란 — virtual 이 하는 일` 이 신설되면서 이 용어의
  // 정의 절이 생겼다. 그전엔 정의를 세우는 절이 없어 차선책으로 §Vtable이란 에 매어 뒀던 것이다.
  ['가상 함수', '05_vtable.md#가상-함수란--virtual-이-하는-일'],   // 산문 168회 (붙임 5회)
  ['해시 테이블', '14_std_map_followup.md#11-해시hash-가-뭔가--버킷bucket-이-뭔가'], // 47회
  ['공유 자원', '19_process_vs_thread.md#3-메모리-구조-비교--코드데이터힙스택과-pcbtcb'], // 26회
  ['임계 영역', '23_race_condition.md#4-critical-section--임계-영역의-개념'],       // 14회 ← 사용자 지적
  ['RB 트리', '14_std_map.md#3-내부-동작--red-black-tree'],        // 12회
  ['멀티 코어', '29_memory_hierarchy.md#5-캐시-일관성--mesi와-멀티코어'],  // 8회
  ['존재 범위', '35_gameplay_framework.md#4-서버클라이언트-존재-범위--리플리케이션-관점'], // 5회
  ['동치 판단', '17_find_vs_binary_search.md#9-보강--iterator--동치판단--lower_bound-vs-find'], // 3회
  ['멀티 스레드', '19_process_vs_thread.md#7-멀티프로세스-vs-멀티스레드--언제-무엇을-쓰나'], // 3회
  ['메모리 오더링', '23_race_condition.md#7-memory-orderingmemory-barrier--acquirerelease-페어'], // 1회
  // ── W54 — 사전에 **아예 없던** 낱말 (정의어-누락 후보 106종을 실사전으로 재검한 결과 진짜 2종) ──
  // 03번 §보충 1 이 "연산자 = 피연산자에 정해진 동작을 수행하도록 언어가 제공하는 기호/키워드"라고
  // 못 박는다. 사전엔 `C++ 연산자`·`대입 연산자` 같은 복합어만 있어 홑낱말 36회가 통째로 비었다.
  ['연산자', '03_new_vs_malloc.md#보충-1--연산자operator란'],
  // 사용자 지적: 23번 §5.1 표의 "재진입 불가"가 뭔 소린지 모르겠다. 산문 11회 전부 미링크였다.
  // 착지 후보 3곳을 읽고 골랐다 — 21번 §10 의 두 줄(Critical Section "재진입 가능" · SRWLock
  // "재진입 불가")은 객체별 특성 나열이라 재진입이 **무엇인지**는 말하지 않는다. 23번 §5.1 표
  // 본문은 사용자가 읽고 있는 자리라 자기 절 억제로 링크가 안 붙는다. 남는 23번 §뮤텍스는
  // "소유자를 알기 때문에 재진입 허용(같은 스레드의 재잠금)"이라고 **원인과 함께** 정의하고,
  // 차이점 표에도 재진입 행이 있다 — 재진입을 성질로 다루는 자리는 코퍼스에 여기뿐이다.
  ['재진입', '23_race_condition.md#뮤텍스mutex와-뮤텍스-api--소유권-있는-상호-배제-락'],
  // ── W55 (2026-08-05) — 사용자가 칠 법한 표면형이 **사전에 없어** 검색이 헤딩 문자열만 보고
  // 엉뚱한 곳에 착지하던 것. 내용은 전부 코퍼스에 있었다. 띄어 쓴 쪽을 넣는다(addKw 의 sq 규칙).
  // 퓨어 콜 — `pure call` 은 이미 08번 §3 으로 가는데 한글 표기만 없어 38번 RepNotify 로 샜다.
  // 08 §3 정의가 "빈 슬롯에 _purecall 포인터가 들어간다"이고 §동작에 발생 시나리오가 붙는다.
  ['퓨어 콜', '08_vtable_deepdive.md#3-순수-가상-함수와-_purecall'],
  // 프로세스 메모리 구조 — 22번 §학습 영역(문서 도입부)으로 가고 있었다. 19번 §3 이 정본이다
  // (정의: "스레드는 코드·데이터·힙을 공유하고 스택과 레지스터만 자기 것"). 질의의 조사 `의`는
  // tokenize 가 떼므로 사전 표면형은 조사 없는 쪽으로 둔다.
  ['프로세스 메모리 구조', '19_process_vs_thread.md#3-메모리-구조-비교--코드데이터힙스택과-pcbtcb'],
  // 소멸자 3종 — 15_1(벡터/해시 곁가지)·08 §모의면접 답변·보조 문서로 흩어져 있었다. 정본은 06 번.
  //   `소멸자`·`자식 클래스 소멸자` → §문제 상황. 정의 절이 "기반 포인터로 delete 하면 파생
  //     소멸자가 실행되지 않는다"라고 자식 소멸자 이야기를 직접 한다.
  //   (`소멸자 호출` 은 위쪽에 이미 항목이 있어 그 자리에서 고쳤다 — 동일 pri 는 먼저 등록된
  //    쪽이 이기므로 여기에 다시 적으면 무시된다.)
  ['소멸자', '06_virtual_destructor.md#문제-상황--virtual-없는-소멸자'],
  ['자식 클래스 소멸자', '06_virtual_destructor.md#문제-상황--virtual-없는-소멸자'],
  // ── 검색 전용 별칭 (2026-08-12 사용자 지적) ──
  // `스택 힙` · `process thread` 로 검색하면 사전에 그 canonKey 가 아예 없어 밴드 매칭만으로
  // 착지가 정해졌다 — 각각 19번 §왜 스택만 스레드마다(스레드 관점 곁가지) · `CS_추가키워드_복습`
  // (보조 문서)로 갔다. 정본을 사전에 박아 검색이 그걸 쓰게 한다.
  // 산문에 이 표면형이 그대로 나올 일은 드물어 `△ 미등장` 으로 잡힐 수 있는데, `template` 과
  // 같은 **검색 전용 줄이라 정상**이다(판정기록-오탐 참조). 자동 링크가 아니라 검색이 목적이다.
  ['스택 힙', '20_stack_overflow.md#6-스택-vs-힙--큰-데이터를-힙으로-옮기기-03번-회귀'],
  ['process thread', '19_process_vs_thread.md#2-한-줄-정의--프로세스와-스레드'],
];
for (const [surface, url] of KW_ALIAS) {
  const t = resolveSecTarget(url);
  if (t) addKw(surface, t, 2, true);
  else console.warn('  ! 별칭 타깃 해석 실패: ' + surface + ' → ' + url);
}

// 원본 안의 명시 링크 텍스트도 사전에 등록(pri 1). 헤딩·요약본 🔗에 없는 표면형이
// 여기에만 있는 경우가 많다 — 예: "메모리 배리어"(헤딩은 "언리얼에서의 메모리 배리어"),
// "오픈 어드레싱"(헤딩은 "해시 충돌 처리 — 오픈 어드레싱 (Open Addressing)"),
// "체이닝"·"GameplayTag"·"ASC". 링크 텍스트는 이미 사람이 고른 키워드→섹션 짝이다.
for (const f of registry.values()) {
  let inFence = false;
  for (const line of f.lines) {
    if (/^\s{0,7}```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    for (const m of line.matchAll(/\[([^\]\n]+)\]\(([^)\s]+)\)/g)) {
      const text = stripInlineMd(m[1]).trim();
      if (/\.md$/i.test(text) || /^\d+번$/.test(text)) continue; // 파일명·"23번" 상호참조는 키워드 아님
      const target = resolveSecTarget(m[2].startsWith('#') ? f.name + m[2] : m[2]);
      if (target) addKw(text, target, 1, true);
    }
  }
}
// 요약본(색인 섹션 포함) 링크 텍스트 — "무브 시멘틱스"·"rvalue vs lvalue"·"#define 매크로"
// 처럼 원본 헤딩에서 유도되지 않는 표면형이 색인에만 있다. 색인은 사용자가 검색·클릭할
// 키워드 목록 그 자체이므로 사전에 등록해야 본문 자동 링크가 걸린다(pri 1 = 기존 등록 우선).
for (const line of summaryLines) {
  for (const m of line.matchAll(/\[([^\]\n]+)\]\(([^)\s]+)\)/g)) {
    const text = stripInlineMd(m[1]).trim();
    if (/\.md$/i.test(text) || /^\d+번$/.test(text)) continue;
    const target = resolveSecTarget(m[2]);
    if (target) addKw(text, target, 1, true);
  }
}

// 동음이의 재타깃 — 표면형은 그대로 두고 **목적지만** 정본으로 고친다(링크 총량 불변).
// 사전은 canonKey 하나당 항목 하나라, 뜻이 갈리는 말이 먼저 등록된 한쪽 뜻으로 전량 몰린다.
// pri 경쟁(addKw)으로는 못 고친다 — 이긴 항목의 target 을 마지막에 덮어써야 한다.
// 근거는 추측이 아니라 발행본 실측이다(링크가 실제로 걸린 위치의 소속 문서 분포) → _work/done-W17.txt
// 확정 판정 목록 — "지금 착지가 맞다"고 **양쪽 절을 실제로 열어 읽고** 확인한 것들.
// 검사기(_work/링크-의미검증.mjs)가 절 제목에 표면형이 없다는 이유로 A군에 계속 올려 놓는데,
// 그 "더 나은 절" 제안은 휴리스틱이라 그대로 등록하면 오히려 나빠진다 — 실제로 아래 13종은
// 제안 쪽이 전부 더 나빴다(예: `정적 바인딩` 은 05번 정본 비교표가 06번 버그 맥락 코드보다 낫고,
// `vector/list` 는 저자가 CS_추가키워드_복습:136 에서 직접 현재 앵커로 링크해 뒀다).
// 검사기는 이 목록을 읽어 A군 제안에서 제외한다. 판정을 뒤집으려면 여기서 빼고 다시 읽어라.
// (2026-08-05 A군 20종 전수 확인)
const KW_KEEP = [
  ['정적 바인딩', '05_vtable.md#정적-vs-동적-바인딩'],
  ['레드블랙 트리', '14_std_map.md#3-내부-동작--red-black-tree'],
  ['메모리 풀', '27_memory_fragmentation.md#8-게임-패턴--poolarenaframe-allocator'],
  ['5속성', '14_std_map.md#3-2-red-black-tree-의-5가지-속성'],
  ['GameThread 전용', '42_unreal_thread_model.md#3-gamethread--무엇을-그릴지-결정하는-메인-스레드'],
  ['UObject GC', '33_uobject.md#5-가비지-컬렉션--mark-and-sweep과-uproperty의-관계'],
  ['capacity 재할당', '15_pushback_vs_emplaceback.md#5-vector-capacity-와-재할당-rehash-와-비교'],
  ['임계영역(Critical Section)', '23_race_condition.md#4-critical-section--임계-영역의-개념'],
  ['UObject/AActor', '33_uobject.md#8-uobject-vs-aactor-vs-uactorcomponent--위치-관계'],
  ['vector/list', '13_vector_vs_list.md#5-1-iterator-무효화-규칙'],
  ['atomic·lock-free', '23_race_condition.md#6-lock-freeatomiccas--락-없는-동기화'],
  ['캐시 친화 코드', '25_cache_hit_miss.md#8-캐시-친화적-코드-패턴--게임-코드-핵심'],
  ['inline 함수', '08_vtable_deepdive.md#인라인-함수-inline'],
  // 착지가 정확한데 제목에 표면형이 없어 잡힌 것 (2026-08-05 확인)
  ['Race Condition 발생 조건', '23_race_condition.md#3-발생-조건-4가지와-가장-단순한-예제'],
  // 착지가 정확한데 제목은 `/` 구분자, 표면형은 `·` 라서 잡힌 오탐
  ['파일·뮤텍스·소켓', '12_prevent_copy.md#6-단독-소유-자원-심화--파일-핸들--뮤텍스--소켓'],
  // --- 약한 통과 30종 판정(2026-08-05) — ①정상 27종 ---
  // 착지 절 본문을 직접 읽고 정상으로 확인했다. 45_algo 계열 13종은 8단 골격이라
  // `#정의` 착지 시 바로 아래에서 차이점·동작·활용을 순서대로 만난다 — 정의가 짧은 건 그 양식이다.
  // 나머지 14종은 착지 절의 `### 정의` 소절이 그 용어를 실제로 정의하고 있었다.
  ['정렬', '45_algo_07_sorting.md#정의'],
  ['재귀', '45_algo_08_recursion.md#정의'],
  // (`vector`·`map` 은 이 자리에 45_algo 절로 적혀 있었다. 그 뒤 KW_RETARGET 이 둘을 C++ 정본으로
  //  돌렸으므로 **기록이 낡은 것**이다 — 실제 착지로 갱신한다. 근거는 KW_RETARGET 쪽 주석. W56)
  ['vector', '13_vector_vs_list.md#2-메모리-레이아웃-차이'],
  ['map', '14_std_map.md#모의면접-답변--stdmap-은-어떻게-동작하나요'],
  ['그래프', '45_algo_18_graph_intro.md#정의'],
  ['이진 탐색', '45_algo_09_binary_search.md#정의'],
  ['다익스트라', '45_algo_20_dijkstra.md#정의'],
  ['완전 탐색', '45_algo_10_brute_force.md#정의'],
  ['백트래킹', '45_algo_11_backtracking.md#정의'],
  ['그리디', '45_algo_12_greedy.md#정의'],
  ['누적합', '45_algo_17_prefix_sum.md#정의'],
  ['슬라이딩 윈도우', '45_algo_16_sliding_window.md#정의'],
  ['점화식', '45_algo_13_dp_intro.md#동작'],
  ['소켓', '31_socket.md#2-socket의-정의와-역할--endpoint-추상화'],
  ['캐시 미스', '25_cache_hit_miss.md#3-캐시-히트와-미스의-본질'],
  ['사용자 모드', '21_context_switching.md#5-모드-스위치--컨텍스트-스위치--자주-헷갈리는-구분'],
  ['USTRUCT', '34_ustruct_vs_uclass.md#2-두-매크로의-정의와-위치--uobject-기반-vs-비기반'],
  ['RB-Tree', '14_std_map.md#3-내부-동작--red-black-tree'],
  ['스케줄러', '21_context_switching.md#8-스케줄링-알고리즘과의-연관--선점형비선점형rr우선순위'],
  ['OOP', '04_oop.md#모의면접-답변--oop란-무엇인가요'],
  ['포인터 크기', '10_pointer_deepdive.md#2-포인터-메모리-크기--32비트-vs-64비트'],
  ['malloc', '03_new_vs_malloc.md#핵심-차이-4가지'],
  ['빙의', '35_gameplay_framework.md#3-possess-관계--영혼controller과-육체pawn'],
  ['메모리 단편화', '27_memory_fragmentation.md#2-단편화의-정의--가용-메모리가-충분한데-왜-못-받는가'],
  ['minor fault', '26_page_fault.md#41-minor-page-fault-soft-fault'],
  ['Replication', '38_unreal_replication.md#2-서버-권위-모델--권위는-서버-결과는-클라'],
  ['byte stream', '30_tcp_vs_udp.md#31-연결-지향connection-oriented의-의미'],
  // --- B군 68종 전수 판정(2026-08-05) ---
  // ①정상 65종. ②사전 제외 3종은 kwValid 의 복잡도 절단 규칙이 대신 막고, ③재타깃·④절 신설은 0종이었다.
  // 워커 2대가 착지 절 본문을 직접 열어 읽고 판정한 결과다. 여기 있는 동안 검사기는 이 65종을
  // 미도달로 세지 않는다 — 그래야 B군 수치가 "아직 판정 안 한 것" 이라는 뜻을 갖는다.
  ['동적 할당', '01_runtime.md#동적-메모리-할당-힙-vs-스택'],
  ['O(log n) 보장', '14_std_map.md#4-주요-연산과-시간-복잡도'],
  ['UClass 메타데이터', '33_uobject.md#4-uclass와-cdo--클래스-메타데이터와-기본값-템플릿'],
  ['UClass·CDO', '33_uobject.md#4-uclass와-cdo--클래스-메타데이터와-기본값-템플릿'],
  ['ConcRT/PPL', '21_context_switching.md#11-concurrency-runtime--ppl--사용자-모드-협력적-스케줄러'],
  ['프록시 복사', '42_unreal_thread_model.md#7-왜-프록시로-복사해-넘기나--race수명-안전'],
  ['Stroustrup', '13_vector_vs_list.md#6-5-vector-first-원칙'],
  ['MMU(Memory Management Unit)', '29_memory_hierarchy.md#6-주소-변환-계층--mmutlbpage-walk'],
  ['상태 복제', '38_unreal_replication.md#3-property-replication--지속-상태의-단방향-복제'],
  ['Fiber·UMS', '21_context_switching.md#12-fiber-api와-ums--커널-개입-없는-협력적-스위칭'],
  ['TSharedPtr 금지', '40_unreal_smart_pointer.md#8-경계선--uobject에-tsharedptr를-쓰면-안-되는-이유'],
  ['패딩·정렬', '02_class_vs_struct.md#q6-struct의-크기와-메모리-정렬-padding--alignment'],
  ['new/delete', '03_new_vs_malloc.md#핵심-차이-4가지'],
  ['캐시 라인 64B', '25_cache_hit_miss.md#6-캐시-라인--64바이트의-의미'],
  ['atomic 카운트', '11_smart_pointer.md#왜-atomic-인가'],
  ['lower/upper_bound', '17_find_vs_binary_search.md#5-관련-알고리즘-family--lower_bound--upper_bound--equal_range'],
  ['RAII 가드', '23_race_condition.md#45-raii-패턴--stdlock_guard--stdscoped_lock'],
  ['Authority/Autonomous/Simulated', '38_unreal_replication.md#7-role--authority--autonomousproxy--simulatedproxy'],
  ['상속 사다리', '43_actor_scene_primitive_component.md#2-상속-계층-다이어그램'],
  ['RB-Tree 5속성', '14_std_map.md#3-2-red-black-tree-의-5가지-속성'],
  ['UDP 표준', '30_tcp_vs_udp.md#10-게임-네트워킹에서-udp가-표준인-이유'],
  ['Character=Pawn 특수화', '35_gameplay_framework.md#5-character--pawn의-특수화'],
  ['C++ 연산자', '03_new_vs_malloc.md#보충-1--연산자operator란'],
  ['devirtualize', '05_vtable.md#성능-개선-방법'],
  ['명시적 스택 변환', '20_stack_overflow.md#해결책-5--명시적-스택-자료구조'],
  ['TaskGraph 워커', '42_unreal_thread_model.md#8-워커-스레드taskgraph와의-관계'],
  ['객체란', '04_oop.md#객체object란'],
  ['RPC 3종', '38_unreal_replication.md#5-rpc--server--client--netmulticast'],
  ['차이 배열', '45_algo_17_prefix_sum.md#차이점'],
  ['공유자원', '19_process_vs_thread.md#3-메모리-구조-비교--코드데이터힙스택과-pcbtcb'],
  ['레지스터는 메모리인가', '21_context_switching_followup.md#3-레지스터는-메모리일까요'],
  ['언리얼 LWC', '24_floating_point.md#11-언리얼에서의-실수-처리'],
  ['Swap·Thrashing', '26_page_fault.md#8-swap과-thrashing'],
  ['외부 vs 내부 단편화', '27_memory_fragmentation.md#3-외부-단편화-vs-내부-단편화'],
  ['언리얼 FMemory·FMemStack', '27_memory_fragmentation.md#11-언리얼의-단편화-관리--fmemoryfmemstacktobjectpool'],
  ['5-tuple ACL', '32_firewall.md#4-검사-단위--5-tuple-기반-acl-규칙'],
  ['정렬된 벡터 + 이진 탐색', '45_algo_05_map.md#차이점'],
  ['탑다운 vs 보텀업', '45_algo_13_dp_intro.md#차이점'],
  ['차이 배열(이모스 법)', '45_algo_17_prefix_sum.md#차이점'],
  ['C++ 연산자(operator)', '03_new_vs_malloc.md#보충-1--연산자operator란'],
  ['스택 해제', '09_rtti_raii.md#3-raii--resource-acquisition-is-initialization'],
  ['UPROPERTY 통합', '37_stdmap_vs_tmap.md#8-언리얼-통합--gc리플렉션uproperty메모리-지역성'],
  ['STL 컨테이너의 스레드 안전성', '16_stl_containers.md#스레드-안전성--stl-컨테이너의-동시-접근'],
  ['BSD socket API 호출 흐름', '31_socket.md#6-bsd-socket-api--서버클라이언트-호출-흐름'],
  ['세마포어(Semaphore)', '23_race_condition.md#52-semaphore-카운팅-락'],
  ['평균 지연', '25_cache_hit_miss.md#32-평균-메모리-접근-시간-amat'],
  ['Tick 그룹', '25_cache_hit_miss.md#143-tick-groupsbulk-tick'],
  ['swap·thrashing', '26_page_fault.md#8-swap과-thrashing'],
  ['미스 3C', '25_cache_hit_miss.md#4-캐시-미스의-3종-3c--4c'],
  // 슬러그 표기가 실제와 어긋나 있었다(하이픈 개수). canonToDom 폴백이 받아 착지는 맞았지만
  // 기록이 실물과 달라 검사기가 계속 "다른 절"로 잡았다 — 실제 슬러그로 교정(W56)
  ['SYN flood', 'CS_추가키워드_복습.md#tcp-3-way-handshake-30_tcp_vs_udpmd-31_socketmd'],
  ['TEXT() 매크로', '36_unreal_strings.md#8-인코딩--tchartextutf-816'],
  ['Server/Client/Multicast', '38_unreal_replication.md#5-rpc--server--client--netmulticast'],
  ['dynamic_cast의 비용', '39_rtti_cast.md#3-dynamic_cast의-동작과-비용'],
  ['펜스 동기화', '42_unreal_thread_model.md#6-세-스레드-간-데이터-흐름과-동기화-enqueue_render_command펜스'],
  ['0/1 배낭', '45_algo_14_dp_advanced.md#차이점'],
  ['GC와 이중 소유 충돌', '40_unreal_smart_pointer.md#8-경계선--uobject에-tsharedptr를-쓰면-안-되는-이유'],
  ['순수 가상 함수(pure virtual)', '08_vtable_deepdive.md#3-순수-가상-함수와-_purecall'],
  ['static binding', '05_vtable.md#정적-vs-동적-바인딩'],
  ['dynamic binding', '05_vtable.md#동적-디스패치-dynamic-dispatch'],
  ['TMap 내부', '37_stdmap_vs_tmap.md#5-tmap--해시-테이블tset-기반-평균-o1언리얼-통합'],
  ['레이스 컨디션 성립 조건', 'CS_추가키워드_복습.md#레이스-컨디션의-성립-조건-23_race_conditionmd'],  // 같은 이유로 슬러그 교정(W56)
  ['동적 바인딩 (Dynamic Binding)', '05_vtable.md#동적-디스패치-dynamic-dispatch'],
  ['STL 4대 분류', '16_stl_containers.md#2-stl-컨테이너-4대-분류'],
  ['시간 복잡도란', '13_vector_vs_list.md#3-0-시간-복잡도big-o란'],
  ['데드락 4조건', '23_race_condition.md#9-deadlock--발생-4조건과-회피-전략'],
  // W54 — 사용자가 "RAII 래퍼와 함께가 뭔 소린지 모르겠다"고 지적한 자리(23번 §5.1 표).
  // 발행본을 열어 보니 그 칸의 `RAII` 는 **이미 링크가 걸려 있고**(09번 §3) 착지도 맞다.
  // 변형도 다 사전에 있다 — `RAII 패턴`→10번 §⑤ · `RAII 가드`→23번 §4.5.
  // `RAII 래퍼` 만 사전에 없지만 `RAII` 가 그 안에서 먼저 잡히므로 링크는 이미 붙는다.
  // 09번 §3 은 개념 정의(생성자에서 얻고 소멸자에서 놓기)이고, 09번 §lock_guard 는 예시라
  // "RAII 가 뭔가"에 답하는 자리는 §3 이 맞다. 추가하지 않는다.
  ['RAII', '09_rtti_raii.md#3-raii--resource-acquisition-is-initialization'],
  // W56 — KW_ALIAS 에서 옮겨 왔다. 04번 §추상화 의 `### 정의` 가 "순수 가상 함수(= 0)로 추상
  // 클래스를 만든다"라고 정의하고 그 아래 소절이 추상 클래스 vs 인터페이스 비교표다.
  // 08번 §순수 가상 함수가 자식 클래스에 남기는 문제 는 정의가 아니라 함정을 다룬다.
  ['추상 클래스', '04_oop.md#추상-클래스-vs-인터페이스'],
];
void KW_KEEP;  // 빌드 동작에는 쓰이지 않는다 — 검사기가 소스에서 읽어 가는 판정 기록이다

const KW_RETARGET = [
  // 검색 즉답이 Q6("스택 오버플로와 버퍼 오버플로의 차이는?")로 가고 있었다(2026-08-06 사용자 지적).
  // Q6 제목에 표면형이 글자 그대로 들어 있어 이겼다. 그건 Q&A 절 강등 규칙으로 따로 고쳤다.
  // **이 표면형은 문서 전체의 주제라 한 절이 아니라 전체 그림이 답이다** — 종합 요약으로 보낸다.
  //
  // 아래 세 줄을 한꺼번에 적지 마라. 같은 배열에 `스택 오버플로우`·`Stack Overflow` 를 §2 로
  // 보내는 줄이 이미 있고(뒤에 오는 쪽이 이긴다) 그걸 모르고 덮어썼다가 되돌렸다.
  // **세 표기가 다른 곳으로 가는 것은 의도다** — 한글 짧은 표기는 문서 주제라 종합 요약으로,
  // `스택 오버플로우`·`Stack Overflow` 는 이미 §2 정의 절로 판정돼 있어 그대로 둔다.
  ['스택 오버플로', '20_stack_overflow.md#모의면접-답변--스택-오버플로란-무엇인가요'],
  // `TArray<TCHAR>` 는 절을 만들 자리가 아니라 **재타깃 자리**였다(2026-08-05).
  // 검사기가 "절 신설" 후보로 올렸지만 정본은 `36_unreal_strings §3` 이다 —
  // 거기가 "FString의 성질은 내부가 TArray<TCHAR>라는 한 줄에서 거의 다 나옵니다" 라고 세운다.
  // `13_vector_vs_list §7`(TArray vs STL)로 가고 있었는데 거긴 컨테이너 비교지 문자열 이야기가 아니다.
  ['TArray<TCHAR>', '36_unreal_strings.md#3-fstring--가변동적-문자열-조작'],
  // 캐시 히트가 주제 카드로 가서 원본 대신 상위 화면이 열렸다 — 사용자 지적
  ['캐시 히트', '25_cache_hit_miss.md#3-캐시-히트와-미스의-본질'],
  ['캐시 히트/미스', '25_cache_hit_miss.md#3-캐시-히트와-미스의-본질'],
  // 가상 메모리 정본은 29 §7. 26 §2(페이지 폴트의 정의)로 가고 있었다 — 사용자 지적
  ['가상 메모리', '29_memory_hierarchy.md#7-가상-메모리--dram과-디스크의-통합'],
  ['가상메모리', '29_memory_hierarchy.md#7-가상-메모리--dram과-디스크의-통합'],
  // 카드 제목의 괄호 병기(`05. vtable (가상함수 테이블)`)가 사전을 가져가 검색 즉답이
  // 카드로 갔다. 정의 절이 따로 있으니 그쪽으로 돌린다 — 검색 실측 미달 3건 중 1건
  ['가상 함수 테이블', '05_vtable.md#vtable이란'],
  ['가상함수 테이블', '05_vtable.md#vtable이란'],
  // 같은 이유 — 카드가 사전을 가져가던 2건. 정의 절이 없던 파일이라 §1 을 새로 세우고 돌린다
  ['스마트 포인터', '11_smart_pointer.md#1-스마트-포인터란--소유권을-타입으로-표현한-포인터'],
  ['메모리 배리어', '44_memory_barrier.md#1-메모리-배리어란--재배치를-막는-선'],
  ['Memory Barrier', '44_memory_barrier.md#1-메모리-배리어란--재배치를-막는-선'],
  // B군 101종 전수 판정(2026-08-04) — 절은 이미 있는데 다른 절로 가고 있던 8종.
  ['atomic 연산', '23_race_condition.md#62-atomic--단일-명령-동기화'],          // 11번은 refcount 한정
  ['스택 오버플로우', '20_stack_overflow.md#2-한-줄-정의--stack-overflow란-무엇인가'],  // 원인 목록 → 정의
  ['스택오버플로우', '20_stack_overflow.md#2-한-줄-정의--stack-overflow란-무엇인가'],
  ['Unreliable RPC', '38_unreal_replication.md#reliable--rpc-실행-보장-지정-vs-unreliable'], // §5는 3종 분류만
  ['언리얼 스레드 모델', '42_unreal_thread_model.md#9-비교-표-총정리'],          // §6은 모델의 한 측면
  ['캐시 적중률', '25_cache_hit_miss.md#33-히트율--9599가-목표'],               // §7 지역성엔 적중률 언급 없음
  ['스택 vs 큐', '45_algo_03_stack_queue.md#차이점'],                          // 탐색 비교표 한 행 → 정본 비교표
  ['AActor/UObject', '33_uobject.md#8-uobject-vs-aactor-vs-uactorcomponent--위치-관계'],
  // 같은 걸 두 곳에서 배우게 하지 않는다 — 복습본 절 대신 23 §9 로 모은다 (사용자 결정)
  ['데드락 4대 조건', '23_race_condition.md#9-deadlock--발생-4조건과-회피-전략'],
  // ── 카드 착지 교정 (2026-08-05) ──
  // 사전이 절이 아니라 **주제 카드**로 보내던 표면형 67종 / 924건 중 상위분.
  // 카드는 목차다 — 누르면 설명이 나와야 하는 용어가 카드로 가면 사용자는 설명을 못 만난다.
  // 사용자가 겪은 "해시를 눌렀더니 설명이 없다"가 정확히 이것이었다.
  // 후보는 검색이 같은 질의에 고르는 절에서 뽑되, **종마다 열어 확인했다** —
  // 검색이 틀린 것도 있었다(`RB-Tree`→회전 문답, `virtual 소멸자`→03번 곁가지).
  ['해시', '14_std_map_followup.md#11-해시hash-가-뭔가--버킷bucket-이-뭔가'],
  ['UObject', '33_uobject.md#2-uobject의-정의와-위치--언리얼의-최상위-베이스'],
  ['vtable', '05_vtable.md#vtable이란'],
  ['std::map', '14_std_map.md#모의면접-답변--stdmap-은-어떻게-동작하나요'],
  ['IPC', '22_ipc.md#2-한-줄-정의--ipc란-무엇이고-왜-필요한가'],
  ['미스', '25_cache_hit_miss.md#3-캐시-히트와-미스의-본질'],   // 검색은 §4(3종)를 골랐으나 정의는 §3
  ['페이지 폴트', '26_page_fault.md#2-페이지-폴트의-정의--가상-메모리에서-무엇이-일어나는가'],
  ['virtual 소멸자', '06_virtual_destructor.md#해결책--virtual-소멸자'],  // 검색은 03번 곁가지를 골랐다
  ['race condition', '23_race_condition.md#2-한-줄-정의--race-condition이란-무엇인가'],
  ['Race Condition', '23_race_condition.md#2-한-줄-정의--race-condition이란-무엇인가'],
  ['RB-Tree', '14_std_map.md#3-내부-동작--red-black-tree'],   // 검색은 §8-2(회전 문답)를 골랐다
  // 45_algo 계열은 그 주제의 정본이 거기뿐이라 분기가 필요 없다. 문서 최상단(H1) 대신 `#정의` 로
  // 보낸다 — 8단 골격이라 정의 바로 아래에서 차이점·동작·활용을 순서대로 만난다.
  ['이진 탐색', '45_algo_09_binary_search.md#정의'],
  ['다익스트라', '45_algo_20_dijkstra.md#정의'],
  // 카드 착지 2차분 — 검색 후보를 쓰되 종마다 열어 확인했다. 검색이 곁가지를 고른 7건은 손으로 잡았다.
  ['방화벽', '32_firewall.md#2-방화벽의-정의와-목적--신뢰-경계의-문지기'],   // 검색 일치
  ['누적합', '45_algo_17_prefix_sum.md#정의'],   // H1 → 정의 절로
  ['완전 탐색', '45_algo_10_brute_force.md#정의'],   // H1 → 정의 절로
  ['그리디', '45_algo_12_greedy.md#정의'],   // H1 → 정의 절로
  ['백트래킹', '45_algo_11_backtracking.md#정의'],   // H1 → 정의 절로
  ['슬라이딩 윈도우', '45_algo_16_sliding_window.md#정의'],   // H1 → 정의 절로
  ['투 포인터', '45_algo_15_two_pointers.md#정의'],   // H1 → 정의 절로
  ['동적 배열', '16_stl_containers.md#31-stdvector--연속-메모리-동적-배열'],   // 검색 일치
  ['socket', '31_socket.md#2-socket의-정의와-역할--endpoint-추상화'],   // 검색 일치
  ['Socket', '31_socket.md#2-socket의-정의와-역할--endpoint-추상화'],   // 검색 일치
  ['메모리 단편화', '27_memory_fragmentation.md#2-단편화의-정의--가용-메모리가-충분한데-왜-못-받는가'],   // 검색 일치
  ['UActorComponent', '43_actor_scene_primitive_component.md#31-uactorcomponent--transform-없는-기능-단위'],   // 검색 일치
  ['Stack Overflow', '20_stack_overflow.md#2-한-줄-정의--stack-overflow란-무엇인가'],   // 검색 일치
  ['인라인 함수', '08_vtable_deepdive.md#인라인-함수-inline'],   // 검색 일치
  ['inline', '08_vtable_deepdive.md#인라인-함수-inline'],   // 검색은 키워드-보강 문서를 골랐다
  ['언리얼 스마트 포인터', '11_smart_pointer.md#8-언리얼에서의-스마트-포인터'],   // 검색 일치
  ['TCP vs UDP', '30_tcp_vs_udp.md#3-tcp--연결-지향과-신뢰성'],   // 검색은 31번 §5 를 골랐다
  // `tcp udp` 로 검색하면 22번 §10.3 `TCP/UDP — 네트워크 가능`(IPC 수단 목록의 한 줄)이
  // 즉답이었다 — 사용자 지적. 그 헤딩 제목만 canonKey 가 `tcpudp` 로 딱 떨어져 사전을 가져갔고,
  // 30번에는 제목이 `tcpudp` 로 떨어지는 절이 없어 경쟁 자체가 안 됐다(`8. TCP·UDP 핵심 차이
  // 비교표`는 `tcpudp핵심차이비교표`). **이 표면형은 30번 문서 전체의 주제라 한 절이 아니라
  // 전체 그림이 답이다** — `스택 오버플로` 와 같은 근거로 문서 상단 답변으로 보낸다.
  ['TCP/UDP', '30_tcp_vs_udp.md#모의면접-답변'],
  ['vector vs list', '13_vector_vs_list.md#2-메모리-레이아웃-차이'],   // 검색은 25번 §8.1 을 골랐다
  // `vector list` 검색이 §5-1(iterator 무효화 규칙)로 갔다 — 사용자 지적. 원인은 헤딩이 아니라
  // **명시 링크의 텍스트**다: `CS_추가키워드_복습.md:144` 의 `[vector/list →]` 가 pri 1 로
  // 사전에 등록되면서 canonKey `vectorlist` 슬롯을 그 곁가지 절로 가져갔다.
  // 바로 위 `vector vs list` 와 같은 자리로 맞춘다 — 두 표기가 다른 곳에 서면 안 된다.
  ['vector/list', '13_vector_vs_list.md#2-메모리-레이아웃-차이'],
  ['프로세스 vs 스레드', '19_process_vs_thread.md#3-메모리-구조-비교--코드데이터힙스택과-pcbtcb'],   // 검색은 21번 §7 을 골랐다
  ['프로세스 간 통신', '22_ipc.md#2-한-줄-정의--ipc란-무엇이고-왜-필요한가'],   // 검색은 19번 Q1 을 골랐다
  ['new vs malloc', '03_new_vs_malloc.md#핵심-차이-4가지'],   // 검색은 19번 복기 절을 골랐다
  ['class vs struct', '02_class_vs_struct.md#상세-비교'],   // 검색은 34번 §10.2 를 골랐다
  ['게임플레이 프레임워크', '35_gameplay_framework.md#2-다섯-클래스의-책임--누구의-무엇인가'],   // 검색은 36번 §10.3 을 골랐다
  // 카드 착지 3차 — `00_index § 하위 페이지 목록` 으로 가던 것들. 색인 목록은 카드보다 나쁜 착지다
  ['객체 복사 방지', '12_prevent_copy.md#2-왜-복사를-막아야-하는가'],
  ['std::map (RB-Tree)', '14_std_map.md#모의면접-답변--stdmap-은-어떻게-동작하나요'],
  ['32비트 vs 64비트 OS', '28_os_32bit_vs_64bit.md#2-워드-크기와-시스템-폭의-의미'],
  ['C++ RTTI vs 언리얼 RTTI', '39_rtti_cast.md#2-c-표준-rtti--vtable-옆-type_info'],
  // 카드 착지 4차 — 남은 것 중 정본이 분명한 것들. 문서 H1·발표 대본·복습본으로 가던 것을 정본 절로
  ['부동소수점', '24_floating_point.md#2-ieee-754--부호지수가수'],
  ['Context Switching', '21_context_switching.md#2-한-줄-정의--컨텍스트-스위칭이란-무엇인가'],
  ['vtable 심화', '08_vtable_deepdive.md#2-vtable은-객체마다-클래스마다'],
  ['포인터 심화', '10_pointer_deepdive.md#2-포인터-메모리-크기--32비트-vs-64비트'],
  ['push_back vs emplace_back', '15_pushback_vs_emplaceback.md#2-내부-동작--가변-템플릿--perfect-forwarding'],
  ['std::find vs std::binary_search', '17_find_vs_binary_search.md#2-stdfind--선형-탐색'],
  ['메모리 계층 구조', '29_memory_hierarchy.md#2-왜-계층이-필요한가--속도용량가격의-트레이드오프'],
  ['USTRUCT vs UCLASS', '34_ustruct_vs_uclass.md#2-두-매크로의-정의와-위치--uobject-기반-vs-비기반'],
  ['언리얼 String 3종', '36_unreal_strings.md#2-세-타입의-역할--조작--식별--표시'],
  ['언리얼 Replication', '38_unreal_replication.md#2-서버-권위-모델--권위는-서버-결과는-클라'],
  ['언리얼 멀티스레드', '42_unreal_thread_model.md#2-왜-렌더링을-멀티스레드로-분리하나--파이프라이닝'],
  // 문서 최상단(H1) 착지 교정 — H1 은 그 용어가 문서 어디에 있는지 알려 주지 않는다.
  // 약한 통과 중 `[최상단]` 360건의 주력 5종(2026-08-05 실측).
  ['런타임', '01_runtime.md#모의면접-답변--런타임이란-무엇인가요'],
  ['rehash', '15_hash_rehash_followup.md#3-rehash--임계값-초과-시-자동-재해싱'],
  ['시퀀스', '16_stl_containers.md#3-시퀀스-컨테이너--vector--deque--list--forward_list--array'],
  ['push_back', '15_pushback_vs_emplaceback.md#1-push_back-vs-emplace_back--핵심-차이'],
  ['OOP', '04_oop.md#모의면접-답변--oop란-무엇인가요'],
  // 약한 통과 판정(2026-08-05) — 30종 중 재타깃 2종. 나머지 27종은 KW_KEEP 으로
  ['BFS', '45_algo_19_dfs_bfs.md#정의'],   // 판별 기준 절은 선택 체크리스트라 BFS 가 뭔지 안 말한다
  // 문맥 분기를 재 봤더니 분기가 필요 없었다(2026-08-05 실측).
  //   `map`    67건 중 45_algo 문서 안에서 걸리는 것 **0건** (14_std_map 안에서만 30건)
  //   `vector` 147건 중 45_algo 안 **0건** (13_vector_vs_list 안에서만 49건)
  // 전량이 C++ 문서에서 걸리므로 C++ 정본으로 통일한다. 45_algo 독자를 해치지 않는다 —
  // 그쪽 문서 안에서는 애초에 이 표면형이 안 걸린다.
  // 그 전까지는 14_std_map 을 읽다 `map` 을 누르면 45_algo 두 문장짜리 정의로 튕겨 나갔다.
  ['map', '14_std_map.md#모의면접-답변--stdmap-은-어떻게-동작하나요'],
  ['vector', '13_vector_vs_list.md#2-메모리-레이아웃-차이'],
  // 동음이의 6종 판정(2026-08-05) — 뜻 분포를 원문에서 세고 3종만 재타깃, 3종은 그대로 뒀다.
  // 재할당 — 링크가 걸리는 자리 약 175건이 컨테이너 용량 초과 재할당인데 착지는 포인터 재대입이었다.
  //   포인터 뜻은 16건이고 그중 15건이 착지 파일 자신이라 애초에 링크가 억제된다.
  //   문서 5곳이 이미 수동으로 아래 절을 정본이라 가리키고 있다.
  ['재할당', '15_pushback_vs_emplaceback.md#5-vector-capacity-와-재할당-rehash-와-비교'],
  // STL — 원문 160건이 전부 "C++ 표준 라이브러리" 일반인데 해시 충돌 정책 절로 가고 있었다
  ['STL', '16_stl_containers.md#2-stl-컨테이너-4대-분류'],
  // 체이닝 — 79건 전부 해시 충돌 해결 뜻인데 같은 파일의 **삭제** 하위절로 가고 있었다.
  //   뜻이 갈리는 게 아니라 정의 절(§6)을 두고 곁가지로 간 것이다
  ['체이닝', '15_pushback_vs_emplaceback.md#6-해시-충돌-처리--체이닝-separate-chaining'],
  ['FIN', '31_socket.md#11-tcp-소켓-상태-머신과-netstat'],   // 30 §3.2 가 스스로 31 §11 을 정본이라 선언한다
  // A군 확인분 — 30 §11(언리얼 Replication·RPC 모델 개요)이 아니라 신뢰성 지정자 정본으로
  ['Reliable RPC', '38_unreal_replication.md#reliable--rpc-실행-보장-지정-vs-unreliable'],
  // W48 실측 — 페이지 워크·MMU 전용 절이 따로 있는데 상위 절로 가던 것
  ['페이지 테이블 워크', '26_page_fault.md#페이지-워크page-walk란'],
  ['페이지 워크', '26_page_fault.md#페이지-워크page-walk란'],
  ['MMU', '29_memory_hierarchy.md#60-mmu란--주소-변환을-담당하는-하드웨어'],
  ['Memory Management Unit', '29_memory_hierarchy.md#60-mmu란--주소-변환을-담당하는-하드웨어'],
  // W41 신설 절 (트리·이벤트·Transform) + 오착지 교정
  ['리해시', '15_hash_rehash_followup.md#3-rehash--임계값-초과-시-자동-재해싱'],
  ['렌더', '42_unreal_thread_model.md#4-renderthread--어떻게-그릴지-드로우콜-생성-1프레임-뒤'],
  ['이벤트', '41_unreal_delegate.md#이벤트event--무슨-일이-일어났다는-통지'],
  ['Transform', '43_actor_scene_primitive_component.md#transform트랜스폼--위치회전스케일-한-묶음'],
  ['트랜스폼', '43_actor_scene_primitive_component.md#transform트랜스폼--위치회전스케일-한-묶음'],
  // W39 신설·개제 절 — 키워드가 그 용어를 설명하는 절로
  ['링크', '01_runtime.md#링크-link--링크-타임에-벌어지는-일'],
  ['링크 타임', '01_runtime.md#링크-link--링크-타임에-벌어지는-일'],
  ['Segmentation Fault', '01_runtime.md#segmentation-fault-segfault'],
  ['segfault', '01_runtime.md#segmentation-fault-segfault'],
  ['정의되지 않은 동작', '01_runtime.md#정의되지-않은-동작-undefined-behavior-ub'],
  ['인스턴스', '04_oop.md#인스턴스-instance'],
  ['decay', '07_pointer_reference.md#배열-포인터-감쇠-decay'],
  ['포인터 산술', '07_pointer_reference.md#포인터-산술-pointer-arithmetic'],
  ['참조 카운팅', '11_smart_pointer.md#참조-카운팅-동작--참조-카운트가-오르내리는-시점'],
  ['Tick', '05_vtable.md#beginplay--tick--aactor의-주요-가상-함수'],
  ['BeginPlay', '05_vtable.md#beginplay--tick--aactor의-주요-가상-함수'],
  ['얕은 복사', '12_prevent_copy.md#얕은-복사와-깊은-복사'],
  // W40 신설 정본 절 — 키워드가 그 용어를 설명하는 절로 가게
  ['캐시 친화성', '25_cache_hit_miss.md#캐시-친화성-cache-friendliness'],
  ['버퍼', '22_ipc.md#버퍼-buffer'],
  ['캐시 지역성', '25_cache_hit_miss.md#7-지역성--temporalspatial'],
  // 66건이 13_vector_vs_list §7-2(vector 원소의 GC 통합 예시)로 갔다. 정본은 33_uobject 의 신설 절
  ['UPROPERTY', '33_uobject.md#uproperty'],
  // 290건 중 alignment 문맥은 25·27번 22건뿐, 나머지는 전부 sorting(18_list_sort·37_stdmap·14_std_map…)
  ['정렬', '45_algo_07_sorting.md#정의'],
  // 105건 중 메모리 페이지가 26_page_fault:38 · 29:14 · 27:12 — padding 단위 절이 아니라 페이지 정의로
  ['페이지', '26_page_fault.md#페이지와-프레임'],
  // 78건 거의 전부 C++ 예외(bad_alloc·bad_cast·예외 안전성·stack unwinding) — dynamic_cast 비용 절이 아니다
  ['예외', '09_rtti_raii.md#문제-예외-발생-시-자원-누수'],
  // 116건이 22_ipc:26 · 32_firewall:19 · 31_socket:14 · 30_tcp:8 — USTRUCT NetSerialize 절과 무관
  ['네트워크', '30_tcp_vs_udp.md#네트워크-network'],
  // 84건 전량이 §16 언리얼 절로 갔다. 산문 170회의 절반이 21번 자기 문서고 나머지는
  // 22_ipc:17 · 23_race:17 · 19_process:15 — GameThread/RenderThread 얘기가 아니라 개념 자체다
  ['컨텍스트 스위칭', '21_context_switching.md#2-한-줄-정의--컨텍스트-스위칭이란-무엇인가'],
  // 163건이 12_prevent_copy 의 RAII 절(소켓은 거기서 "단독 소유 자원" 예시일 뿐)로 갔다.
  // 산문 276회 중 31_socket:109 · 22_ipc:28 · 22_ipc_followup:23 — 정본은 31번 정의 절
  ['소켓', '31_socket.md#2-socket의-정의와-역할--endpoint-추상화'],
  // 115건이 22_ipc 의 소켓 절로 갔다. 산문 263회 중 30_tcp_vs_udp:87 · 31_socket:75 ·
  // 32_firewall:35 — 소켓 API 절이 아니라 프로토콜 정본이 받아야 한다
  ['TCP', '30_tcp_vs_udp.md#3-tcp--연결-지향과-신뢰성'],
  // 6차 — _work/done-W33.txt. TCP 만 옮겨 비대칭이 됐던 짝을 맞춘다.
  // 82건 전량이 22_ipc 의 "10. 소켓 — Unix Domain/TCP/UDP/Winsock" 절로 갔다. 그 절은 소켓
  // 종류 나열이지 UDP 정의가 아니다. 실제 링크 위치는 30_tcp_vs_udp:48 · 31_socket:20 ·
  // 32_firewall:4 — 전부 프로토콜 문맥. TCP 가 간 §3 과 짝인 §4 가 정본이다.
  ['UDP', '30_tcp_vs_udp.md#4-udp--비연결과-단순성'],
  // 79건 전량이 12_prevent_copy §6.2 로 갔다. 그 문서는 복사 금지가 주제고 mutex 는 거기서
  // "복사 불가 자원" 예시일 뿐이다(163건이 같은 파일로 빨리던 '소켓'과 같은 유형).
  // 실제 링크 위치는 23_race_condition:33 · 19_process_vs_thread:19 · 21_context:8 —
  // 배타적 락 개념 문맥이다. mutex 를 배타적 락으로 정의하는 절은 23번 §5.1 하나뿐이다.
  ['mutex', '23_race_condition.md#51-mutex-배타적-락'],
  // 5차 — _work/done-W28.txt. 발행본 링크 위치 전수 집계로 뜻이 하나로 모이는 것만 옮겼다.
  // 132건이 45_algo_05_map 의 "map vs unordered_map 비교표"로 갔다. 그 절은 트리를 설명하지
  // 않는다. 실제 링크 위치는 14_std_map:22 · 37_stdmap:18 · 14_std_map_followup:10 ·
  // 16_stl:7 — 전부 RB 트리 높이·회전·재색칠 문맥이다. 정본은 14번 §3 내부 동작.
  ['트리', '14_std_map.md#트리tree--사이클-없는-연결-그래프'],
  // 53건이 32_firewall 의 ACL 규칙 절로 갔다. 실제 위치는 31_socket:22 · 30_tcp:19 ·
  // 32_firewall:7 이고 문맥은 "IP 주소"·"(IP, Port)"·"IP 헤더" — 방화벽 검사 단위가 아니다.
  // "IP — 호스트 식별. IPv4 32비트" 라고 못 박은 절이 31번 §3 하나뿐이다.
  ['IP', '31_socket.md#3-socket의-구성-요소--ipport5-tuple'],
  // 30건 중 26건이 44_memory_barrier 안에서 23_race_condition §7 로 튕겨 나갔다.
  // 23번 §7 은 44번으로 승격되기 전의 자리다(44번 §1 학습영역에 승격 사실 명시).
  ['배리어', '44_memory_barrier.md#4-배리어-종류--acquirereleasefull'],
  // 26건이 슬라이딩 윈도우 비교표로 갔다. 실제 문맥은 전량 최단 거리·최단 경로(45_algo_19:7 ·
  // CS_추가키워드_복습:7 · 45_algo_20:3) — 이미 등록된 '최단 경로'와 같은 정본으로 보낸다.
  ['최단', '45_algo_20_dijkstra.md#정의'],
  // W49 — _work/링크-의미검증.json 의 (A)군. 그 용어를 **제목으로 내건 절이 이미 있는데** 상위 절·이웃 절로
  // 가던 것만 옮긴다. `better` 후보를 그대로 쓰지 않고 산문 등장 분포를 실측해 문맥이 맞는 것만 골랐다.
  // 산문 18회 중 20_stack_overflow 는 1회뿐이지만 "스택 프레임"을 제목으로 다루는 절은 여기 하나다
  ['스택 프레임', '20_stack_overflow.md#스택-프레임-한-개의-구조'],
  // "플랫폼별 스택 크기"는 스택 한도 얘기지 고정 크기 자료구조가 아니다. std::array 절이 그 용어의 정본
  ['고정 크기', '16_stl_containers.md#35-stdarrayt-n--고정-크기-스택-배열'],
  ['고정 크기 스택', '16_stl_containers.md#35-stdarrayt-n--고정-크기-스택-배열'],
  // 14_std_map §4-4 는 hint 삽입 얘기고 이 용어를 **정의**하는 절은 15번 Q10 하나다("가끔 비싼 연산이
  // 평균으로 묻히는 분석 기법"). 13_vector_vs_list §2-4(성장 인자)로 가던 것을 정의 절로 보낸다
  ['amortized O(1)', '15_pushback_vs_emplaceback.md#q10-amortized-o1-이란'],
  // ('amortized O' 는 절단 조각이라 kwValid 가 막는다 — 완전형 'amortized O(1)' 만 남긴다)
  // 산문 17회 중 21_context_switching:11 — 발생 시점 4가지 나열 절이 아니라 타이머 전용 절이 정본
  ['타이머 인터럽트', '21_context_switching.md#발생-시점-1--타이머-인터럽트-timer-interrupt'],
  // 산문 35회 중 43번:26. "각 컴포넌트의 역할"이 아니라 부착 계층을 제목에 건 §3.2 가 정본
  ['부착', '43_actor_scene_primitive_component.md#32-uscenecomponent--transform과-부착-계층'],
  ['lock-free 자료구조', '23_race_condition.md#66-lock-free-자료구조의-예--스택'],
  // 이미 등록된 '포인터 산술'과 같은 절로. 산문 14회 중 07_pointer_reference:7
  ['산술', '07_pointer_reference.md#포인터-산술-pointer-arithmetic'],
  // §5 동기화 객체 카탈로그는 Mutex·Semaphore·CS·SRWLock·Event·CV 만 나열한다 — spin lock 이 없다
  ['spin lock', '23_race_condition.md#q10-spin-lock스핀락과-mutex뮤텍스-중-무엇이-더-좋나요'],
  ['vector·deque', '16_stl_containers.md#3-시퀀스-컨테이너--vector--deque--list--forward_list--array'],
  // 41번 §3 은 Single/Multi/Dynamic 3종 비교 절이다. Broadcast·Execute 를 제목에 건 §6 이 정본
  ['Broadcast', '41_unreal_delegate.md#6-broadcast-vs-execute-vs-executeifbound'],
  ['Execute', '41_unreal_delegate.md#6-broadcast-vs-execute-vs-executeifbound'],
  ['Dynamic 델리게이트', '41_unreal_delegate.md#10-일반-델리게이트-vs-dynamic-델리게이트--성능은-어느-게-느린가'],
  // '정적 바인딩'이 이미 가 있는 절 — 짝을 맞춘다
  ['동적 바인딩', '05_vtable.md#정적-vs-동적-바인딩'],
  ['이중 연결 리스트', '16_stl_containers.md#33-stdlist--이중-연결-리스트'],
  ['뮤텍스(Mutex)', '23_race_condition.md#뮤텍스mutex와-뮤텍스-api--소유권-있는-상호-배제-락'],
  // W53 — 'mutex'(위)를 옮길 때 같은 근거가 그대로 걸리는 한글 표기를 빠뜨렸다. canonKey 가 달라
  // ('mutex' · '뮤텍스mutex' · '뮤텍스') 세 항목이 따로 논다. 79건과 같은 이유로 12_prevent_copy
  // §6(복사 금지 예시 나열)이 아니라 뮤텍스를 정의하는 절이 정본이다.
  ['뮤텍스', '23_race_condition.md#뮤텍스mutex와-뮤텍스-api--소유권-있는-상호-배제-락'],
  // 헤딩 표면형 `unordered_*`(14번 §6 컨테이너 나열)가 canonKey 'unordered' 자리를 먹고 있었다.
  // 비순서 컨테이너를 **정의**하는 절은 16번 §5 하나뿐이다(정의 구획 보유).
  ['unordered_*', '16_stl_containers.md#5-비순서-연관-컨테이너--unordered_set--unordered_map-해시'],
  ['DGRAM', '31_socket.md#42-sock_dgram-udp-소켓'],
  ['vtable 옆 type_info', '39_rtti_cast.md#2-c-표준-rtti--vtable-옆-type_info'],
  ['댕글링 레퍼런스', '10_pointer_deepdive.md#케이스-1--댕글링-레퍼런스-dangling-reference'],
  ['비순서 연관', '16_stl_containers.md#5-비순서-연관-컨테이너--unordered_set--unordered_map-해시'],
  ['map vs unordered_map', '14_std_map.md#8-1-map-vs-unordered_map-언제-어떤-걸'],
  ['클래스당 1개', '08_vtable_deepdive.md#왜-클래스당-1개인가'],
  // ── W54 (2026-08-05) — 사용자 실기 지적분 중 **표기는 맞는데 착지가 곁가지**이던 것 ──
  // 모드 스위치: 21번 §6 "비용 요소 5 — 커널 진입(모드 스위치) 자체 비용"으로 가고 있었다.
  // 그 절은 100~500ns 라는 비용만 말한다. 모드 스위치가 무엇인지 정의하는 절은 §5 하나다
  // ("모드 스위치는 같은 스레드가 user/kernel 모드를 오가는 것" + 컨텍스트 스위치와의 대조표).
  ['모드 스위치', '21_context_switching.md#5-모드-스위치--컨텍스트-스위치--자주-헷갈리는-구분'],
  // TLB flush: 21번 §6(비용 요소 묶음 절)과 25번 §12(TLB) 양쪽을 읽고 21번 §6 의 하위절로 좁혔다.
  //   25 §12 는 **TLB** 를 정의한다 — "가상 주소를 물리 주소로 바꾼 결과를 담아 두는 전용 캐시".
  //     flush 라는 말이 그 절에 아예 없다. `TLB`(단독)는 이미 거기로 가 있고 그게 맞다.
  //   21 §6 부모 절은 다섯 비용 요소를 묶은 표라 flush 자체는 한 행뿐이다.
  //   21 §6 의 `비용 요소 3 — TLB Flush` 만이 flush 를 설명한다 — 프로세스가 바뀌면 가상 주소
  //     공간이 달라 캐시를 무효화해야 한다는 이유, 그 뒤 페이지 테이블 워크, PCID/ASID 회피,
  //     "스레드 전환엔 flush 없음"까지. 무효화 사건을 다루는 자리는 코퍼스에 여기뿐이다.
  ['TLB flush', '21_context_switching.md#비용-요소-3--tlb-flush-프로세스-전환에서만'],
  // PCB·TCB: 19번 §3 은 메모리 4영역 비교가 주제고 PCB/TCB 는 그 안의 비교표 한 칸이다.
  // 21번 §4 는 "PCB 와 TCB 는 OS 가 프로세스·스레드의 상태를 적어 두는 커널 자료구조"라고
  // 정의하고 무엇이 어느 쪽에 담기는지(PC·SP·GPR·FPU→TCB, CR3·핸들 테이블·보안 토큰→PCB)까지 준다.
  ['PCB', '21_context_switching.md#4-pcbtcb-저장복원-단계--무엇을-어디에-저장하나'],
  ['TCB', '21_context_switching.md#4-pcbtcb-저장복원-단계--무엇을-어디에-저장하나'],
  // 단편화(산문 183회): 27번 §3(외부 vs 내부 비교)로 가고 있었다. 이미 `메모리 단편화`가 가 있는
  // §2 가 정의 절이다("가용 메모리가 충분한데 왜 못 받는가"). 홑낱말만 비교표로 새고 있었다.
  ['단편화', '27_memory_fragmentation.md#2-단편화의-정의--가용-메모리가-충분한데-왜-못-받는가'],
  // ── W55 (2026-08-05) — 헤딩에서 유도된 표면형이 곁가지 절을 물고 있던 것 ──
  // 오버로딩: 03번 헤딩 `operator new (오버로딩)` 의 괄호 안쪽이 사전을 가져가, **함수 오버로딩**을
  //   물어도 연산자 오버로딩 절이 열렸다. 04번 §다형성 이 정본이다(오버라이딩과 같은 자리).
  //   03번 문서 안에서는 뜻이 정말 operator new 쪽이라 KW_RETARGET_IN 으로 따로 갈랐다.
  ['오버로딩', '04_oop.md#다형성-polymorphism'],
  // virtual: 03번 `보충 3 — virtual과 override` 의 **하위 소절** `#### virtual`(불릿 목록)로 가고
  //   있었다. 정의 절은 그 부모 절에 있다 — "virtual 은 부모가 '이 함수는 자식이 갈아끼울 수
  //   있다'고 허락하는 키워드". 05번은 vtable·vptr·동적 디스패치를 정의할 뿐 `virtual` 키워드
  //   자체를 정의하는 절이 없어(§키워드 목록에도 없다) 정본이 될 수 없다. 파일은 그대로 두고
  //   착지만 정의 절이 있는 부모 절로 올린다.
  ['virtual', '03_new_vs_malloc.md#보충-3--virtual과-override'],
];
for (const [surface, url] of KW_RETARGET) {
  const e = kwDict.get(canonKey(surface));
  const t = resolveSecTarget(url);
  if (!e) { console.warn('  ! 재타깃 표면형이 사전에 없음: ' + surface); continue; }
  if (!t) { console.warn('  ! 재타깃 타깃 해석 실패: ' + surface + ' → ' + url); continue; }
  e.target = t;
}

// 파일 스코프 재타깃 — 한 표면형이 문서마다 다른 뜻인 것. **그 문서에서만** 목적지를 바꾼다.
// 사전은 canonKey 하나당 항목 하나라 KW_RETARGET(전역)으로는 뜻 하나를 고를 수밖에 없고,
// 나머지 뜻으로 쓰인 문서는 통째로 오착지한다(TLS = Thread Local Storage / Transport Layer Security).
// 매칭 규칙은 그대로 두고 autoLink 가 **매칭 확정 뒤** 목적지만 갈아끼우므로 링크 총량은 불변이다.
// 근거는 발행본 실측(링크가 실제로 걸린 위치의 문맥) → _work/done-W52.txt
const KW_RETARGET_IN = [
  // TLS — 30번에 `## TLS (Transport Layer Security)` 절이 서면서 30건 전량이 그 절로 갔다.
  // 아래 문서의 TLS 는 전부 스레드 로컬 저장소다(21:17 · 20:2 · 19:1 · 25:1 · 27:1 · 00_index:1).
  // 남는 30·31·32 는 전송 계층 보안이라 현행 타깃이 맞다.
  [['00_index.md', '19_process_vs_thread.md', '20_stack_overflow.md', '21_context_switching.md',
    '25_cache_hit_miss.md', '27_memory_fragmentation.md'],
    'TLS', '21_context_switching.md#tls의-역할'],
  // 복제 — 70건 전량이 38번 Property Replication 으로 간다. 26·19 의 복제는 fork/COW 의
  // 페이지 복사다("fork()가 GB 단위 프로세스를 순식간에 복제", "새 프레임에 복제") — 26:4 · 19:1.
  [['26_page_fault.md', '19_process_vs_thread.md'],
    '복제', '26_page_fault.md#6-cow-copy-on-write--minor-fault의-대표-사례'],
  // 04 의 복제는 "NewObject/SpawnActor가 CDO를 복제해 인스턴스를 만든다" — 네트워크 복제가 아니다.
  [['04_oop.md'], '복제', '33_uobject.md#4-uclass와-cdo--클래스-메타데이터와-기본값-템플릿'],
  // 오버로딩 — 03번 안의 `오버로딩` 은 전부 operator new 오버로딩 뜻이다(§핵심 차이 표의
  // "오버로딩 / 해제" 행, §꼬리질문, §보충 2 "연산자 오버로딩"). 전역 타깃은 04번 §다형성
  // (함수 오버로딩)이지만 이 문서 안에서만 자기 절로 돌린다 — 같은 파일이라 링크는 억제되고
  // 본문에 이미 있는 수동 링크가 그 자리를 맡는다.
  [['03_new_vs_malloc.md'], '오버로딩', '03_new_vs_malloc.md#operator-new-오버로딩'],
];
// 파일명 → (canonKey → 타깃)
const kwRetargetIn = new Map();
for (const [files, surface, url] of KW_RETARGET_IN) {
  const key = canonKey(surface);
  const t = resolveSecTarget(url);
  if (!kwDict.has(key)) { console.warn('  ! 파일스코프 재타깃 표면형이 사전에 없음: ' + surface); continue; }
  if (!t) { console.warn('  ! 파일스코프 재타깃 타깃 해석 실패: ' + surface + ' → ' + url); continue; }
  for (const fn of files) {
    if (!registry.has(fn)) { console.warn('  ! 파일스코프 재타깃 파일 없음: ' + fn); continue; }
    if (!kwRetargetIn.has(fn)) kwRetargetIn.set(fn, new Map());
    kwRetargetIn.get(fn).set(key, t);
  }
}

// 매칭 버킷: 첫 글자(소문자) → 후보 목록(긴 것 우선 = 최장 일치)
const kwBuckets = new Map();
for (const e of kwDict.values()) {
  const c0 = e.lc[0];
  if (!kwBuckets.has(c0)) kwBuckets.set(c0, []);
  kwBuckets.get(c0).push(e);
}
for (const arr of kwBuckets.values()) arr.sort((a, b) => b.len - a.len);

// 실제 링크가 가리키는 타깃만 KW 배열로 직렬화 → <a class="k" data-k="N"> 로 크기 절약
const kwOut = [];
const kwIdx = new Map();
const kwStats = { links: 0, perKw: new Map() };
const kwSkips = new Map(); // canonKey → 매칭됐지만 링크 없이 소비된 횟수(자기 문서·문단 중복)

function isSelfTarget(t, ctx) {
  const curFile = ctx.topic ? ctx.topic.file : ctx.file ? ctx.file.name : '';
  if (t.kind === 'card') return (ctx.topic && t.c === `t${ctx.topic.num}`) || t.file === curFile;
  if (t.name !== curFile) return false;
  // 같은 파일이어도 **다른 절**로 가는 링크는 자기 링크가 아니다 — 문서 안 절→절 이동이 된다
  // (원본 렌더 중이고 현재 절을 아는 경우에만. 카드 본문은 절 개념이 없어 종전대로 파일 단위 억제).
  if (!(ctx.file && ctx.curSec && t.dom)) return true;
  if (t.dom === ctx.curSec) return true;
  return (ctx.secChain || []).some((x) => x.id === t.dom);  // 조상 절 = 제자리 이동
}
// `_` 를 단어 문자로 본다. 빠져 있으면 `STATUS_[STACK]_OVERFLOW`·`pthread_[mutex]` 처럼
// 식별자 한가운데가 링크된다.
const KW_WORD = /[\p{L}\p{N}_]/u;
// 한글 표면형의 **오른쪽 경계**. 한국어는 명사 뒤에 조사가 바로 붙으므로 "뒤가 한글이면 차단"은
// 쓸 수 없다(`포인터를`·`스택에서`가 전부 죽는다). 대신 붙어도 되는 것을 나열한다 —
// 조사 · 서술격 조사(이다) 활용 · 용언화(하다/되다) 활용 · 단위/복수 접미(들·별·당).
// 목록 근거: 발행본 17,870건 중 한글로 끝나는 앵커 11,588건 뒤에 실제로 온 한글 어절 전수 집계
// (조사류 상위 = 가 599 · 를 425 · 는 366 · 이 342 · 의 340 · 로 296 · 에 278 …).
// 여기에 없는 한글이 이어지면 파생 접미사·복합어로 보고 매칭을 버린다 —
// `안정`성 · `인스턴스`화 · `해시`값 · `삭제`자 · `트리`거 · `렌더`링 (_work/링크-오탐감사.md §2-1).
const KW_JOSA = /^(?:부터|까지|보다|처럼|마다|끼리|밖에|입니|합니|하|해|한|지|할|했|되|된|될|됨|됐|돼|됩|이|가|은|는|을|를|의|에|엔|와|과|로|으|도|만|나|라|란|다|당|랑|든|고|인|들|별|면|냐|여|뿐)/;
const kwRightOk = (rest) => !/^[가-힣]/.test(rest) || KW_JOSA.test(rest);
// 이스케이프된 인라인 HTML에서 키워드를 찾아 <a class="k">로 감싼다.
// <a> 내부·태그·코드 플레이스홀더()는 건너뛰고, 경계(앞: 비문자, 라틴 끝: 뒤 비라틴) 검사.
function autoLink(s, ctx) {
  const used = ctx.sharedUsed || new Set();
  let out = '';
  let i = 0;
  let inA = 0;
  // 공백 무시 매칭용 사본 — 공백 뺀 문자열 sq, 그 각 글자의 원문 위치 sqPos, 원문→sq 위치 toSq.
  // 공백만 다른 표기를 잡기 위한 것이고, 공백 없는 표면형에는 쓰지 않는다(비용·오탐 방지).
  let sq = null; let sqPos = null; let toSq = null;
  const buildSq = () => {
    sq = ''; sqPos = []; toSq = new Int32Array(s.length + 1);
    for (let k = 0; k < s.length; k++) {
      const c = s[k];
      toSq[k] = sq.length;
      if (c !== ' ' && c !== '\n' && c !== '\t' && c !== '\r') { sq += c; sqPos.push(k); }
    }
    toSq[s.length] = sq.length;
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '') {
      const j = s.indexOf('', i + 1);
      out += s.slice(i, j + 1); i = j + 1; continue;
    }
    if (ch === '<') {
      const j = s.indexOf('>', i);
      const tag = s.slice(i, j + 1);
      if (/^<a[\s>]/.test(tag)) inA++;
      else if (tag === '</a>') inA = Math.max(0, inA - 1);
      out += tag; i = j + 1; continue;
    }
    if (inA) { out += ch; i++; continue; }
    // HTML 엔티티는 통째로 통과 — &lt;/&gt;의 "lt"·"gt"가 2자 대문자 키워드(Level-triggered
    // (LT) 등)에 걸려 코드 안 부등호가 링크되던 문제 방지
    if (ch === '&') {
      const ent = /^&(?:#\d+|#x[0-9a-f]+|[a-z]+);/i.exec(s.slice(i, i + 12));
      if (ent) { out += ent[0]; i += ent[0].length; continue; }
    }
    const prev = i > 0 ? s[i - 1] : '';
    const bucket = (!prev || !KW_WORD.test(prev)) && kwBuckets.get(ch.toLowerCase());
    let advanced = false;
    if (bucket) {
      for (const e of bucket) {
        let seg = null;
        if (i + e.len <= s.length && s.slice(i, i + e.len).toLowerCase() === e.lc) seg = s.slice(i, i + e.len);
        else if (e.sq) {
          // 공백만 다른 표기 — "가상함수 테이블" ↔ "가상 함수 테이블", "OS · 동시성" ↔ "OS·동시성".
          // 공백을 뺀 두 문자열이 같을 때만 성립하므로, 매칭 구간에 태그(<)·엔티티·코드
          // 플레이스홀더가 섞일 수 없다(그 문자들은 표면형에 없으니 곧바로 불일치).
          if (sq === null) buildSq();
          const si = toSq[i];
          const cand = sq.substr(si, e.sq.length);
          if (cand.length === e.sq.length && cand.toLowerCase() === e.sq) {
            const end = sqPos[si + e.sq.length - 1] + 1;
            if (end - i <= e.len + 4) seg = s.slice(i, end); // 사이에 낀 공백은 4자까지만
          }
        }
        if (seg === null) continue;
        // `_` 포함 — 빼면 `const`_cast · `bucket`_count · `FIN`_WAIT 처럼 식별자 한가운데가 링크된다.
        // 좌경계(KW_WORD)에는 `_` 가 있는데 우경계에만 빠져 있었다(실측 24건).
        if (e.latinEnd && /[A-Za-z0-9_]/.test(s[i + seg.length] || '')) continue;
        // 한글로 끝나는 표면형은 뒤에 조사류만 허용 — 파생 접미사 안쪽이 링크되는 것을 막는다
        if (/[가-힣]$/.test(seg) && !kwRightOk(s.slice(i + seg.length, i + seg.length + 8))) continue;
        // 매칭 확정 — 여기서부터는 표면형이 아니라 **목적지** 얘기다. 이 문서에서 그 표면형이
        // 다른 뜻이면(KW_RETARGET_IN) 목적지만 갈아끼운다. 매칭은 이미 끝났으니 링크 총량 불변.
        const scoped = ctx.file && kwRetargetIn.get(ctx.file.name);
        const target = (scoped && scoped.get(e.key)) || e.target;
        // 같은 파일 안(절→절) 링크는 절당 1회 — 문단당 1회면 긴 문서에서 같은 말이 계속 링크된다
        const inFile = !!ctx.secUsed && target.kind === 'sec' && !!ctx.file && target.name === ctx.file.name;
        // 매칭 확정 — 자기 절·문단 내 재등장(표면형·타깃 모두)이면 링크 없이 소비(부분 키워드 재매칭 방지)
        // 링크 없이 소비된 경우도 세어 둔다 — 검사기가 "사전에 있는데 링크 0"의 이유
        // (자기 문서·중복으로 정상 억제)를 추측하지 않고 알 수 있게 kwmap 으로 내보낸다.
        if (isSelfTarget(target, ctx) || used.has(e.key) || used.has(target) || (inFile && ctx.secUsed.has(e.key))) {
          kwSkips.set(e.key, (kwSkips.get(e.key) || 0) + 1); out += seg;
        } else {
          used.add(e.key);
          used.add(target);
          if (inFile) ctx.secUsed.add(e.key);
          let idx = kwIdx.get(target);
          if (idx === undefined) {
            idx = kwOut.length;
            kwOut.push(target.kind === 'card' ? { c: target.c } : { f: target.f, t: target.dom });
            kwIdx.set(target, idx);
          }
          out += `<a class="k" data-k="${idx}">${seg}</a>`;
          kwStats.links++;
          kwStats.perKw.set(e.surface, (kwStats.perKw.get(e.surface) || 0) + 1);
        }
        i += seg.length; advanced = true; break;
      }
    }
    if (!advanced) { out += ch; i++; }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 7) 원본 파일 렌더 (pass 2) — 본문 키워드 자동 링크化 포함
// ---------------------------------------------------------------------------
for (const file of registry.values()) {
  file.html = renderBlocks(file.lines, { file, autoLink: true }, true);
}
const totalSections = [...registry.values()].reduce((n, f) => n + f.headings.length, 0);

// ---------------------------------------------------------------------------
// 7.5) "말로 하는 정의" 추출 — 각 원본의 `## 모의면접 답변` 산문(2~4문장, 10~20초)
//   면접에서 "OO란 무엇인가요?"에 그대로 답할 수 있는 블록이 이미 원본 최상단에 있다.
//   이걸 카드 정의 바로 아래(P14)와 원본 오버레이 상단 배너에 재사용한다 — 내용 복제 없음.
// ---------------------------------------------------------------------------
// 정의 블록 헤딩 표기는 파일마다 다르다 — 우선순위 순으로 찾는다(먼저 맞는 것 채택).
const DEF_HEADS = ['모의면접 답변', '발표 답변', '30초 답변', '한 줄 정의', '핵심 개념'];
function defParasAt(lines, start) {
  const paras = [];
  let inFence = false;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s{0,7}```/.test(l)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^#{1,6}\s/.test(l) || l.startsWith(STUDY_START)) break;
    if (/^\s*<\/?(details|summary)/i.test(l)) break;      // 접힘 블록 시작 = 답변 본문 끝
    if (!l.trim() || /^\s*-{3,}\s*$/.test(l)) continue;    // 빈 줄·구분선
    if (/^\s*\|/.test(l) || /^>\s?/.test(l)) continue;     // 표·인용은 정의 문장이 아니다
    if (/^\*\*(핵심 키워드|키워드)\*\*/.test(l)) continue; // 답변이 아니라 네비 줄
    paras.push(l.trim().replace(/^[-*]\s+/, ''));          // 불릿 표기 정의 블록도 문단으로
    if (paras.length >= 3) break;                          // 말로 20초 상한
  }
  return paras;
}
function spokenDefOf(file) {
  for (const head of DEF_HEADS) {
    const re = new RegExp(`^##\\s+${head}`);
    const i = file.lines.findIndex((l) => re.test(l));
    if (i < 0) continue;
    const paras = defParasAt(file.lines, i);
    if (paras.join(' ').length >= 25) return paras;
  }
  return [];
}
for (const file of registry.values()) file.spokenDef = spokenDefOf(file);

// ---------------------------------------------------------------------------
// 8) 메인 카드 HTML
// ---------------------------------------------------------------------------
const sumCtx = { file: null };
// 면접 실전 순서(P13) 검증 카운트: ①정의 최상단 ②동작·차이·해결 ④연관 하단
// "정의 먼저" 커버리지 모집단은 이 카드 45개 + 링크·색인 유입 원본 섹션이다 — 개념 섹션 전수로
// 재면 상위 절이 이미 정의한 하위 절까지 결손으로 세어 과대 집계된다(근거: tools/check-def-coverage.mjs).
const cardStats = { total: 0, defTop: 0, relBottom: 0, spoken: 0, speakable: 0, noDef: [], noRel: [], noSpoken: [] };
function topicCard(t) {
  const src = registry.get(t.file);
  const srcBtn = src
    ? `<a class="jump srcbtn" href="#" data-file="${src.id}" data-target="" title="${escapeHtml(t.file)} 원본 열기">원본 ↗</a>`
    : '';
  // 불릿 분류: **정의** → 강조 블록(최상단) / 🔗연관 → 맨 아래 / 나머지 → 동작·차이·해결
  let def = '';
  const facts = [];
  const rels = [];
  for (const b of t.bullets) {
    if (b.startsWith('🔗')) { rels.push(b); continue; }
    const m = !def && b.match(/^\*\*정의\*\*\s*[::]\s*(.*)$/);
    if (m) def = m[1];
    else facts.push(b);
  }
  cardStats.total++;
  if (def) cardStats.defTop++; else cardStats.noDef.push(t.num);
  if (rels.length) cardStats.relBottom++; else cardStats.noRel.push(t.num);
  // 말로 하는 정의(P14): 원본의 모의면접 답변을 정의 바로 아래에 — "OO란?"에 10~20초로 답하는 분량
  const spoken = (src && src.spokenDef) || [];
  if (spoken.length) cardStats.spoken++;
  // 말로 10~20초 기준: 원본 답변 블록이 있거나, 정의 불릿 자체가 120자 이상이면 충족
  if (spoken.length || stripInlineMd(def).length >= 120) cardStats.speakable++;
  else cardStats.noSpoken.push(t.num);
  const spokenCtx = { file: src || null, autoLink: true }; // 답변 안의 #앵커는 그 원본 섹션으로 해석
  const cardCtx = { file: null, topic: t, autoLink: true }; // 정의·해결 텍스트 자동 링크化 (자기 카드·자기 원본 제외)
  return `<article class="card topic" id="t${t.num}">
<header class="card-head"><span class="num">${t.num}</span><h3>${renderInline(t.title, sumCtx)}</h3>${srcBtn}</header>
<div class="card-body">
${def ? `<p class="def"><b class="dl">정의</b>${renderInline(def, cardCtx)}</p>` : ''}
${spoken.length ? `<div class="spoken"><b class="sl">말로 답하기 · 10~20초</b>${spoken.map((p) => `<p>${renderInline(p, spokenCtx)}</p>`).join('')}</div>` : ''}
${facts.length ? `<ul class="facts">${facts.map((b) => `<li>${renderInline(b, cardCtx)}</li>`).join('\n')}</ul>` : ''}
${rels.map((b) => `<div class="rel">${renderInline(b, cardCtx)}</div>`).join('\n')}
</div>
</article>`;
}

const mainHtml = [
  ...domains.map((d) => `<section class="dblock" id="d${d.num}">
<h2 class="dtitle">${renderInline(d.title, sumCtx)}</h2>
${d.topics.map(topicCard).join('\n')}
</section>`),
  // 색인 카드도 자동 링크 대상 — 색인 줄 꼬리의 설명("… — 페이지와 프레임 — 폴트 3종")이
  // 카드 안에서 바로 클릭 가능해야 색인이 링크망의 입구 역할을 한다.
  ...extras.map((e, i) => `<section class="dblock" id="dx${i}">
<article class="card extra" id="extra-${i}">
<header class="card-head"><h3>${renderInline(e.title, sumCtx)}</h3></header>
<div class="card-body">${renderBlocks(e.lines, { file: null, autoLink: true }, false)}</div>
</article>
</section>`),
].join('\n');

// ---------------------------------------------------------------------------
// 9) 사이드바 + 오버레이(임베드 원본)
// ---------------------------------------------------------------------------
const navLabel = (s, max = 26) => {
  const t = stripInlineMd(s).trim();
  return escapeHtml(t.length > max ? t.slice(0, max) + '…' : t);
};
// 도메인 칩 줄 — 좁은 화면 전용. 900px 이하에서 좌측 목차(#side)가 사라지는데 메인은
// 도메인 10블록·카드 69장이 한 줄로 쌓인 긴 스크롤이라, 모바일에는 도메인으로 건너뛸 방법이
// 아예 없었다(2026-08-05). 가로로 스크롤되는 칩 한 줄로 그 구멍만 메운다.
const dchipsHtml = domains
  .map((d) => `<a class="dchip" href="#d${d.num}">${navLabel(d.title, 14)}</a>`)
  .join('');

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
// 파일별 "말로 하는 정의" 평문 — 원본 오버레이 상단 배너용(P14).
// 질문형으로 검색해 파일 중간 앵커로 뛰어들어도 그 파일의 개념 정의가 먼저 보이게 한다.
const fileDefsJson = JSON.stringify(Object.fromEntries(
  [...registry.values()].filter((f) => f.spokenDef.length).map((f) => [f.id, stripInlineMd(f.spokenDef.join(' ')).replace(/\s+/g, ' ').trim()]),
)).replace(/</g, '\\u003c');

// ---------------------------------------------------------------------------
// 9.5) 검색 인덱스 + 랭킹 코어
//    코어는 순수 함수로 작성해 toString()으로 클라이언트에 직렬화한다.
//    검증 스크립트는 생성된 HTML에서 /*__CORE_START__*/…/*__CORE_END__*/ 블록과
//    "var SIDX=…" 라인을 추출하면 뷰어와 동일한 로직으로 랭킹을 재현할 수 있다.
// ---------------------------------------------------------------------------
function SEARCH_CORE() {
  // 질의 토큰화: 공백 분리 + 꼬리 조사 제거(어간 2자 이상 보존)
  var PARTICLES = ['이란', '에서', '에게', '으로', '부터', '까지', '와', '과', '은', '는', '이', '가', '을', '를', '의', '로', '에', '도', '만', '란'];
  // 질문 어미 단독 토큰 — 검색어가 아니라 질문 형식이다. "생성자란 무엇인가" → ["생성자"]
  var QWORDS = ['무엇인가', '무엇인가요', '무엇일까', '무엇일까요', '무엇', '뭐야', '뭔가', '뭐죠', '이란', '란', '인가', '인가요', '이뭐야'];
  function tokenize(qs) {
    var raw = qs.toLowerCase().trim().split(/\s+/).filter(function (w) { return !!w; });
    var out = [];
    raw.forEach(function (w) {
      if (QWORDS.indexOf(w) >= 0) return;
      // "큐란"·"힙이란" — 개념이 1자여도 이 조사는 떼야 한다(어간은 원문의 접두 부분이라 매칭 손실 없음).
      // 일반 조사는 어간 2자 이상만 완화(아래) — "가"·"이" 등은 단어 일부일 확률이 높다.
      var m = /^(.+?)(이란|란)$/.exec(w);
      if (m) { out.push(m[1]); return; }
      for (var i = 0; i < PARTICLES.length; i++) {
        var p = PARTICLES[i];
        if (w.length - p.length >= 2 && w.slice(-p.length) === p) { w = w.slice(0, w.length - p.length); break; }
      }
      out.push(w);
    });
    return out.length ? out : raw;   // 전부 질문어면 원문 그대로
  }
  function countOcc(t, s) { var n = 0, i = t.indexOf(s); while (i >= 0) { n++; i = t.indexOf(s, i + s.length); } return n; }
  // 짧은 라틴 토큰은 **단어 경계**를 요구한다(자동 링크의 KW_WORD 경계와 같은 기준).
  // 없으면 "udp" 안의 "dp" 가 제목 완전일치(band1)로 잡혀 `DP` 질의가 30. TCP vs UDP 로 간다.
  // 경계는 라틴/숫자만 막는다 — 한글이 바로 붙는 표기("TCP는"·"DP를")와 식별자 구분자
  // ("binary_search"의 search, "unordered_map"의 map)는 살려야 한다.
  // 4자 이상에는 적용하지 않는다 — UE 식별자가 라틴을 붙여 쓴다(UActorComponent의 actor).
  var LATIN_TOK = /^[^가-힣]{1,3}$/;
  var WCH = /[a-z0-9]/;
  function countWordOcc(t, s) {
    var n = 0, i = t.indexOf(s);
    while (i >= 0) {
      if (!WCH.test(i ? t.charAt(i - 1) : '') && !WCH.test(t.charAt(i + s.length))) n++;
      i = t.indexOf(s, i + 1);
    }
    return n;
  }
  // 한글 어간(끝 1~2자 완화)은 **어절 앞부분**에서만 인정한다.
  // 없으면 "레드블랙"→"레드"가 "스레드" 안쪽에, "쓰레드"→"쓰레"가 "쓰레기값" 안쪽에 걸린다.
  function countHeadOcc(t, s) {
    var n = 0, i = t.indexOf(s);
    while (i >= 0) {
      if (!/[가-힣]/.test(i ? t.charAt(i - 1) : '')) n++;
      i = t.indexOf(s, i + 1);
    }
    return n;
  }
  // 토큰 1개의 점수: 완전일치 2점/회, 어간(끝 1~2자 완화, "페이징"→"페이"≈"페이지") 1점/회
  // 어간 완화는 한글 꼬리 토큰에만 적용 — "tlb"→"tl"이 "stl"에 걸리는 오탐 방지
  // rep = 같은 토큰 반복의 가산 상한. 제목·헤딩(짧은 표면)에는 1을 준다 —
  // 반복 가산을 열어두면 개념어를 두 번 되뇌는 복습·보강 헤딩(`커널이란 / OS와 커널의 차이` 4점)이
  // 정본 헤딩(`커널 (Kernel)` 2점)을 이겨 즉답을 가져간다. 동점이면 뒤의 ref·pos·len 이 정리한다.
  // 본문·연관 블롭(_rel/_all/헤딩+본문)에는 상한을 두지 않는다 — 거기서는 반복이 실제 신호다
  // (`소켓` 질의에서 31. Socket 카드가 연관 텍스트 반복으로 1위를 잡는다).
  function hitScore(t, tok, rep) {
    rep = rep || 99;
    var c = LATIN_TOK.test(tok) ? countWordOcc(t, tok) : countOcc(t, tok);
    if (c) return Math.min(c, rep) * 2;
    if (!/[가-힣]$/.test(tok)) return 0;
    if (tok.length >= 3 && (c = countHeadOcc(t, tok.slice(0, -1)))) return Math.min(c, rep);
    if (tok.length >= 4 && (c = countHeadOcc(t, tok.slice(0, -2)))) return Math.min(c, rep);
    return 0;
  }
  // AND 매칭: 모든 토큰 히트 시 합산 점수, 아니면 0 (토큰이 인접할 필요 없음)
  function matchAll(t, toks, rep) { var s = 0; for (var i = 0; i < toks.length; i++) { var c = hitScore(t, toks[i], rep); if (!c) return 0; s += c; } return s; }
  // 부분 매칭: 히트한 토큰 수 n + 합산 점수 s
  function partialHits(t, toks, rep) { var n = 0, s = 0; toks.forEach(function (tk) { var c = hitScore(t, tk, rep); if (c) { n++; s += c; } }); return { n: n, s: s }; }
  // 하이라이트용: 각 토큰이 실제 매칭된 형태(원형 우선, 없으면 어간), 긴 것부터
  function matchForms(t, toks) {
    var out = [];
    toks.forEach(function (tok) {
      if (LATIN_TOK.test(tok) ? countWordOcc(t, tok) : t.indexOf(tok) >= 0) out.push(tok);
      else if (!/[가-힣]$/.test(tok)) return;
      else if (tok.length >= 3 && countHeadOcc(t, tok.slice(0, -1))) out.push(tok.slice(0, -1));
      else if (tok.length >= 4 && countHeadOcc(t, tok.slice(0, -2))) out.push(tok.slice(0, -2));
    });
    out.sort(function (a, b) { return b.length - a.length; });
    return out;
  }
  // 스니펫: 토큰이 가장 많이 걸린 줄 하나
  function bestLine(lines, toks) {
    var best = '', bh = 0;
    lines.forEach(function (ln) {
      var l = ln.toLowerCase(), h = 0;
      toks.forEach(function (tk) { if (hitScore(l, tk)) h++; });
      if (h > bh) { bh = h; best = ln; }
    });
    return best;
  }
  // 첫 매칭 위치 주변으로 잘라내기
  function clip(s, forms, max) {
    max = max || 100;
    var l = s.toLowerCase(), first = -1;
    forms.forEach(function (f) { var i = l.indexOf(f); if (i >= 0 && (first < 0 || i < first)) first = i; });
    var start = first < 0 ? 0 : Math.max(0, first - 28);
    var end = Math.min(s.length, start + max);
    return (start > 0 ? '…' : '') + s.slice(start, end) + (end < s.length ? '…' : '');
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // 매칭 구간을 <mark>로 감싼 HTML (겹침 병합)
  function hilite(s, forms) {
    var l = s.toLowerCase(), sp = [];
    forms.forEach(function (f) { if (!f) return; var i = l.indexOf(f); while (i >= 0) { sp.push([i, i + f.length]); i = l.indexOf(f, i + 1); } });
    if (!sp.length) return esc(s);
    sp.sort(function (a, b) { return a[0] - b[0]; });
    var mg = [sp[0]];
    for (var i = 1; i < sp.length; i++) { var p = mg[mg.length - 1]; if (sp[i][0] <= p[1]) { if (sp[i][1] > p[1]) p[1] = sp[i][1]; } else mg.push(sp[i]); }
    var out = '', last = 0;
    mg.forEach(function (m) { out += esc(s.slice(last, m[0])) + '<mark>' + esc(s.slice(m[0], m[1])) + '</mark>'; last = m[1]; });
    return out + esc(s.slice(last));
  }
  // 정의형 제목 판정. 인덱스의 "개념 절" 플래그(h[8])는 **바로 아래에 `정의` 구획을 거느린 절**로만
  // 붙는다. 그래서 4구획을 안 쓰는 문답형 문서(14_std_map_followup 등)는 정의 절이어도 신호가 없다.
  // 한국어 코퍼스에서 정의 절 제목은 형태가 뚜렷하다 — `~란?`·`~이란 무엇인가`·`~가 뭔가`·
  // `~는 무엇인가`·`~의 정의`·`한 줄 정의`. 이걸 제목 형태만으로 읽어 그 자리를 메운다.
  //   판정은 **질의어 바로 뒤**에서만 한다. 표지 앞에 다른 낱말이 끼면 정의 대상이 달라지기 때문이다
  //   (`해시충돌이란?` 은 해시가 아니라 해시충돌의 정의 절이다).
  //   `Q5. "deadlock이 뭔가요?"` 같은 꼬리질문 블록은 제외한다 — 형태는 정의형이지만 정본 절이
  //   따로 있는 곁가지다(실측: 넣으면 `deadlock` 이 19번 Q&A 로 간다).
  var DEFTAIL = /^(?:\s*\([^()]*\))?\s*(?:이?란|[이가]\s*뭔가|[은는이가]\s*무엇|의\s*정의)/;
  function defTitle(h, toks) {
    if (/^q\d/.test(h)) return 1;
    if (h.indexOf('한 줄 정의') >= 0) return 0;
    for (var i = 0; i < toks.length; i++) {
      // 제목이 곧 용어인 절(`커널 (Kernel)`)도 정의 절이다. 번호·수식어가 붙은 소절
      // (`6-2. 뮤텍스 (Mutex)`·`4-3. 공간 지역성 (Spatial Locality)`)은 제외한다 —
      // 넣으면 정본(`뮤텍스(Mutex)와 뮤텍스 API`·`7. 지역성 — Temporal·Spatial`)을 이긴다.
      // 괄호 앞 공백을 요구한다 — 영문 병기는 띄어 쓰고(`커널 (Kernel)`), 붙여 쓴 괄호는
      // 별칭이 아니라 다른 문법이다(`new(nothrow)`).
      if (h.replace(/\s+\([^()]*\)\s*$/, '') === toks[i]) return 0;
      var p = h.indexOf(toks[i]);
      if (p >= 0 && DEFTAIL.test(h.slice(p + toks[i].length))) return 0;
    }
    return 1;
  }
  // 인덱스 전처리: 소문자 캐시
  function prepIndex(idx) {
    idx.topics.forEach(function (t) {
      t._ti = t.ti.toLowerCase();
      t._rel = t.rel.toLowerCase();
      t._all = (t.ti + ' ' + t.rel + ' ' + t.lines.join(' ')).toLowerCase();
    });
    // h[3]=헤딩 소문자, h[4]=헤딩+본문 소문자(본문 매칭용)
    idx.files.forEach(function (f) {
      // f._sup = 문서 등급. 정본은 파일명이 번호로 시작한다(`14_std_map.md`). 번호 없는
      // `키워드-보강-2026-07-28.md`·`CS_추가키워드_복습.md`·`발표_…` 는 임시 모음이지 정본이
      // 아니라서 1 로 둔다 — `map` 질의 2위가 보강 문서의 `map vs set` 이던 실측을 잡는다.
      f._sup = /^\d/.test(f.n) ? 0 : 1;
      f.hs.forEach(function (h) {
        // h[3] 은 빌드가 넣은 메타(레벨+개념 절 플래그) — 소문자 캐시로 덮기 전에 먼저 푼다.
        var mt = h[3] | 0;
        h[7] = (mt & 7) || 3;        // 헤딩 레벨 (얕을수록 상위 개념)
        h[8] = (mt & 8) ? 0 : 1;     // 개념 절이면 0 — 오름차순 정렬에서 먼저 온다
        h[3] = h[0].toLowerCase();
        h[4] = h[2] ? h[3] + ' ' + h[2].toLowerCase() : h[3];
        // h[5] = 꼬리의 파일 참조 '(NN_x.md)'를 뗀 개념명 길이 — 동순위 정렬에서 표기 길이 때문에
        // 개념 설명 섹션이 밀려나지 않게 한다.
        h[5] = h[0].replace(/\s*\([^()]*\.md[^()]*\)\s*$/, '').length;
        // h[6] = 다른 파일을 가리키는 꼬리('(NN_x.md)')를 단 헤딩 = 복습·요약 항목.
        // 같은 점수면 정본 파일의 절이 먼저 와야 한다.
        h[6] = h[5] === h[0].length ? 0 : 1;
        // h[9] = 꼬리의 영문 별칭 괄호까지 뗀 개념명 길이. `컨텍스트 스위칭 (Context Switching)` 처럼
        // 제목 자체가 개념명인 절이, 개념명에 수식어를 붙인 절(`컨텍스트 스위칭 비용 절감 효과`)보다
        // 짧아져 동점 정렬에서 위로 온다.
        h[9] = h[0].replace(/\s*\([^()가-힣]*\)\s*$/, '').length;
      });
    });
    return idx;
  }
  // 랭킹 검색.
  //   주제 밴드: 1 제목(전체) → 2 연관(전체) → 3 제목(부분) → 4 본문통합(전체) → 5 연관(부분)
  //   원본 섹션: 1 헤딩(전체) → 2 섹션 본문(전체) → 3 헤딩(부분)
  //   정렬: 밴드 → 히트 토큰 수 → 점수 → (섹션은 짧은 헤딩 우선) → 문서 순서
  function search(idx, query) {
    var toks = tokenize(query);
    var res = { toks: toks, topics: [], sections: [] };
    if (!toks.length) return res;
    var multi = toks.length > 1;
    // 사전이 지정한 정본 절(idx.kw). 질의를 canonKey 로 눌러 표면형과 **정확히** 같을 때만 쓴다
    // — 부분 일치로 열면 큐레이션이 아니라 또 하나의 문자열 매칭이 된다.
    // 조사를 뗀 토큰을 붙여 canonKey 를 만든다("커널이란" → "커널", "해시 충돌" → "해시충돌").
    // **질의 원문으로도 조회한다.** 조사 제거기가 명사 끝의 로·가·이·은·는을 조사로 오인하기
    // 때문이다 — 스택 오버플로 의 로 를 떼어 스택오버플 이 되면 사전에 없어 큐레이션이 통째로
    // 빗나간다(2026-08-06 실측: 스택 오버플로우 는 kw 적용, 스택 오버플로 는 미적용).
    // 원문 우선, 없으면 조사 뗀 형태. 둘 다 정확 일치일 때만 쓰는 원칙은 그대로다.
    var ckRaw = String(query).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    var ck = toks.join('').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    var kwOrd = -1;
    if (idx.kw) {
      if (ckRaw && typeof idx.kw[ckRaw] === 'number') kwOrd = idx.kw[ckRaw];
      else if (ck && typeof idx.kw[ck] === 'number') kwOrd = idx.kw[ck];
    }
    idx.topics.forEach(function (t, i) {
      var band = 0, n = toks.length, s;
      if ((s = matchAll(t._ti, toks, 1))) band = 1;
      else if ((s = matchAll(t._rel, toks))) band = 2;
      else {
        var pT = multi ? partialHits(t._ti, toks, 1) : { n: 0 };
        if (pT.n) { band = 3; n = pT.n; s = pT.s; }
        else if ((s = matchAll(t._all, toks))) band = 4;
        else {
          var pR = multi ? partialHits(t._rel, toks) : { n: 0 };
          if (pR.n) { band = 5; n = pR.n; s = pR.s; }
        }
      }
      if (band) res.topics.push({ band: band, n: n, score: s, ord: i, t: t });
    });
    res.topics.sort(function (a, b) { return a.band - b.band || b.n - a.n || b.score - a.score || a.ord - b.ord; });
    var ord = 0;
    idx.files.forEach(function (f) {
      f.hs.forEach(function (h) {
        var s = matchAll(h[3], toks, 1), band = 1, n = toks.length;
        if (!s) { s = matchAll(h[4], toks, 1); if (s) band = 2; }     /* 본문 전체 매칭 */
        if (!s && multi) { var p = partialHits(h[3], toks, 1); if (p.n) { band = 3; n = p.n; s = p.s; } }
        // 사전이 이 절을 그 용어의 정본으로 지정했다 — 헤딩 표기가 달라도(`임계 구역` →
        // `Critical Section — 임계 영역의 개념`) band1 로 세우고 정의 절로 본다.
        // def=0 이라야 bestHit 이 카드 대신 이 절을 즉답으로 집는다.
        var kw = ord === kwOrd ? 0 : 1;
        if (!kw) { band = 1; n = toks.length; s = s || 1; }
        // pos = 헤딩 안에서 첫 토큰이 나타나는 위치. "DFS와 BFS의 차이"(0) 가
        // "너무 깊은 재귀 (트리 DFS)"(11) 보다 그 개념의 설명 섹션일 확률이 높다.
        /* Q&A 절 강등 — 제목이 Q6. 처럼 시작하는 절은 꼬리질문 모음이지 그 개념의 정본이 아니다.
           스택 오버플로 검색이 Q6. 스택 오버플로와 버퍼 오버플로의 차이는? 으로 가고 있었다 —
           그 제목에 오버플로가 두 번 들어 히트 수가 높았고, 히트 수가 사전 큐레이션보다 앞서 정렬된다.
           밴드 바로 뒤에 두어 같은 밴드 안에서는 개념 절이 항상 먼저 오게 한다. */
        var qa = /^Q[0-9]/.test(h[0]) ? 1 : 0;   /* 이스케이프를 피해 문자 클래스로 — 템플릿 리터럴이 백슬래시를 먹는다 */
        if (s) res.sections.push({ band: band, qa: qa, n: n, kw: kw, sup: f._sup, score: s, ref: h[6], def: kw ? defTitle(h[3], toks) : 0, cpt: h[8], lv: h[7], pos: (h[3].indexOf(toks[0]) + 1) || 999, len: h[9], ord: ord, h: h[0], slug: h[1], f: f.f, fn: f.n });
        ord++;
      });
    });
    // 같은 점수·같은 매칭 위치면 개념 절(cpt) → 얕은 헤딩(lv) 순.
    // 정의를 거느린 절이 그 개념의 설명이고, 깊은 소절은 그 절의 곁가지다.
    // cpt 를 pos 앞에 두면 헤딩 첫머리 직격(`해시충돌`)이 뒤쪽 매칭 개념 절에 밀려 실측 2건이 나빠진다.
    // def(정의형 제목)는 pos 앞에 둔다 — 정의 절 제목은 `11. 해시(Hash) 가 뭔가` 처럼 번호가
    // 앞에 붙어 pos 가 밀리는 일이 잦아서, pos 뒤에 두면 신호가 죽는다.
    // kw(사전이 지정한 정본 절)는 band·히트 수 바로 뒤 — 같은 밴드 안에서만 이긴다.
    // sup(문서 등급)은 ref 옆 — 둘 다 "이게 정본이냐"를 보는 축이다. 밴드·히트 수가 같을 때만
    // 갈리므로, 그 주제가 보조 문서에만 있으면 순위는 그대로다(경쟁자가 없으니 동점이 안 난다).
    res.sections.sort(function (a, b) { return a.band - b.band || a.qa - b.qa || a.kw - b.kw || b.n - a.n || a.ref - b.ref || a.sup - b.sup || b.score - a.score || a.def - b.def || a.pos - b.pos || a.cpt - b.cpt || a.lv - b.lv || a.len - b.len || a.ord - b.ord; });
    return res;
  }
  return { tokenize: tokenize, hitScore: hitScore, matchAll: matchAll, partialHits: partialHits, matchForms: matchForms, bestLine: bestLine, clip: clip, esc: esc, hilite: hilite, prepIndex: prepIndex, search: search };
}

// 검색 인덱스 데이터: 주제(제목·연관·본문 줄) + 원본 섹션 헤딩
const plainMd = (s) => stripInlineMd(s).trim();

// 자동 링크 사전(kwDict)에는 표면형마다 정본 절이 이미 큐레이션돼 있다(pri 경쟁 · KW_ALIAS ·
// KW_RETARGET). 검색은 헤딩 문자열만 봐서 그 지정을 못 쓰고 있었다 — `unordered_map` 이
// 14_std_map 의 곁가지 절로 가던 것이 그 예다. canonKey(표면형) → 정본 절 전역 순번을 인덱스에
// 실어, 질의가 표면형과 정확히 같을 때 그 절을 올린다. 순번은 아래 files/hs 순회 순서 = search()의 ord.
const kwCanon = {};
{
  const secOrd = new Map();
  let n = 0;
  for (const f of registry.values()) for (const h of f.headings) secOrd.set(`${f.id} ${h.domId}`, n++);
  for (const e of kwDict.values()) {
    if (!e.target || e.target.kind !== 'sec' || !e.target.dom) continue;   // 카드 타깃은 제외 — 절 랭킹만 손댄다
    const o = secOrd.get(`${e.target.f} ${e.target.dom}`);
    if (o !== undefined) kwCanon[e.key] = o;
  }
}
const searchIdx = {
  kw: kwCanon,
  topics: domains.flatMap((d) => d.topics.map((t) => {
    const facts = [];
    const rels = [];
    for (const b of t.bullets) (b.startsWith('🔗') ? rels : facts).push(plainMd(b));
    return { c: `t${t.num}`, num: t.num, ti: plainMd(t.title), rel: rels.join(' '), lines: [...facts, ...rels] };
  })),
  // hs 원소 = [헤딩, 슬러그, 섹션 본문 산문, 메타]. 본문은 표·인용 기호를 공백으로 눌러 한 줄로.
  // 메타 = 하위 3비트 헤딩 레벨(1~6) + 8비트 "개념 절" 플래그.
  // 개념 절 = 바로 아래에 더 깊은 `정의` 구획을 거느린 절. 이 정보가 없으면 검색 랭킹에서
  // 정의를 품은 개념 절(`컨텍스트 스위칭 (Context Switching)`)과 세부 소절
  // (`컨텍스트 스위칭 비용 절감 효과`)이 동급으로 경쟁해 소절이 즉답을 가져간다.
  files: [...registry.values()].map((f) => ({
    f: f.id,
    n: f.name,
    hs: f.headings.map((h, i, a) => {
      const nx = a[i + 1];
      const concept = nx && nx.level > h.level && plainMd(nx.raw) === '정의' ? 8 : 0;
      // 구획 이름만으로는 착지 라벨이 안 된다 — `§ 동작` 은 **무엇의** 동작인지 말해 주지 않는다.
      // 4구획은 어느 문서에나 있어서 `옥타일` 을 검색하고 `§ 동작` 에 떨어지면 길을 잃는다.
      // 가장 가까운 상위 절을 앞에 붙인다. 슬러그·앵커는 그대로다 — 라벨만 바뀐다.
      let t = plainMd(h.raw);
      if (GU_CLASS.has(t))
        for (let j = i - 1; j >= 0; j--)
          if (a[j].level < h.level) {           // 꼬리의 `(27_memory_fragmentation.md)` 는 파일 참조지 개념명이 아니다
            t = `${plainMd(a[j].raw).replace(/\s*\([^()]*\.md[^()]*\)\s*$/, '')} › ${t}`;
            break;
          }
      return [t, h.slug, plainMd(h.body.join(' ')).replace(/[|>*]+/g, ' ').replace(/\s+/g, ' ').trim(), concept | h.level];
    }),
  })),
};
const searchIdxJson = JSON.stringify(searchIdx).replace(/</g, '\\u003c');

// ---------------------------------------------------------------------------
// 10) CSS (다크+골드 디자인 토큰)
// ---------------------------------------------------------------------------
const css = `
:root{--bg:#1b1b1e;--card:#242428;--ink:#e6e1d7;--gold:#e8b931;--muted:#a9a49a;--line:rgba(230,225,215,.09);--codebg:#17171a}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.75 Inter,-apple-system,'Segoe UI','Malgun Gothic','Apple SD Gothic Neo',sans-serif}
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
#qwrap{flex:1;min-width:120px;max-width:520px;position:relative}
#q{width:100%;background:var(--card);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:8px 12px;font-size:14px;outline:none}
#q:focus{border-color:var(--gold)}
#qcount{color:var(--muted);font-size:12px;min-width:34px;white-space:nowrap}
/* 검색 결과 패널 */
#qpanel{position:absolute;top:calc(100% + 6px);left:0;width:100%;max-height:min(72vh,560px);overflow-y:auto;background:#202024;border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.55);padding:6px}
.qgh{color:var(--gold);font-size:12px;font-weight:700;padding:6px 8px 3px;letter-spacing:.02em}
.qres{display:block;padding:5px 8px;border-radius:7px;color:var(--ink);text-decoration:none;line-height:1.5}
.qres:hover{background:var(--card)}
.qtt{display:block;font-size:13.5px}
.qtt b{color:var(--gold);font-size:11px;margin-right:3px}
.qtag{font-style:normal;font-size:10.5px;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:0 4px;margin-left:6px;white-space:nowrap}
.qfn{color:var(--muted);font-size:11px;margin-left:7px;white-space:nowrap}
.qsn{display:block;color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qempty,.qmore{color:var(--muted);font-size:12.5px;padding:6px 8px}
/* 검색 즉답 패널 (최상위 결과 정의 미리보기) */
.qans{margin:4px 2px 8px;padding:9px 11px;border:1px solid rgba(232,185,49,.35);background:rgba(232,185,49,.05);border-radius:9px}
.qans:hover{border-color:var(--gold);background:rgba(232,185,49,.08)}
.qat{font-size:13.5px;font-weight:700;margin-bottom:3px}
.qat b{color:var(--gold);font-size:11px;margin-right:3px}
.qad{color:var(--muted);font-size:12.5px;line-height:1.55;white-space:normal;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
#top button{background:var(--card);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:8px 13px;font-size:13px;cursor:pointer;white-space:nowrap}
#top button:hover{border-color:var(--gold)}
#top button.on{background:var(--gold);color:#1b1b1e;font-weight:700;border-color:var(--gold)}
#vpanel{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:60;max-width:640px;width:calc(100% - 32px);background:var(--card);border:1px solid var(--gold);border-radius:12px;padding:12px 16px;box-shadow:0 8px 30px rgba(0,0,0,.5)}
#vstatus{font-size:13px;color:var(--muted);line-height:1.55}
#vstatus b{color:var(--gold)}
#vtext{margin-top:8px;font-size:15px;color:var(--ink);white-space:pre-wrap;max-height:30vh;overflow-y:auto}
#vtext:empty{display:none}
#vpanel code{background:var(--codebg);border:1px solid var(--line);border-radius:4px;padding:.05em .3em;font-size:.85em}
/* 꼬리물기 브레드크럼 (본문 상단 고정 + 오버레이 헤더 아래) */
#trail{position:sticky;top:57px;z-index:29;background:rgba(27,27,30,.94);backdrop-filter:blur(6px);border-bottom:1px solid var(--line)}
#ovtrail{background:rgba(232,185,49,.03);border-bottom:1px solid var(--line)}
#trail,#ovtrail{display:flex;align-items:center;gap:2px;flex-wrap:wrap;padding:5px 16px;font-size:12.5px}
#trail[hidden],#ovtrail[hidden]{display:none}
.tlabel{color:var(--muted);margin-right:5px;flex:none}
.tstep{color:var(--ink);text-decoration:none;padding:1px 7px;border-radius:5px;border:1px solid transparent;white-space:nowrap;cursor:pointer;max-width:180px;overflow:hidden;text-overflow:ellipsis}
.tstep:hover{border-color:var(--gold);color:var(--gold)}
.tstep.cur{color:var(--gold);font-weight:700}
.tsep{color:var(--muted)}
.tclear{margin-left:auto;color:var(--muted);cursor:pointer;border:0;background:none;font-size:12px;padding:1px 6px}
.tclear:hover{color:var(--gold)}
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
/* 스크롤 스파이: 현재 보고 있는 카드 하이라이트 */
.sitem.cur{background:rgba(232,185,49,.12);color:var(--gold);font-weight:600}
.sitem.cur b{color:var(--gold)}
#main{flex:1;min-width:0;padding:16px 0 80px}
.dtitle{color:var(--gold);font-size:19px;margin:22px 0 10px;padding-bottom:5px;border-bottom:1px solid var(--line)}
.dblock:first-child .dtitle{margin-top:8px}
/* 카드 — 면접 실전 순서: 정의(강조) → 동작·차이·해결 → 🔗연관(하단) */
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:11px 16px 13px;margin-bottom:12px;scroll-margin-top:70px;outline:2px solid transparent}
.card-head{display:flex;align-items:baseline;gap:10px}
.card-head h3{margin:0;font-size:16.5px;flex:1}
.num{color:var(--gold);font-weight:800;font-size:13px;background:rgba(232,185,49,.1);border-radius:6px;padding:2px 7px;flex:none}
.srcbtn{font-size:12px;text-decoration:none;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:2px 8px;flex:none}
.srcbtn:hover{color:var(--gold);border-color:var(--gold)}
/* ① 정의 = 핵심 답변: 카드 열자마자 첫 문장이 보이게 최상단 강조 */
.def{margin:8px 0 0;padding:8px 12px;background:rgba(232,185,49,.07);border-left:3px solid var(--gold);border-radius:0 8px 8px 0;line-height:1.65}
.def .dl{color:var(--gold);font-weight:800;font-size:11px;letter-spacing:.06em;margin-right:8px}
/* 말로 답하기(P14) — 정의 바로 아래, 원본 모의면접 답변 2~3문단 */
.spoken{margin:7px 0 0;padding:8px 12px 4px;background:rgba(230,225,215,.03);border-left:3px solid rgba(232,185,49,.4);border-radius:0 8px 8px 0}
.spoken .sl{display:block;color:var(--gold);font-weight:800;font-size:10.5px;letter-spacing:.06em;opacity:.85;margin-bottom:3px}
.spoken p{margin:0 0 6px;font-size:14px;line-height:1.72}
/* 원본 오버레이 정의 배너 — 중간 앵커로 들어와도 정의가 먼저 */
#ovdef{padding:8px 16px;font-size:13px;line-height:1.65;color:var(--muted);background:rgba(232,185,49,.05);border-bottom:1px solid var(--line);cursor:pointer;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#ovdef.open{display:block;-webkit-line-clamp:unset}
#ovdef[hidden]{display:none}
#ovdef:hover{color:var(--ink)}
.facts{margin:7px 0 0;padding-left:20px}
.facts li{margin:4px 0}
.rel{margin-top:9px;padding-top:8px;border-top:1px dashed var(--line);font-size:13.5px;color:var(--muted)}
a.jump{color:var(--gold);text-decoration:none;border-bottom:1px dotted rgba(232,185,49,.5)}
a.jump:hover{border-bottom-style:solid}
/* 자동 키워드 링크: 본문색 유지 + 은은한 금색 점선 (명시 링크와 구분) */
a.k{color:inherit;text-decoration:none;border-bottom:1px dotted rgba(232,185,49,.38);cursor:pointer}
a.k:hover{color:var(--gold);border-bottom-style:solid}
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
#ov{position:fixed;inset:0;z-index:50;background:rgba(10,10,12,.88);backdrop-filter:blur(4px)}
#ovp{position:absolute;inset:2.5vh 0;margin:0 auto;max-width:1360px;width:calc(100% - 32px);background:#202024;border:1px solid var(--line);border-radius:14px;display:flex;flex-direction:column;overflow:hidden}
#ovh{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);background:rgba(232,185,49,.05)}
#ovh button{background:none;border:1px solid var(--line);border-radius:7px;color:var(--ink);padding:4px 11px;cursor:pointer;font-size:13px}
#ovh button:hover{border-color:var(--gold);color:var(--gold)}
#ovtitle{flex:1;font-weight:700;font-size:14px;color:var(--gold);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 원본 오버레이 아웃라인 — 본문 옆에 자리를 '만들어' 놓는다(겹치지 않는다).
   항목은 개념 절(h2)과 그 아래 4구획뿐. 5-1 같은 더 깊은 헤딩은 넣지 않는다 —
   그게 예전 문서 안 목차 절이 본문을 가리던 원인이었다. */
#ovmain{flex:1;display:flex;min-height:0}
#ovbody{flex:1;min-width:0;overflow-y:auto;padding:14px 40px 90px}
/* 읽기 폭 — 산문은 80ch(한글 약 44자)로 묶고, 코드·표·도해는 컬럼 전체로 넓힌다.
   가로 스크롤을 만들지 않으려고 컬럼 자체를 넓혀 두었다. */
#ovbody p,#ovbody ul,#ovbody ol,#ovbody blockquote{max-width:88ch}
/* 모의면접 답변 — 한 줄에 한 문장. 소리 내어 읽는 글이라 문장 사이를 띄운다 */
#ovbody p.ansln{margin:10px 0}
#ovbody p.ansln+p.ansln{margin-top:10px}
#ovbody pre,#ovbody table,#ovbody .tblwrap{max-width:none}
#ovtoc{flex:0 0 244px;overflow-y:auto;border-left:1px solid rgba(230,225,215,.16);
  background:#1b1b1f;padding:10px 6px 40px}
#ovp.notoc #ovtoc{display:none}
/* 목차를 접으면 읽기 폭을 원래대로 — 목차는 폭을 '더' 쓰는 것이지 본문을 깎지 않는다 */
#ovp.notoc{max-width:980px}
#ovtoc .toch{font-size:11px;letter-spacing:.08em;color:var(--muted);padding:2px 10px 8px}
#ovtoc a{display:block;padding:7px 10px 7px 12px;margin:2px 0;border-radius:7px;
  color:var(--muted);font-size:12.5px;line-height:1.5;text-decoration:none;
  border-left:3px solid transparent;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  transition:background .16s ease,color .16s ease}
#ovtoc a:hover{background:rgba(230,225,215,.06);color:var(--ink)}
#ovtoc a.sec{color:var(--ink);font-weight:700;font-size:13px;margin-top:14px}
/* 구획(정의·차이점·동작·활용) — 소주제와 같은 규칙으로 접는다. 안 접으면 목차가 같은 네 단어의
   반복이 된다: CS_추가키워드_복습 은 헤딩 258개 중 156개(60%)가 이 넷이라 훑을 수가 없었다.
   지금 읽는 개념 절 아래만 .subon 으로 펼친다(2026-08-05). */
#ovtoc a.gu{display:none;margin-left:16px;padding-left:12px;font-size:12px;border-left-color:var(--t-c,transparent)}
#ovtoc a.gu.subon{display:block}
/* 소주제(3단계) — 기본 접힘. 지금 읽는 개념 절 아래만 .subon 으로 펼친다.
   항상 펴 두면 패널이 길어져 본문을 가린다. */
#ovtoc a.sub{display:none;margin-left:30px;padding:4px 8px 4px 10px;font-size:11.5px;
  color:var(--muted);border-left:2px solid rgba(230,225,215,.18)}
#ovtoc a.sub.subon{display:block}
#ovtoc a.sub.on{color:var(--gold);border-left-color:var(--gold);background:rgba(232,185,49,.10)}
#ovtoc a.t-def{--t-c:#dcb04b}
#ovtoc a.t-diff{--t-c:#77b6a9}
#ovtoc a.t-act{--t-c:#7fa8db}
#ovtoc a.t-use{--t-c:#b797d6}
#ovtoc a.t-cause{--t-c:#d98b6a}
#ovtoc a.t-fix{--t-c:#8fbf7a}
#ovtoc a.on{background:rgba(232,185,49,.16);color:var(--gold);border-left-color:var(--gold)}
#ovtoc a.gu.on{background:rgba(230,225,215,.10);color:var(--ink);border-left-color:var(--t-c)}
#ovh #ovtoc-t{font-size:12px;padding:4px 9px}
#ovp.notoc #ovtoc-t{color:var(--muted)}
#ovbody h1{font-size:23px;letter-spacing:-.01em;color:var(--gold);margin:6px 0 4px}
#ovbody h2{font-size:19.5px;font-weight:700;letter-spacing:-.01em;color:var(--gold);
  margin-top:56px;padding-bottom:9px;border-bottom:1px solid rgba(232,185,49,.22);scroll-margin-top:10px}
#ovbody h3{font-size:16px;font-weight:700;margin-top:26px;scroll-margin-top:10px}
#ovbody h4{font-size:15px;font-weight:700;color:var(--ink);margin:26px 0 8px;scroll-margin-top:10px}
#ovbody h5{font-size:13.5px;font-weight:700;color:var(--muted);letter-spacing:.02em;margin:18px 0 6px;scroll-margin-top:10px}
#ovbody h1,#ovbody h2,#ovbody h3,#ovbody h4{outline:2px solid transparent;border-radius:4px}
/* 4구획(정의·차이점·동작·활용·사용법) — 문단을 눈으로 갈라 준다.
   헤딩 레벨은 파일마다 다르므로(h2/h3/h4) 레벨이 아니라 빌더가 붙인 .gu 클래스로만 잡는다.
   구획마다 ① 위 구분선 + 넉넉한 여백 ② 좌측 컬러 바 ③ 이름 칩 ④ 본문 들여쓰기. */
#ovbody .gu{
  --gu-c:var(--gold); --gu-bg:rgba(232,185,49,.09); --gu-bd:rgba(232,185,49,.26);
  margin:34px 0 0; padding:18px 0 10px 18px;
  border-top:1px solid var(--line); border-left:2px solid var(--gu-c);
  border-radius:0 8px 8px 0;
  background:linear-gradient(90deg,var(--gu-bg),rgba(0,0,0,0) 55%);
}
#ovbody .gu.gu-def {--gu-c:#dcb04b;--gu-bg:rgba(220,176,75,.10);--gu-bd:rgba(220,176,75,.30)}
#ovbody .gu.gu-diff{--gu-c:#77b6a9;--gu-bg:rgba(119,182,169,.10);--gu-bd:rgba(119,182,169,.28)}
#ovbody .gu.gu-act {--gu-c:#7fa8db;--gu-bg:rgba(127,168,219,.10);--gu-bd:rgba(127,168,219,.28)}
#ovbody .gu.gu-use {--gu-c:#b797d6;--gu-bg:rgba(183,151,214,.10);--gu-bd:rgba(183,151,214,.28)}
#ovbody .gu.gu-cause{--gu-c:#d98b6a;--gu-bg:rgba(217,139,106,.10);--gu-bd:rgba(217,139,106,.28)}
#ovbody .gu.gu-fix  {--gu-c:#8fbf7a;--gu-bg:rgba(143,191,122,.10);--gu-bd:rgba(143,191,122,.28)}
/* 구획 이름 = 라벨 칩. 좌측 바에 물려 붙는다.
   :first-child 로 묶는 이유 — 구획 헤딩은 .gu 의 첫 자식으로만 나온다.
   이걸 빼면 구획 안의 소주제(#### 2-1. …)까지 칩이 돼서 위계가 뭉갠다. */
#ovbody .gu>h2:first-child,#ovbody .gu>h3:first-child,
#ovbody .gu>h4:first-child,#ovbody .gu>h5:first-child{
  display:inline-block; margin:0 0 16px -18px; padding:5px 16px 5px 18px;
  font-size:13px; font-weight:800; letter-spacing:.08em; line-height:1.5;
  color:var(--gu-c); background:var(--gu-bg);
  border:1px solid var(--gu-bd); border-left:2px solid var(--gu-c);
  border-radius:0 999px 999px 0; border-bottom-width:1px;
}
#ovbody .gu>h2:first-child{border-bottom:1px solid var(--gu-bd)}   /* h2 기본 밑줄 무력화 */
/* 구획 안의 소주제 — 칩이 아니라 조용한 헤딩. 왼쪽에 짧은 눈금만 준다 */
#ovbody .gu>h3:not(:first-child),#ovbody .gu>h4:not(:first-child),#ovbody .gu>h5:not(:first-child){
  position:relative;color:var(--ink);background:none;border:0;border-radius:0;
  display:block;margin-left:0;padding-left:11px;letter-spacing:0}
#ovbody .gu>h3:not(:first-child)::before,#ovbody .gu>h4:not(:first-child)::before,
#ovbody .gu>h5:not(:first-child)::before{
  content:'';position:absolute;left:0;top:.22em;bottom:.22em;width:2px;
  background:var(--gu-c);opacity:.5;border-radius:2px}
#ovbody .gu>:last-child{margin-bottom:0}
/* 구획 안의 하위 절은 구획보다 한 단계 조용하게 */
#ovbody .gu h3,#ovbody .gu h4,#ovbody .gu h6{margin-top:26px}
#ovbody .gu h5{margin-top:18px}
#ovbody p{margin:12px 0}
#ovbody li{margin:5px 0}
#ovbody pre,#ovbody table{margin:14px 0}

/* ③ 원본 "학습 영역" 파생 블록: 하단 이동 + 기본 접힘, 클릭 시 펼침 */
.study{margin:22px 0 8px;border:1px dashed var(--line);border-radius:10px;background:rgba(232,185,49,.03)}
.study>summary{cursor:pointer;padding:9px 14px;color:var(--muted);font-size:13px;list-style:none;user-select:none}
.study>summary::-webkit-details-marker{display:none}
.study>summary:hover{color:var(--gold)}
.study[open]>summary{color:var(--gold);border-bottom:1px dashed var(--line)}
.study-body{padding:0 16px 12px}
#ovbody .study-body h2{font-size:15px;margin-top:14px;padding-bottom:0;border-bottom:0}
#ovtoc a:focus-visible,#ovh button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
/* 키보드 포커스 — 위 두 곳에만 있었다. 본문 자동 링크 19,000여 개·좌측 목차·검색 결과·접힘
   summary 에는 표시가 없어서 탭으로 넘길 때 지금 어디인지 알 수가 없었다(2026-08-05 실측).
   :focus-visible 이라 마우스 클릭에는 안 뜨고 키보드로 왔을 때만 뜬다. */
a:focus-visible,button:focus-visible,summary:focus-visible,
input:focus-visible,[tabindex]:focus-visible{
  outline:2px solid var(--gold);outline-offset:2px;border-radius:3px}
/* 검색창은 테두리 색만 바뀌어 저시력에서 구분이 어려웠다 — 윤곽선을 같이 준다 */
#q:focus-visible{outline:2px solid var(--gold);outline-offset:1px}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
/* 도메인 칩 줄 — 넓은 화면에서는 좌측 목차가 그 일을 하므로 숨긴다 */
#dchips{display:none}
.dchip{flex:none;padding:5px 11px;border:1px solid var(--line);border-radius:999px;
  color:var(--muted);font-size:12.5px;text-decoration:none;white-space:nowrap}
.dchip:hover,.dchip:focus-visible{color:var(--gold);border-color:var(--gold)}
@media(max-width:900px){
  #side{display:none}#wrap{padding:0 12px}.brand span{display:none}
  /* 자취 줄과 칩 줄이 둘 다 sticky 면 같은 자리에 겹친다. 자취는 오버레이 안에도 따로 있고
     (#ovtrail) 꼬리물기는 거기서 일어나므로, 좁은 화면에서는 메인 쪽 고정을 푼다 */
  #trail{position:static}
  #dchips{display:flex;gap:6px;overflow-x:auto;padding:8px 12px;
    position:sticky;top:57px;z-index:28;background:rgba(27,27,30,.94);backdrop-filter:blur(6px);
    border-bottom:1px solid var(--line);scrollbar-width:none}
  #dchips::-webkit-scrollbar{display:none}
  .dblock{scroll-margin-top:110px}
}
/* 좁은 화면 — 헤더 한 줄에 brand(110) + 검색(120) + 카운트(34) + 버튼 2개(각 90) 가 안 들어간다.
   검색을 아래 줄로 통째로 내려 100% 폭을 준다. #qpanel 이 #qwrap 폭을 따라가므로
   이 한 수로 "검색 결과 패널이 120px 폭으로 뜨는" 문제까지 같이 풀린다. */
@media(max-width:700px){
  #top{flex-wrap:wrap;padding:8px 10px;gap:8px}
  .brand{font-size:14px}
  #qcount{margin-left:auto;order:2}
  #top button{order:3;padding:6px 9px;font-size:12px}
  #qwrap{order:4;flex:1 0 100%;max-width:none;min-width:0}
  #trail{top:92px}                 /* 헤더가 두 줄이 되면서 높이가 커진다 */
  #dchips{top:92px}
  .card{scroll-margin-top:104px}
  .dblock{scroll-margin-top:145px}
  #ovp{inset:1vh 0;width:calc(100% - 12px);border-radius:10px}
  /* 오버레이 목차를 옆 컬럼이 아니라 **덮는 패널**로 띄운다. 244px 짜리 컬럼을 그대로 두면
     375px 화면에서 목차를 연 순간 본문에 120px 만 남아 읽을 수가 없었다(2026-08-05).
     ≡ 목차 버튼은 폭과 무관하게 동작하므로, 좁은 화면에서도 열 수 있어야 한다. */
  #ovmain{position:relative}
  #ovtoc{position:absolute;inset:0 0 0 auto;width:min(300px,86%);z-index:5;
    box-shadow:-12px 0 28px rgba(0,0,0,.5)}
}
/* 아주 좁은 화면 — 버튼 라벨을 접고 아이콘만 남긴다 */
@media(max-width:420px){
  #top button .btxt{display:none}
  #top button{padding:6px 8px}
}
`;

// ---------------------------------------------------------------------------
// 11) 클라이언트 JS
// ---------------------------------------------------------------------------
const clientJs = `
(function(){
var q=document.getElementById('q'),qc=document.getElementById('qcount'),qp=document.getElementById('qpanel');
var quizBtn=document.getElementById('quiz'),randBtn=document.getElementById('rand');
var ov=document.getElementById('ov'),ovBody=document.getElementById('ovbody'),ovTitle=document.getElementById('ovtitle');
var FILE_NAMES=__FILE_NAMES__;
var FILE_DEFS=__FILE_DEFS__;
var ovDef=document.getElementById('ovdef');
var KW=__KW__;
__SEARCH_CORE__
var SIDX=CORE.prepIndex(__SIDX__);
var topics=[].slice.call(document.querySelectorAll('#main .topic'));
var cards=[].slice.call(document.querySelectorAll('#main .card'));
var blocks=[].slice.call(document.querySelectorAll('#main .dblock'));
var texts=new Map();cards.forEach(function(c){texts.set(c,c.textContent.toLowerCase());});
var hist=[];
var lastRes=null;

function flash(el){el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');}

/* ---- 꼬리물기 브레드크럼: 키워드 점프 경로 기록·표시·되돌아가기 ---- */
var trail=[];
var trailEl=document.getElementById('trail'),ovtrailEl=document.getElementById('ovtrail');
function lbl16(s){s=String(s).replace(/\\s+/g,' ').trim();return s.length>16?s.slice(0,15)+'…':s;}
function txtOf(el){return lbl16(el.textContent);}
function sameTgt(a,b){return !!a&&!!b&&a.c===b.c&&a.f===b.f&&a.t===b.t;}
function navTo(tgt){if(tgt.c)goCard(tgt.c);else openSrc(tgt.f,tgt.t);}
function trailRender(){
  var h='';
  if(trail.length){
    h='<span class="tlabel">🧭</span>'+trail.map(function(s,i){
      return '<a class="tstep'+(i===trail.length-1?' cur':'')+'" data-ti="'+i+'" title="'+CORE.esc(s.label)+'">'+CORE.esc(s.label)+'</a>';
    }).join('<span class="tsep">→</span>')+'<button class="tclear" title="꼬리물기 이력 지우기">지우기 ✕</button>';
  }
  trailEl.innerHTML=h;trailEl.hidden=!trail.length;
  ovtrailEl.innerHTML=h;ovtrailEl.hidden=!trail.length;
}
function trailPush(label,tgt){
  if(trail.length&&sameTgt(trail[trail.length-1].tgt,tgt))return;
  trail.push({label:label,tgt:tgt});
  if(trail.length>8)trail.shift();
  trailRender();
}
function trailReset(entry){trail=entry?[entry]:[];trailRender();}
/* 체인 시작점: 첫 키워드 클릭 시 현재 읽던 카드/원본을 뿌리로 넣는다 */
function originEntry(link){
  var card=link.closest('#main .card.topic');
  if(card){var h3=card.querySelector('h3');return {label:txtOf(h3||card),tgt:{c:card.id}};}
  var sf=link.closest('.srcfile');
  if(sf){var fid=sf.id.slice(2);return {label:lbl16((FILE_NAMES[fid]||fid).replace(/\\.md$/,'')),tgt:{f:fid,t:''}};}
  return null;
}

/* ---- 오버레이: 임베드 원본 점프 ---- */
function openSrc(fid,tid,noPush){
  var sec=document.getElementById('f-'+fid);
  if(!sec)return;
  var secs=ovBody.children;
  for(var i=0;i<secs.length;i++)secs[i].hidden=(secs[i]!==sec);
  ovTitle.textContent=FILE_NAMES[fid]||fid;
  /* 정의 배너: 파일 중간 앵커로 뛰어들어도 그 개념의 정의가 항상 위에 보인다. 클릭하면 전문 펼침.
     파일 맨 위로 여는 경우엔 숨긴다 — 바로 아래 "모의면접 답변"과 같은 문장이라 두 번 읽힌다. */
  var fd=FILE_DEFS[fid]||'';
  ovDef.textContent=fd;ovDef.hidden=!fd||!tid;ovDef.classList.remove('open');
  if(ov.hidden){ov.hidden=false;document.body.classList.add('lock');}
  tocApply();buildToc(sec);
  if(!noPush)hist.push({f:fid,t:tid||''});
  requestAnimationFrame(function(){
    var el=tid?document.getElementById(tid):null;
    if(el){
      var dd=el.closest('details'); /* 접힌 학습 영역 안의 앵커면 펼치고 점프 */
      while(dd){dd.open=true;dd=dd.parentElement?dd.parentElement.closest('details'):null;}
      el.scrollIntoView({block:'start'});flash(el);
    }
    else ovBody.scrollTop=0;
  });
}
/* ---- 원본 아웃라인(우측 목차) ----
   항목 = 개념 절(.gu 밖의 h2) + 각 4구획 블록의 첫 헤딩. 그보다 깊은 헤딩은 넣지 않는다.
   앵커는 본문에 이미 있는 id 를 그대로 쓴다(새로 만들지 않는다). */
var ovp=document.getElementById('ovp'),ovToc=document.getElementById('ovtoc'),
    ovTocList=document.getElementById('ovtoclist'),tocIO=null,tocMap=null;
var GU_T={'gu-def':'t-def','gu-diff':'t-diff','gu-act':'t-act','gu-use':'t-use','gu-cause':'t-cause','gu-fix':'t-fix'};
function tocWide(){return window.innerWidth>=1100;}
function tocPref(){try{return localStorage.getItem('cs.ovtoc')!=='0';}catch(e){return true;}}
function tocApply(){ovp.classList.toggle('notoc',!(tocPref()&&tocWide()));}
function buildToc(sec){
  if(tocIO){tocIO.disconnect();tocIO=null;}
  ovTocList.innerHTML='';tocMap=Object.create(null);
  var hs=sec.querySelectorAll('h2,h3,h4,h5'),items=[],targets=[],curSec='';
  for(var i=0;i<hs.length;i++){
    var el=hs[i],gu=el.parentElement&&el.parentElement.classList.contains('gu')?el.parentElement:null;
    var isGu=gu&&gu.firstElementChild===el;
    /* 구획 안의 소주제(h4/h5)도 담는다 — "6-8. map vs unordered_map" 처럼 이름이 있어야
       찾아가는 소주제가 여기 걸린다. 다만 항상 펴 두면 패널이 본문을 가리므로
       기본은 접어 두고, 지금 읽고 있는 개념 절 아래만 펼친다(.subon). */
    var isSub=!isGu&&!!gu&&el.tagName!=='H2';
    /* 구획이 아닌 h3 — 모의면접 답변이 여기 걸린다. 구획도 H2 도 아니라 목차에서 통째로
       빠지고 있었다(350개). 그러면 목차만 보는 사람에게는 그 절이 정의부터 시작하는 것으로
       읽힌다 — 답변이 절 맨 위에 있는데도. 구획과 같은 층으로 담는다. */
    var isBareH3=!isGu&&!isSub&&el.tagName==='H3';
    if(!isGu&&!isSub&&!isBareH3&&(el.tagName!=='H2'||gu))continue;
    if(!el.id)continue;
    var a=document.createElement('a');
    a.href='#';a.setAttribute('data-h',el.id);
    a.textContent=el.textContent.replace(/\\s+/g,' ').trim();  /* \\\\s — 템플릿 리터럴이 \\s 를 s 로 먹는다 */
    if(isGu)a.className='gu '+(GU_T[gu.classList[1]]||'');
    else if(isSub)a.className='sub';
    else if(isBareH3)a.className='gu';   /* 구획과 같은 들여쓰기 — H2 층으로 올리면 개념 절처럼 보인다 */
    else a.className='sec';
    /* 개념 절 경계는 **H2 만** 긋는다. 맨몸 h3 가 경계를 새로 그으면 그 뒤 구획들이
       다른 절에 속한 것으로 묶여 "지금 읽는 절만 펼치기" 가 어긋난다. */
    if(!isGu&&!isSub&&!isBareH3)curSec=el.id;
    a.setAttribute('data-sec',curSec);
    ovTocList.appendChild(a);items.push(a);targets.push(el);tocMap[el.id]=a;
  }
  /* 지금 읽는 개념 절의 구획·소주제만 펼친다 */
  function tocSub(secId){
    var ss=ovTocList.querySelectorAll('a.sub,a.gu');
    for(var i=0;i<ss.length;i++)ss[i].classList.toggle('subon',ss[i].getAttribute('data-sec')===secId);
  }
  ovTocList.__sub=tocSub;
  if(!items.length){ovToc.hidden=true;return;}
  ovToc.hidden=false;
  /* 현재 읽는 위치 강조 — 본문 상단 얇은 띠에 걸린 헤딩을 현재 절로 본다 */
  tocIO=new IntersectionObserver(function(es){
    for(var j=0;j<es.length;j++){
      if(!es[j].isIntersecting)continue;
      var a=tocMap[es[j].target.id];if(!a)continue;
      for(var k=0;k<items.length;k++)items[k].classList.remove('on');
      a.classList.add('on');
      /* 현재 개념 절의 소주제만 펼침 — 구획·소주제에 걸렸으면 그 절을 거슬러 찾는다 */
      tocSub(a.getAttribute('data-sec'));
      if(a.offsetTop<ovToc.scrollTop||a.offsetTop>ovToc.scrollTop+ovToc.clientHeight-30)
        ovToc.scrollTop=a.offsetTop-ovToc.clientHeight/3;
    }
  },{root:ovBody,rootMargin:'0px 0px -82% 0px',threshold:0});
  for(var t=0;t<targets.length;t++)tocIO.observe(targets[t]);
}
ovTocList.addEventListener('click',function(e){
  var a=e.target.closest('a[data-h]');if(!a)return;
  e.preventDefault();
  var el=document.getElementById(a.getAttribute('data-h'));if(!el)return;
  var dd=el.closest('details');while(dd){dd.open=true;dd=dd.parentElement?dd.parentElement.closest('details'):null;}
  el.scrollIntoView({block:'start'});flash(el);
  /* 좁은 화면에서는 목차가 본문을 덮는 패널이라, 고르고 나면 닫아야 그 자리가 보인다 */
  if(window.innerWidth<=700)ovp.classList.add('notoc');
});
document.getElementById('ovtoc-t').addEventListener('click',function(){
  var next=ovp.classList.contains('notoc');
  try{localStorage.setItem('cs.ovtoc',next?'1':'0');}catch(e){}
  ovp.classList.toggle('notoc',!next);
});
window.addEventListener('resize',function(){if(!ov.hidden)tocApply();});

function closeOv(){ov.hidden=true;hist=[];document.body.classList.remove('lock');if(tocIO){tocIO.disconnect();tocIO=null;}}
function goBack(){
  if(hist.length<2){closeOv();return;}
  hist.pop();
  var p=hist[hist.length-1];
  openSrc(p.f,p.t,true);
}
ovDef.addEventListener('click',function(){ovDef.classList.toggle('open');});
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

/* ---- 클릭 위임 (자동 키워드 링크 포함 — 링크마다 리스너 없이 문서 1개) ---- */
document.addEventListener('click',function(e){
  if(!e.target.closest)return;
  if(!qp.hidden&&!e.target.closest('#qwrap'))hidePanel();
  var ts=e.target.closest('.tstep'); /* 브레드크럼 단계: 그 지점으로 되돌아가기 */
  if(ts){e.preventDefault();var ti=+ts.getAttribute('data-ti');trail=trail.slice(0,ti+1);trailRender();navTo(trail[ti].tgt);return;}
  if(e.target.closest('.tclear')){trailReset(null);return;}
  var r=e.target.closest('#qpanel .qres');
  if(r){
    e.preventDefault();hidePanel();
    var rt=r.hasAttribute('data-file')?{f:r.getAttribute('data-file'),t:r.getAttribute('data-target')}:{c:r.getAttribute('data-card')};
    trailReset({label:r.getAttribute('data-lbl')||'검색',tgt:rt}); /* 검색 진입 = 새 꼬리물기 시작 */
    navTo(rt);
    return;
  }
  var k=e.target.closest('a.k'); /* 자동 키워드 링크 → 사전 타깃으로 점프 */
  if(k){
    e.preventDefault();
    var kw=KW[+k.getAttribute('data-k')];
    if(!kw)return;
    if(!trail.length){var o=originEntry(k);if(o)trail.push(o);}
    var kt=kw.c?{c:kw.c}:{f:kw.f,t:kw.t};
    trailPush(txtOf(k),kt);
    navTo(kt);
    return;
  }
  var j=e.target.closest('a.jump');
  if(j){
    e.preventDefault();
    var jt={f:j.getAttribute('data-file'),t:j.getAttribute('data-target')};
    if(j.classList.contains('srcbtn')){
      var jc=j.closest('.card'),jh=jc&&jc.querySelector('h3');
      trailPush((jh?txtOf(jh):'')+' 원본',jt);
    }else{
      if(!trail.length){var o2=originEntry(j);if(o2)trail.push(o2);}
      trailPush(txtOf(j),jt);
    }
    openSrc(jt.f,jt.t);
    return;
  }
  var s=e.target.closest('[data-card]');
  if(s){e.preventDefault();if(s.classList.contains('sitem'))trailReset(null);goCard(s.getAttribute('data-card'));return;}
  if(document.body.classList.contains('quiz')){
    var card=e.target.closest?e.target.closest('.topic'):null;
    if(card&&!e.target.closest('a,button'))card.classList.toggle('revealed');
  }
});

/* ---- 검색: 랭킹 패널 + 카드 필터 + 하이라이트 ---- */
function clearMarks(){
  var ms=[].slice.call(document.querySelectorAll('#main mark'));
  ms.forEach(function(m){m.replaceWith(document.createTextNode(m.textContent));});
}
function markCard(card,forms){
  forms.forEach(function(s){
    var w=document.createTreeWalker(card,NodeFilter.SHOW_TEXT),nodes=[];
    while(w.nextNode())nodes.push(w.currentNode);
    nodes.forEach(function(n){
      if(n.parentNode&&n.parentNode.nodeName==='MARK')return;
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
  });
}
function hidePanel(){qp.hidden=true;}
/* 즉답용: 임베드된 원본 DOM에서 섹션 본문 텍스트 추출 (헤딩 다음 ~ 같은 레벨 전, 코드 제외) */
function secText(fid,dom){
  var el=dom?document.getElementById(dom):null;
  if(!el){var sec=document.getElementById('f-'+fid);el=sec&&sec.querySelector('h1,h2,h3,h4,h5,h6');}
  if(!el)return'';
  var lv=+el.tagName[1]||6,out='',n=el.nextElementSibling;
  while(n&&out.length<320){
    var tn=n.tagName;
    if(/^H[1-6]$/.test(tn)&&+tn[1]<=lv)break;
    if(tn!=='PRE')out+=' '+n.textContent;
    n=n.nextElementSibling;
  }
  return out.replace(/\\s+/g,' ').trim();
}
/* 검색 즉답 패널: 최상위 결과의 정의 2~3줄 (클릭 없이 훑기) */
function ansTopic(r,res){
  var t=r.t,forms=CORE.matchForms(t._all,res.toks),defs='';
  t.lines.slice(0,2).forEach(function(l){
    if(!l)return;
    defs+='<div class="qad">'+CORE.hilite(l.length>170?l.slice(0,169)+'…':l,forms)+'</div>';
  });
  return '<a class="qres qans" href="#" data-card="'+t.c+'" data-lbl="'+CORE.esc(lbl16(t.ti))+'">'+
    '<div class="qat"><b>'+t.num+'</b> '+CORE.hilite(t.ti,forms)+'<i class="qtag">즉답</i></div>'+defs+'</a>';
}
function ansSec(r,res){
  var dom='f-'+r.f+'--'+r.slug,forms=CORE.matchForms(r.h.toLowerCase(),res.toks);
  var body=secText(r.f,dom),bf=body?CORE.matchForms(body.toLowerCase(),res.toks):[];
  var bd=body?'<div class="qad">'+CORE.hilite(CORE.clip(body,bf,230),bf)+'</div>':'';
  return '<a class="qres qans" href="#" data-file="'+r.f+'" data-target="'+dom+'" data-lbl="'+CORE.esc(lbl16(r.h))+'">'+
    '<div class="qat">'+CORE.hilite(r.h,forms)+'<span class="qfn">'+CORE.esc(r.fn)+'</span></div>'+bd+'</a>';
}
var BAND_TAG={1:'제목',2:'연관',3:'제목 일부',4:'본문',5:'연관 일부'};
/* 즉답·Enter가 고르는 한 건. 우선순위: 주제 제목 직격 > 원본 헤딩 직격 > 나머지.
   연관 키워드로만 걸린 주제(band2)가 헤딩 직격 섹션을 밀어내면 "생성자" 검색에
   엉뚱한 주제가 즉답으로 올라온다 — 그래서 band1 만 주제를 먼저 세운다.
   Enter 가 topics[0] 을 무조건 고르면 카드가 하나라도 걸릴 때 원본 절로 갈 길이 없다. */
function bestHit(res){
  var bt=res.topics[0],bs=res.sections[0];
  /* 정의형 제목 절(해시(Hash) 가 뭔가 · 한 줄 정의 — …)이 걸렸으면 카드보다 먼저 세운다.
     검색으로 용어를 치는 목적이 그 용어의 정의를 보는 것이기 때문이다. 이걸 안 하면
     제목에 그 용어가 든 카드(15. 해시 / push_back vs emplace_back)가 band1 이라는
     이유만으로 즉답을 가져가, 정의 절이 섹션 1위여도 화면 위쪽에서는 안 보인다.
     주의 — 이 주석에 백틱을 쓰면 clientJs 템플릿 리터럴이 끊겨 빌드가 죽는다. */
  if(bs&&bs.band===1&&bs.def===0)return {s:bs};
  if(bt&&(bt.band===1||!bs))return {t:bt};
  if(bs&&bs.band===1)return {s:bs};
  if(bt)return {t:bt};
  if(bs)return {s:bs};
  return null;
}
/* 주제 카드는 상위 TOPN 개만 먼저 그린다 — 개수 제한 없이 다 그리면 카드가 6~17개 걸리는
   흔한 질의에서 정본 원본 절이 리스트 30~40번째로 밀려 상위 5에 한 건도 안 보인다. */
var TOPN=3;
function renderTopic(r,res,h){
  var t=r.t,forms=CORE.matchForms(t._all,res.toks);
  var line=CORE.bestLine(t.lines,res.toks);
  var sn=line?'<span class="qsn">'+CORE.hilite(CORE.clip(line,forms),forms)+'</span>':'';
  h.push('<a class="qres" href="#" data-card="'+t.c+'" data-lbl="'+CORE.esc(lbl16(t.ti))+'"><span class="qtt"><b>'+t.num+'</b> '+CORE.hilite(t.ti,forms)+'<i class="qtag">'+BAND_TAG[r.band]+'</i></span>'+sn+'</a>');
}
function renderPanel(res){
  var h=[];
  var best=bestHit(res);
  if(best&&best.t)h.push(ansTopic(best.t,res));
  else if(best&&best.s)h.push(ansSec(best.s,res));
  function grpTopics(){
    if(!res.topics.length)return;
    h.push('<div class="qgh">주제 <b>'+res.topics.length+'</b>건</div>');
    res.topics.slice(0,TOPN).forEach(function(r){renderTopic(r,res,h);});
  }
  function secRow(r){
    var forms=CORE.matchForms(r.h.toLowerCase(),res.toks);
    h.push('<a class="qres" href="#" data-file="'+r.f+'" data-target="f-'+r.f+'--'+r.slug+'" data-lbl="'+CORE.esc(lbl16(r.h))+'"><span class="qtt">'+CORE.hilite(r.h,forms)+'<span class="qfn">'+CORE.esc(r.fn)+'</span></span></a>');
  }
  function grpSecs(from,to,cont){
    var list=res.sections.slice(from,to);
    if(!list.length)return;
    h.push('<div class="qgh">원본 섹션'+(cont?' (계속)':'')+' <b>'+(cont?res.sections.length-from:res.sections.length)+'</b>건</div>');
    list.forEach(secRow);
    if(to>=50&&res.sections.length>50)h.push('<div class="qmore">… 외 '+(res.sections.length-50)+'건</div>');
  }
  /* 목록 순서는 즉답이 고른 쪽을 따라간다. 주제를 늘 먼저 그리던 탓에, 즉답은 정의 절을 옳게
     집어 놓고 바로 아래 첫 줄은 카드였다 — "스택오버플로우" 를 치고 맨 위 줄을 눌렀더니 그
     개념의 정의가 아니라 01 런타임 카드의 스택오버플로 언급으로 갔다는 신고가 이것이고
     (2026-08-10), "메모리 단편화" 도 같은 자리에서 카드로 샜다. band 비교로는 뒤가 안 잡힌다 —
     카드 제목이 질의와 같으면 절과 동률(band1)이라 규칙이 안 걸린다. 즉답 규칙 하나만 본다.
     절이 먼저 설 때는 앞 SECN 개만 세우고 주제를 끼운다. 50개를 통째로 앞세우면 그 질의의
     주제 카드가 화면 밖으로 밀려 "카드가 안 나온다"가 된다. */
  var SECN=12;
  if(best&&best.s){grpSecs(0,SECN,false);grpTopics();grpSecs(SECN,50,true);}
  else{grpTopics();grpSecs(0,50,false);}
  if(res.topics.length>TOPN){
    h.push('<div class="qgh">주제 (계속) <b>'+(res.topics.length-TOPN)+'</b>건</div>');
    res.topics.slice(TOPN).forEach(function(r){renderTopic(r,res,h);});
  }
  if(!h.length)h.push('<div class="qempty">결과 없음</div>');
  qp.innerHTML=h.join('');
  qp.scrollTop=0;
  qp.hidden=false;
}
function applyFilter(){
  var s=q.value.trim();
  clearMarks();
  if(!s){
    lastRes=null;
    cards.forEach(function(c){c.hidden=false;});
    blocks.forEach(function(b){b.hidden=false;});
    qc.textContent='';hidePanel();spyUpdate();return;
  }
  var res=CORE.search(SIDX,s);
  lastRes=res;
  var hit={};
  res.topics.forEach(function(r){hit[r.t.c]=1;});
  /* 주제 히트 0인데 원본 섹션은 잡힌 질의(예: dfs)에서 카드를 전부 숨기면 화면이 백지가 돼
     "검색해도 안 나온다"로 보인다 — 걸러낼 주제가 없으면 필터를 걸지 않는다. */
  var noTopic=!res.topics.length;
  cards.forEach(function(c){
    c.hidden=noTopic?false:!hit[c.id];
    if(!c.hidden){
      var forms=CORE.matchForms(texts.get(c),res.toks);
      if(forms.length)markCard(c,forms);
    }
  });
  blocks.forEach(function(b){
    var any=[].slice.call(b.querySelectorAll('.card')).some(function(c){return !c.hidden;});
    b.hidden=!any;
  });
  qc.textContent='주제 '+res.topics.length+' · 원본 '+res.sections.length;
  renderPanel(res);
  spyUpdate();
}
var deb;
q.addEventListener('input',function(){clearTimeout(deb);deb=setTimeout(applyFilter,80);});
q.addEventListener('focus',function(){if(q.value.trim()&&qp.hidden)applyFilter();});
q.addEventListener('keydown',function(e){
  if(e.key!=='Enter')return;
  e.preventDefault();clearTimeout(deb);
  if(q.value.trim())applyFilter();
  if(!lastRes)return;
  var best=bestHit(lastRes);
  if(!best)return;
  hidePanel();
  if(best.t){var t=best.t;trailReset({label:lbl16(t.t.ti),tgt:{c:t.t.c}});goCard(t.t.c);}
  else {var sc=best.s,et={f:sc.f,t:'f-'+sc.f+'--'+sc.slug};trailReset({label:lbl16(sc.h),tgt:et});openSrc(et.f,et.t);}
});

/* ---- 모의면접 모드 + 랜덤 ---- */
function setQuiz(on){
  document.body.classList.toggle('quiz',on);
  quizBtn.classList.toggle('on',on);
  /* 카드를 포커스 받을 수 있게 한다 — 모의면접 모드는 카드를 눌러야 답이 열리는데
     카드가 tabbable 이 아니라 키보드로는 아예 열 수 없었다(2026-08-05). 모드를 끄면 되돌린다. */
  topics.forEach(function(t){
    t.classList.remove('revealed');
    if(on){t.setAttribute('tabindex','0');t.setAttribute('role','button');}
    else{t.removeAttribute('tabindex');t.removeAttribute('role');}
  });
}
/* 모의면접 모드에서 Enter·Space 로 답 공개 */
document.addEventListener('keydown',function(e){
  if(!document.body.classList.contains('quiz'))return;
  if(e.key!=='Enter'&&e.key!==' ')return;
  var card=e.target&&e.target.closest?e.target.closest('#main .card.topic'):null;
  if(!card)return;
  e.preventDefault();card.classList.toggle('revealed');
});
quizBtn.addEventListener('click',function(){setQuiz(!document.body.classList.contains('quiz'));});
randBtn.addEventListener('click',function(){
  if(!document.body.classList.contains('quiz'))setQuiz(true);
  trailReset(null);
  var t=topics[Math.floor(Math.random()*topics.length)];
  t.classList.remove('revealed');
  if(t.hidden){q.value='';applyFilter();}
  if(!ov.hidden)closeOv();
  t.scrollIntoView({behavior:'smooth',block:'center'});
  flash(t);
});

/* ---- 음성: 검색 + 면접 라운드 (Web Speech API, ko-KR) ---- */
(function(){
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  var vsBtn=document.getElementById('vsearch'),vqBtn=document.getElementById('vquiz');
  var vpanel=document.getElementById('vpanel'),vstatus=document.getElementById('vstatus'),vtext=document.getElementById('vtext');
  if(!vpanel)return;
  function showV(msg,txt){vpanel.hidden=false;vstatus.innerHTML=msg||'';if(txt!=null)vtext.textContent=txt;}
  function hideV(){vpanel.hidden=true;}
  function guard(){
    if(!SR){showV('⚠️ 이 브라우저는 음성인식 미지원 — <b>Chrome 또는 Edge</b>에서 열어주세요.','');return false;}
    if(!window.isSecureContext){showV('⚠️ 마이크는 보안 컨텍스트에서만 됩니다 — <b>file:// 이 아니라 http://localhost</b> 로 여세요. cs-notion 폴더에서 <code>py -3 -m http.server 8850</code> 실행 후 <b>localhost:8850/interview-viewer.html</b>.','');return false;}
    return true;
  }
  function speak(text,cb){try{window.speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';u.rate=1;if(cb)u.onend=cb;window.speechSynthesis.speak(u);}catch(e){if(cb)cb();}}
  function listen(onFinal,onInterim){
    var r=new SR();r.lang='ko-KR';r.interimResults=true;r.maxAlternatives=1;r.continuous=false;var fin='';
    r.onresult=function(e){var it='';for(var i=e.resultIndex;i<e.results.length;i++){var tr=e.results[i][0].transcript;if(e.results[i].isFinal)fin+=tr;else it+=tr;}if(onInterim)onInterim((fin+it).trim());};
    r.onerror=function(e){showV('⚠️ 인식 오류: '+e.error+' (마이크 권한을 확인하세요)',fin.trim());};
    r.onend=function(){if(onFinal)onFinal(fin.trim());};
    try{r.start();}catch(e){showV('⚠️ 시작 실패: '+e.message,'');}
    return r;
  }
  var vsRec=null;
  vsBtn&&vsBtn.addEventListener('click',function(){
    if(vsRec){vsRec.stop();vsRec=null;vsBtn.classList.remove('on');return;}
    if(!guard())return;
    vsBtn.classList.add('on');showV('🎙️ 듣는 중… 검색할 키워드를 말하세요','');
    vsRec=listen(function(txt){
      vsBtn.classList.remove('on');vsRec=null;
      if(!txt){showV('못 알아들었어요. 다시 시도하세요.','');return;}
      showV('🔎 검색: <b>'+txt+'</b>','');
      q.value=txt;applyFilter();
      var best=lastRes?bestHit(lastRes):null;
      if(best){hidePanel();
        if(best.t){trailReset({label:lbl16(best.t.t.ti),tgt:{c:best.t.t.c}});goCard(best.t.t.c);}
        else{var sc=best.s,et={f:sc.f,t:'f-'+sc.f+'--'+sc.slug};trailReset({label:lbl16(sc.h),tgt:et});openSrc(et.f,et.t);}
        setTimeout(hideV,1600);
      }else showV('결과 없음: <b>'+txt+'</b>','');
    },function(it){showV('🎙️ 듣는 중…',it);});
  });
  var vqRec=null;
  vqBtn&&vqBtn.addEventListener('click',function(){
    if(vqRec){vqRec.stop();vqRec=null;return;}
    if(!guard())return;
    if(!document.body.classList.contains('quiz'))setQuiz(true);
    trailReset(null);
    var t=topics[Math.floor(Math.random()*topics.length)];
    t.classList.remove('revealed');
    if(t.hidden){q.value='';applyFilter();}
    if(!ov.hidden)closeOv();
    t.scrollIntoView({behavior:'smooth',block:'center'});flash(t);
    var hh=t.querySelector('.card-head h3');var qtext=hh?hh.textContent.trim():'';
    showV('🗣️ 문제: <b>'+qtext+'</b><br>읽어주는 중… 끝나면 마이크가 켜집니다','');
    speak(qtext+'. 설명해 보세요.',function(){
      showV('🎤 답변하세요 — 다 말하고 잠시 멈추면 자동 종료됩니다','');
      vqRec=listen(function(ans){
        vqRec=null;
        showV('📝 내 답변 전사 (모범답안과 대조하세요):',ans||'(인식된 내용 없음)');
        t.classList.add('revealed');
      },function(it){showV('🎤 답변 듣는 중…',it);});
    });
  });
})();

/* ---- 좌측 목차 스크롤 스파이: 현재 보고 있는 카드 하이라이트 ---- */
var side=document.getElementById('side');
var spyMap={};
[].slice.call(document.querySelectorAll('#side .sitem')).forEach(function(a){spyMap[a.getAttribute('data-card')]=a;});
var spyCur=null,spyTick=false;
function spyUpdate(){
  spyTick=false;
  var best=null,bestTop=-1e9,first=null;
  for(var i=0;i<cards.length;i++){
    var c=cards[i];
    if(c.hidden)continue;
    if(!first)first=c;
    var top=c.getBoundingClientRect().top;
    if(top<=130&&top>bestTop){bestTop=top;best=c;} /* 화면 상단(헤더 아래)을 지난 마지막 카드 */
  }
  if(!best)best=first;
  var id=best?best.id:null;
  if(id===spyCur)return;
  if(spyCur&&spyMap[spyCur])spyMap[spyCur].classList.remove('cur');
  spyCur=id;
  var it=id?spyMap[id]:null;
  if(it){
    it.classList.add('cur');
    var r=it.getBoundingClientRect(),p=side.getBoundingClientRect();
    if(r.top<p.top+8||r.bottom>p.bottom-8)it.scrollIntoView({block:'nearest'});
  }
}
window.addEventListener('scroll',function(){if(!spyTick){spyTick=true;requestAnimationFrame(spyUpdate);}},{passive:true});
spyUpdate();

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
`
  .replace('__FILE_NAMES__', () => fileNamesJson)
  .replace('__FILE_DEFS__', () => fileDefsJson)
  .replace('__KW__', () => JSON.stringify(kwOut).replace(/</g, '\\u003c'))
  .replace('__SEARCH_CORE__', () => `/*__CORE_START__*/\nvar CORE=(${SEARCH_CORE.toString()})();\n/*__CORE_END__*/`)
  .replace('__SIDX__', () => searchIdxJson);

// ---------------------------------------------------------------------------
// 12) 최종 HTML 조립 + 쓰기
// ---------------------------------------------------------------------------
const prevSize = fs.existsSync(OUT_PATH) ? fs.statSync(OUT_PATH).size : 0; // 크기 증가 감시용
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
<div id="qwrap"><input id="q" type="search" placeholder="검색 — 주제·연관·원본 섹션 ( / )" autocomplete="off"><div id="qpanel" hidden></div></div>
<span id="qcount"></span>
<button id="quiz" title="답을 가리고 카드 클릭으로 공개 — 답이 접히니 제목만 훑어보는 용도로도 쓴다">🎤<span class="btxt"> 모의면접</span></button>
<button id="rand" title="랜덤 주제로 점프 (답 가린 채)">🎲<span class="btxt"> 랜덤</span></button>
<button id="vsearch" title="말하면 그 키워드로 검색해 설명으로 점프 (Chrome/Edge · http://localhost 필요)">🎙️<span class="btxt"> 음성검색</span></button>
<button id="vquiz" title="랜덤 문제를 읽어주고, 마이크로 답하면 전사 후 모범답안 공개 (Chrome/Edge · http://localhost 필요)">🗣️<span class="btxt"> 음성면접</span></button>
</header>
<div id="vpanel" hidden><div id="vstatus"></div><div id="vtext"></div></div>
<div id="trail" hidden></div>
<nav id="dchips">${dchipsHtml}</nav>
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
<header id="ovh"><button id="ovback" title="이전 위치">←</button><span id="ovtitle"></span><button id="ovtoc-t" title="목차 접기/펴기">≡ 목차</button><button id="ovx" title="닫기 (Esc)">✕</button></header>
<div id="ovdef" title="이 개념의 정의 — 클릭하면 전문" hidden></div>
<div id="ovtrail" hidden></div>
<div id="ovmain">
<div id="ovbody">
${overlayFiles}
</div>
<aside id="ovtoc"><div class="toch">이 문서</div><nav id="ovtoclist"></nav></aside>
</div>
</div>
</div>
<script>${clientJs}</script>
</body>
</html>
`;

// 뷰어 JS 문법 검사 — 파싱만 한다(실행 아님).
// 여기서 안 걸리면 브라우저가 스크립트 전체를 버려서 클릭·검색이 통째로 죽는다. 조용히 죽는다.
try { new Function(clientJs); }
catch (e) { console.error('✖ 뷰어 JS 문법 오류 — 빌드 중단: ' + e.message); process.exit(1); }
// 삼켜진 정규식 이스케이프 — clientJs 템플릿 리터럴은 \s 를 s 로 먹어서 /\s+/ 가 /s+/ 로 나간다.
// 문법은 멀쩡해 위 파싱 검사에 안 걸리고, 화면에서 글자가 사라지는 형태로만 드러난다.
// 생성물이 아니라 이 파일의 템플릿 구간을 본다 — 생성물엔 본문 데이터의 `/` 가 섞여 오탐이 난다.
{
  const src = fs.readFileSync(new URL(import.meta.url), 'utf8').split(/\r?\n/);
  const a = src.findIndex((l) => /const clientJs\s*=\s*`/.test(l));
  let b = a + 1; while (b < src.length && !/^`/.test(src[b])) b++;
  const bad = [];
  for (let i = a; i < b; i++) if (/(^|[^\\])\\[sdwbSDWB]/.test(src[i])) bad.push((i + 1) + ': ' + src[i].trim());
  if (bad.length) { console.error('✖ 템플릿이 정규식 이스케이프를 먹었다(\\s → s). \\\\s 로 써라 — 빌드 중단:\n  ' + bad.join('\n  ')); process.exit(1); }
}

fs.writeFileSync(OUT_PATH, html, 'utf8');

// 키워드 사전 사이드카 — check-viewer-links.mjs 가 "사전에 있나 / 링크됐나 / 억제됐나"를
// 역추적하지 않게 생성기가 직접 내보낸다. [표면형, 링크수, 억제수]
const KWMAP_PATH = OUT_PATH.replace(/\.html$/, '.kwmap.json');
fs.writeFileSync(
  KWMAP_PATH,
  JSON.stringify([...kwDict.values()].map((e) => [e.surface, kwStats.perKw.get(e.surface) || 0, kwSkips.get(e.key) || 0])),
  'utf8',
);

// ---------------------------------------------------------------------------
// 13) 빌드 리포트
// ---------------------------------------------------------------------------
const kb = (n) => (n / 1024 >= 1024 ? (n / 1048576).toFixed(2) + ' MB' : Math.round(n / 1024) + ' KB');
const size = fs.statSync(OUT_PATH).size;
console.log(`✔ 주제 카드: ${topicCount}개 (도메인 ${domains.length}개${domains.map((d) => ` · ${d.num}=${d.topics.length}`).join('')})`);
console.log(`✔ 색인 섹션: ${extras.length}개`);
console.log(`✔ 원본 임베드: ${registry.size}파일 / ${totalSections}섹션(헤딩)`);
{
  const secs = searchIdx.files.reduce((n, f) => n + f.hs.length, 0);
  const bodyKB = searchIdx.files.reduce((n, f) => n + f.hs.reduce((m, h) => m + h[2].length, 0), 0) / 1024;
  console.log(`✔ 검색 인덱스: 주제 ${searchIdx.topics.length} · 원본 섹션 ${secs}(헤딩+본문 ${Math.round(bodyKB)} KB)`);
}
console.log(`✔ 링크: 해석 ${stats.resolved} · 파일상단 폴백 ${stats.fileTop} · 원본없음 ${stats.deadFile.length} · 외부 ${stats.external}`);
{
  const byPri = [0, 0, 0, 0];
  for (const e of kwDict.values()) byPri[e.pri]++;
  console.log(`✔ 키워드 사전: ${kwDict.size}표면형 (주제제목 ${byPri[3]} · 연관 ${byPri[2]} · 헤딩 ${byPri[1]}) → 자동 링크 ${kwStats.links}개 / 타깃 ${kwOut.length}종`);
  const top = [...kwStats.perKw.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`  자동 링크 상위: ${top.map(([k, n]) => `${k}(${n})`).join(' · ')}`);
  // 미링크 조사용: KW_PROBE="메모리 배리어,오픈 어드레싱" node tools/build-interview-viewer.mjs
  if (process.env.KW_PROBE) for (const s of process.env.KW_PROBE.split(',').map((x) => x.trim()).filter(Boolean)) {
    const e = kwDict.get(canonKey(s));
    const tg = e && e.target ? (e.target.kind === 'card' ? `카드 ${e.target.c}` : `${e.target.name}#${e.target.dom || '(상단)'}`) : '-';
    console.log(`  probe "${s}": 사전 ${e ? `O(pri${e.pri} 표면형="${e.surface}")` : 'X'} · 타깃 ${tg} · 링크 ${kwStats.perKw.get(s) || 0}건`);
  }
}
if (stats.fallbackList.length) {
  console.log(`  ⚠ 앵커 미해석(파일 상단으로 폴백) 상위 ${Math.min(20, stats.fallbackList.length)}건:`);
  for (const f of stats.fallbackList.slice(0, 20)) console.log(`    - ${f}`);
}
if (stats.deadFile.length) console.log(`  ⚠ 대상 파일 없음: ${[...new Set(stats.deadFile)].join(', ')}`);
console.log(`✔ ${path.relative(ROOT, OUT_PATH)} (${kb(size)})`);
if (prevSize) {
  const growth = ((size - prevSize) / prevSize) * 100;
  console.log(`  이전 빌드 ${kb(prevSize)} → ${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%${growth >= 20 ? ' ⚠ 20% 이상 증가' : ''}`);
}
// 카드 구조 검증(P13): 전 카드 면접 실전 순서(정의 최상단 · 연관 하단) + 학습 영역 접힘
{
  console.log(`✔ 카드 구조: 정의 최상단 ${cardStats.defTop}/${cardStats.total} · 말로 10~20초 정의 ${cardStats.speakable}/${cardStats.total}(원본 답변 ${cardStats.spoken}) · 연관 하단 ${cardStats.relBottom}/${cardStats.total} · 학습영역 접힘 ${studyFiles.length}파일(원본 하단 이동)`);
  if (cardStats.noDef.length) console.log(`  ⚠ 정의 불릿 없는 카드: ${cardStats.noDef.join(', ')}`);
  if (cardStats.noSpoken.length) console.log(`  ⚠ 말로 10~20초 정의 미달 카드: ${cardStats.noSpoken.join(', ')}`);
  if (cardStats.noRel.length) console.log(`  ⚠ 연관 불릿 없는 카드: ${cardStats.noRel.join(', ')}`);
}
// 구조 검증: 주제 번호 중복 / 원본 파일 누락
{
  const nums = domains.flatMap((d) => d.topics.map((t) => t.num));
  const dupNums = nums.filter((n, i) => nums.indexOf(n) !== i);
  if (dupNums.length) console.log(`⚠ 주제 번호 중복: ${[...new Set(dupNums)].join(', ')}`);
  const noSrc = domains.flatMap((d) => d.topics).filter((t) => !registry.has(t.file));
  if (noSrc.length) console.log(`⚠ 원본 파일 없는 주제: ${noSrc.map((t) => `${t.num}(${t.file})`).join(', ')}`);
}
