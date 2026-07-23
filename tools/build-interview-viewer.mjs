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
//   - 실시간 랭킹 검색: 제목→연관→본문 순 정렬 + 원본 섹션(헤딩) 별도 그룹,
//     조사·어간 완화 AND 매칭, 매칭 스니펫, Enter=첫 결과 점프, `/` = 포커스
//   - 좌측 도메인 트리 → 카드 점프, 카드 안 🔗연관/NN_*.md#앵커 → 임베드된
//     원본 섹션 오버레이로 뷰어 내 점프 (외부 파일 이동 없음)
//   - 키워드 순환 링크망: 주제 제목·연관 키워드·원본 헤딩·괄호 별칭으로 만든
//     사전을 카드 본문·임베드 원본에 자동 링크化(문단당 1회, 코드·기존 링크 제외)
//     → 키워드↔설명 무한 순환. 꼬리물기 브레드크럼(🧭)으로 경로 표시·되돌아가기
//   - 검색 즉답 패널: 최상위 결과의 정의 2~3줄을 검색창 바로 아래 즉시 표시
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
].map(canonKey));

// 헤딩·제목 원문 → 키워드 표면형들 (번호·이모지 제거, — 앞부분, 괄호 안팎, ·/병기 분리)
function kwVariants(raw) {
  const base = stripInlineMd(raw)
    .replace(/[\p{Extended_Pictographic}\u{FE0F}⭐]/gu, ' ')
    .replace(/^\s*(?:\d+(?:[.\-–]\d+)*[.)]?|q\d+[.)]?)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[?!.:…]+$/, '')
    .trim();
  const set = new Set();
  const push = (v) => {
    v = v.replace(/\s+/g, ' ').replace(/^[\s·—–-]+|[\s·—–-]+$/g, '').trim();
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
    if (/\s\/|\/\s/.test(b)) b.split(/\s+\/\s*|\s*\/\s+/).forEach(push);
    if (b.includes('·')) b.split('·').forEach(push);
  }
  return [...set].filter(kwValid);
}
function kwValid(v) {
  if (v.length > 60) return false;
  if (/(세요|시오|는가|은가|인가|한가|할까|일까|나요|까요)$/.test(v)) return false; // 질문형 헤딩 꼬리
  const ck = canonKey(v);
  if (!ck || ck.length < 2 || KW_STOP.has(ck)) return false;
  if (/^\d+$/.test(ck)) return false;
  if (/[가-힣]/.test(v)) return true; // 한글 포함: canonKey 2자 이상
  const core = v.replace(/[^A-Za-z0-9+#._:]/g, '');
  return core.length >= 3 || /^[A-Z0-9]{2}$/.test(v.trim()); // 라틴: 3자+ 또는 GC·OS류 2자 대문자
}

const kwDict = new Map(); // canonKey(표면형) → {surface, lc, len, latinEnd, target, pri}
function addKw(raw, target, pri) {
  for (const surface of kwVariants(raw)) {
    const key = canonKey(surface);
    const old = kwDict.get(key);
    if (old && old.pri >= pri) continue; // 충돌: 주제 제목 > 연관 키워드 > 원본 헤딩
    const esc = escapeHtml(surface);
    kwDict.set(key, { key, surface, lc: esc.toLowerCase(), len: esc.length, latinEnd: /[a-z0-9]$/i.test(surface), target, pri });
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
      if (target) addKw(m[1], target, 2);
    }
  }
}
for (const f of registry.values()) for (const h of f.headings) addKw(h.raw, { kind: 'sec', f: f.id, name: f.name, dom: h.domId }, 1);

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

function isSelfTarget(t, ctx) {
  const curFile = ctx.topic ? ctx.topic.file : ctx.file ? ctx.file.name : '';
  if (t.kind === 'card') return (ctx.topic && t.c === `t${ctx.topic.num}`) || t.file === curFile;
  return t.name === curFile;
}
const KW_WORD = /[\p{L}\p{N}]/u;
// 이스케이프된 인라인 HTML에서 키워드를 찾아 <a class="k">로 감싼다.
// <a> 내부·태그·코드 플레이스홀더()는 건너뛰고, 경계(앞: 비문자, 라틴 끝: 뒤 비라틴) 검사.
function autoLink(s, ctx) {
  const used = ctx.sharedUsed || new Set();
  let out = '';
  let i = 0;
  let inA = 0;
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
    const prev = i > 0 ? s[i - 1] : '';
    const bucket = (!prev || !KW_WORD.test(prev)) && kwBuckets.get(ch.toLowerCase());
    let advanced = false;
    if (bucket) {
      for (const e of bucket) {
        if (i + e.len > s.length) continue;
        const seg = s.slice(i, i + e.len);
        if (seg.toLowerCase() !== e.lc) continue;
        if (e.latinEnd && /[A-Za-z0-9]/.test(s[i + e.len] || '')) continue;
        // 매칭 확정 — 자기 문서·문단 내 재등장(표면형·타깃 모두)이면 링크 없이 소비(부분 키워드 재매칭 방지)
        if (isSelfTarget(e.target, ctx) || used.has(e.key) || used.has(e.target)) out += seg;
        else {
          used.add(e.key);
          used.add(e.target);
          let idx = kwIdx.get(e.target);
          if (idx === undefined) {
            idx = kwOut.length;
            kwOut.push(e.target.kind === 'card' ? { c: e.target.c } : { f: e.target.f, t: e.target.dom });
            kwIdx.set(e.target, idx);
          }
          out += `<a class="k" data-k="${idx}">${seg}</a>`;
          kwStats.links++;
          kwStats.perKw.set(e.surface, (kwStats.perKw.get(e.surface) || 0) + 1);
        }
        i += e.len; advanced = true; break;
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
// 8) 메인 카드 HTML
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
  const cardCtx = { file: null, topic: t, autoLink: true }; // 정의·해결 텍스트 자동 링크化 (자기 카드·자기 원본 제외)
  return `<article class="card topic" id="t${t.num}">
<header class="card-head"><span class="num">${t.num}</span><h3>${renderInline(t.title, sumCtx)}</h3>${srcBtn}</header>
<div class="card-body">
<ul class="facts">${facts.map((b) => `<li>${renderInline(b, cardCtx)}</li>`).join('\n')}</ul>
${rels.map((b) => `<div class="rel">${renderInline(b, cardCtx)}</div>`).join('\n')}
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
// 9) 사이드바 + 오버레이(임베드 원본)
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
// 9.5) 검색 인덱스 + 랭킹 코어
//    코어는 순수 함수로 작성해 toString()으로 클라이언트에 직렬화한다.
//    검증 스크립트는 생성된 HTML에서 /*__CORE_START__*/…/*__CORE_END__*/ 블록과
//    "var SIDX=…" 라인을 추출하면 뷰어와 동일한 로직으로 랭킹을 재현할 수 있다.
// ---------------------------------------------------------------------------
function SEARCH_CORE() {
  // 질의 토큰화: 공백 분리 + 꼬리 조사 제거(어간 2자 이상 보존)
  var PARTICLES = ['이란', '에서', '에게', '으로', '부터', '까지', '와', '과', '은', '는', '이', '가', '을', '를', '의', '로', '에', '도', '만', '란'];
  function tokenize(qs) {
    var out = [];
    qs.toLowerCase().trim().split(/\s+/).forEach(function (w) {
      if (!w) return;
      for (var i = 0; i < PARTICLES.length; i++) {
        var p = PARTICLES[i];
        if (w.length - p.length >= 2 && w.slice(-p.length) === p) { w = w.slice(0, w.length - p.length); break; }
      }
      out.push(w);
    });
    return out;
  }
  function countOcc(t, s) { var n = 0, i = t.indexOf(s); while (i >= 0) { n++; i = t.indexOf(s, i + s.length); } return n; }
  // 토큰 1개의 점수: 완전일치 2점/회, 어간(끝 1~2자 완화, "페이징"→"페이"≈"페이지") 1점/회
  // 어간 완화는 한글 꼬리 토큰에만 적용 — "tlb"→"tl"이 "stl"에 걸리는 오탐 방지
  function hitScore(t, tok) {
    var c = countOcc(t, tok);
    if (c) return c * 2;
    if (!/[가-힣]$/.test(tok)) return 0;
    if (tok.length >= 3 && (c = countOcc(t, tok.slice(0, -1)))) return c;
    if (tok.length >= 4 && (c = countOcc(t, tok.slice(0, -2)))) return c;
    return 0;
  }
  // AND 매칭: 모든 토큰 히트 시 합산 점수, 아니면 0 (토큰이 인접할 필요 없음)
  function matchAll(t, toks) { var s = 0; for (var i = 0; i < toks.length; i++) { var c = hitScore(t, toks[i]); if (!c) return 0; s += c; } return s; }
  // 부분 매칭: 히트한 토큰 수 n + 합산 점수 s
  function partialHits(t, toks) { var n = 0, s = 0; toks.forEach(function (tk) { var c = hitScore(t, tk); if (c) { n++; s += c; } }); return { n: n, s: s }; }
  // 하이라이트용: 각 토큰이 실제 매칭된 형태(원형 우선, 없으면 어간), 긴 것부터
  function matchForms(t, toks) {
    var out = [];
    toks.forEach(function (tok) {
      if (t.indexOf(tok) >= 0) out.push(tok);
      else if (!/[가-힣]$/.test(tok)) return;
      else if (tok.length >= 3 && t.indexOf(tok.slice(0, -1)) >= 0) out.push(tok.slice(0, -1));
      else if (tok.length >= 4 && t.indexOf(tok.slice(0, -2)) >= 0) out.push(tok.slice(0, -2));
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
  // 인덱스 전처리: 소문자 캐시
  function prepIndex(idx) {
    idx.topics.forEach(function (t) {
      t._ti = t.ti.toLowerCase();
      t._rel = t.rel.toLowerCase();
      t._all = (t.ti + ' ' + t.rel + ' ' + t.lines.join(' ')).toLowerCase();
    });
    idx.files.forEach(function (f) { f.hs.forEach(function (h) { h[2] = h[0].toLowerCase(); }); });
    return idx;
  }
  // 랭킹 검색.
  //   주제 밴드: 1 제목(전체) → 2 연관(전체) → 3 제목(부분) → 4 본문통합(전체) → 5 연관(부분)
  //   원본 섹션: 헤딩 전체 매칭 → 헤딩 부분 매칭
  //   정렬: 밴드 → 히트 토큰 수 → 점수 → (섹션은 짧은 헤딩 우선) → 문서 순서
  function search(idx, query) {
    var toks = tokenize(query);
    var res = { toks: toks, topics: [], sections: [] };
    if (!toks.length) return res;
    var multi = toks.length > 1;
    idx.topics.forEach(function (t, i) {
      var band = 0, n = toks.length, s;
      if ((s = matchAll(t._ti, toks))) band = 1;
      else if ((s = matchAll(t._rel, toks))) band = 2;
      else {
        var pT = multi ? partialHits(t._ti, toks) : { n: 0 };
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
        var s = matchAll(h[2], toks), band = 1, n = toks.length;
        if (!s && multi) { var p = partialHits(h[2], toks); if (p.n) { band = 2; n = p.n; s = p.s; } }
        if (s) res.sections.push({ band: band, n: n, score: s, len: h[0].length, ord: ord, h: h[0], slug: h[1], f: f.f, fn: f.n });
        ord++;
      });
    });
    res.sections.sort(function (a, b) { return a.band - b.band || b.n - a.n || b.score - a.score || a.len - b.len || a.ord - b.ord; });
    return res;
  }
  return { tokenize: tokenize, hitScore: hitScore, matchAll: matchAll, partialHits: partialHits, matchForms: matchForms, bestLine: bestLine, clip: clip, esc: esc, hilite: hilite, prepIndex: prepIndex, search: search };
}

// 검색 인덱스 데이터: 주제(제목·연관·본문 줄) + 원본 섹션 헤딩
const plainMd = (s) => stripInlineMd(s).trim();
const searchIdx = {
  topics: domains.flatMap((d) => d.topics.map((t) => {
    const facts = [];
    const rels = [];
    for (const b of t.bullets) (b.startsWith('🔗') ? rels : facts).push(plainMd(b));
    return { c: `t${t.num}`, num: t.num, ti: plainMd(t.title), rel: rels.join(' '), lines: [...facts, ...rels] };
  })),
  files: [...registry.values()].map((f) => ({ f: f.id, n: f.name, hs: f.headings.map((h) => [plainMd(h.raw), h.slug]) })),
};
const searchIdxJson = JSON.stringify(searchIdx).replace(/</g, '\\u003c');

// ---------------------------------------------------------------------------
// 10) CSS (다크+골드 디자인 토큰)
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
// 11) 클라이언트 JS
// ---------------------------------------------------------------------------
const clientJs = `
(function(){
var q=document.getElementById('q'),qc=document.getElementById('qcount'),qp=document.getElementById('qpanel');
var quizBtn=document.getElementById('quiz'),randBtn=document.getElementById('rand');
var ov=document.getElementById('ov'),ovBody=document.getElementById('ovbody'),ovTitle=document.getElementById('ovtitle');
var FILE_NAMES=__FILE_NAMES__;
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
function renderPanel(res){
  var h=[];
  var bt=res.topics[0],bs=res.sections[0]; /* 즉답: 제목·연관 직격이면 주제, 아니면 헤딩 직격 섹션 */
  if(bt&&(bt.band<=2||!bs))h.push(ansTopic(bt,res));
  else if(bs&&bs.band===1)h.push(ansSec(bs,res));
  else if(bt)h.push(ansTopic(bt,res));
  else if(bs)h.push(ansSec(bs,res));
  if(res.topics.length){
    h.push('<div class="qgh">주제 <b>'+res.topics.length+'</b>건</div>');
    res.topics.forEach(function(r){
      var t=r.t,forms=CORE.matchForms(t._all,res.toks);
      var line=CORE.bestLine(t.lines,res.toks);
      var sn=line?'<span class="qsn">'+CORE.hilite(CORE.clip(line,forms),forms)+'</span>':'';
      h.push('<a class="qres" href="#" data-card="'+t.c+'" data-lbl="'+CORE.esc(lbl16(t.ti))+'"><span class="qtt"><b>'+t.num+'</b> '+CORE.hilite(t.ti,forms)+'<i class="qtag">'+BAND_TAG[r.band]+'</i></span>'+sn+'</a>');
    });
  }
  if(res.sections.length){
    h.push('<div class="qgh">원본 섹션 <b>'+res.sections.length+'</b>건</div>');
    res.sections.slice(0,50).forEach(function(r){
      var forms=CORE.matchForms(r.h.toLowerCase(),res.toks);
      h.push('<a class="qres" href="#" data-file="'+r.f+'" data-target="f-'+r.f+'--'+r.slug+'" data-lbl="'+CORE.esc(lbl16(r.h))+'"><span class="qtt">'+CORE.hilite(r.h,forms)+'<span class="qfn">'+CORE.esc(r.fn)+'</span></span></a>');
    });
    if(res.sections.length>50)h.push('<div class="qmore">… 외 '+(res.sections.length-50)+'건</div>');
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
    qc.textContent='';hidePanel();return;
  }
  var res=CORE.search(SIDX,s);
  lastRes=res;
  var hit={};
  res.topics.forEach(function(r){hit[r.t.c]=1;});
  cards.forEach(function(c){
    c.hidden=!hit[c.id];
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
}
var deb;
q.addEventListener('input',function(){clearTimeout(deb);deb=setTimeout(applyFilter,80);});
q.addEventListener('focus',function(){if(q.value.trim()&&qp.hidden)applyFilter();});
q.addEventListener('keydown',function(e){
  if(e.key!=='Enter')return;
  e.preventDefault();clearTimeout(deb);
  if(q.value.trim())applyFilter();
  if(!lastRes)return;
  var t=lastRes.topics[0],sc=lastRes.sections[0];
  hidePanel();
  if(t){trailReset({label:lbl16(t.t.ti),tgt:{c:t.t.c}});goCard(t.t.c);}
  else if(sc){var et={f:sc.f,t:'f-'+sc.f+'--'+sc.slug};trailReset({label:lbl16(sc.h),tgt:et});openSrc(et.f,et.t);}
});

/* ---- 모의면접 모드 + 랜덤 ---- */
function setQuiz(on){
  document.body.classList.toggle('quiz',on);
  quizBtn.classList.toggle('on',on);
  topics.forEach(function(t){t.classList.remove('revealed');});
}
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
<button id="quiz" title="답을 가리고 카드 클릭으로 공개">🎤 모의면접</button>
<button id="rand" title="랜덤 주제로 점프 (답 가린 채)">🎲 랜덤</button>
</header>
<div id="trail" hidden></div>
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
<div id="ovtrail" hidden></div>
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
// 13) 빌드 리포트
// ---------------------------------------------------------------------------
const kb = (n) => (n / 1024 >= 1024 ? (n / 1048576).toFixed(2) + ' MB' : Math.round(n / 1024) + ' KB');
const size = fs.statSync(OUT_PATH).size;
console.log(`✔ 주제 카드: ${topicCount}개 (도메인 ${domains.length}개${domains.map((d) => ` · ${d.num}=${d.topics.length}`).join('')})`);
console.log(`✔ 색인 섹션: ${extras.length}개`);
console.log(`✔ 원본 임베드: ${registry.size}파일 / ${totalSections}섹션(헤딩)`);
console.log(`✔ 검색 인덱스: 주제 ${searchIdx.topics.length} · 원본 섹션 헤딩 ${searchIdx.files.reduce((n, f) => n + f.hs.length, 0)}`);
console.log(`✔ 링크: 해석 ${stats.resolved} · 파일상단 폴백 ${stats.fileTop} · 원본없음 ${stats.deadFile.length} · 외부 ${stats.external}`);
{
  const byPri = [0, 0, 0, 0];
  for (const e of kwDict.values()) byPri[e.pri]++;
  console.log(`✔ 키워드 사전: ${kwDict.size}표면형 (주제제목 ${byPri[3]} · 연관 ${byPri[2]} · 헤딩 ${byPri[1]}) → 자동 링크 ${kwStats.links}개 / 타깃 ${kwOut.length}종`);
  const top = [...kwStats.perKw.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`  자동 링크 상위: ${top.map(([k, n]) => `${k}(${n})`).join(' · ')}`);
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
// 구조 검증: 주제 번호 중복 / 원본 파일 누락
{
  const nums = domains.flatMap((d) => d.topics.map((t) => t.num));
  const dupNums = nums.filter((n, i) => nums.indexOf(n) !== i);
  if (dupNums.length) console.log(`⚠ 주제 번호 중복: ${[...new Set(dupNums)].join(', ')}`);
  const noSrc = domains.flatMap((d) => d.topics).filter((t) => !registry.has(t.file));
  if (noSrc.length) console.log(`⚠ 원본 파일 없는 주제: ${noSrc.map((t) => `${t.num}(${t.file})`).join(', ')}`);
}
