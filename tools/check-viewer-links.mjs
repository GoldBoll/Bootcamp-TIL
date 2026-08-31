#!/usr/bin/env node
// ============================================================================
// check-viewer-links.mjs — CS 뷰어(interview-viewer.html) 링크 무결성 검사기
//
// 사용법:
//   node tools/check-viewer-links.mjs [뷰어.html] [--max-unlinked=N]
//   (기본 대상: raw/cs-notion/interview-viewer.html)
//
// 검사 항목
//   1) 깨진 점프   KW/data-target/SIDX 가 가리키는 앵커 id 가 문서에 없음        → ERROR
//   2) 미링크 키워드 원본 md가 링크로 지정한 표면형이 본문 산문에 있는데 자동 링크 0 → ERROR
//      제외(결함 아님): 내비게이션 라벨 / 코드스팬 전용 식별자 / 자기문서·문단중복 억제
//      — 분류 근거는 생성기가 내보낸 interview-viewer.kwmap.json (표면형·링크수·억제수)
//   3) 중복 앵커 id 같은 id 2회 이상 정의(점프가 첫 번째로만 감)                 → ERROR
//   4) 고아 앵커   정의됐지만 아무도 가리키지 않는 헤딩·카드 앵커                → WARN
//
// exit 1 = ERROR 있음 / exit 0 = 통과. 외부 의존성 0 (node 표준 모듈만).
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'raw', 'cs-notion');
const args = process.argv.slice(2);
// --max-unlinked=N: 미링크 키워드는 콘텐츠 품질 지표라 래칫 허용 (기본 0 = 하나라도 있으면 실패)
const MAX_UNLINKED = +(args.find((a) => a.startsWith('--max-unlinked='))?.split('=')[1] ?? 0);
const argPath = args.find((a) => !a.startsWith('--'));
const HTML_PATH = argPath ? path.resolve(argPath) : path.join(SRC_DIR, 'interview-viewer.html');
const SUMMARY_PATH = path.join(SRC_DIR, 'CS_면접_요약본.md');
const MAX_LIST = 20;

const html = fs.readFileSync(HTML_PATH, 'utf8');
// 뷰어 JS 안에도 `data-card="'+t.c+'"` 같은 템플릿 문자열이 있어 마크업 스캔 시 오탐이 된다.
// KW/SIDX 는 var 이름으로 따로 뽑으므로, 마크업 검사는 <script> 제거본으로 한다.
const markup = html.replace(/<script[\s\S]*?<\/script>/gi, '');

// 생성기(build-interview-viewer.mjs)의 canonKey 와 동일 — 표기 편차 흡수
const canonKey = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// ---------------------------------------------------------------------------
// 정의된 앵커 id 수집 (+ 중복 검출)
// ---------------------------------------------------------------------------
const idCount = new Map();
for (const m of markup.matchAll(/\sid="([^"]+)"/g)) idCount.set(m[1], (idCount.get(m[1]) || 0) + 1);
const defined = new Set(idCount.keys());
const dupIds = [...idCount].filter(([, n]) => n > 1);

// ---------------------------------------------------------------------------
// 참조 수집: KW 배열 / 정적 data-file·data-target / data-card / 검색 인덱스(SIDX)
// ---------------------------------------------------------------------------
// 뷰어는 `var KW=[…];` / `var SIDX=CORE.prepIndex({…});` 를 각각 한 줄로 심는다
const grabData = (varName) => {
  const i = html.indexOf(`var ${varName}=`);
  if (i < 0) return null;
  const eol = html.indexOf('\n', i);
  let s = html.slice(html.indexOf('=', i) + 1, eol < 0 ? undefined : eol).trim();
  s = s.replace(/;$/, '').replace(/^CORE\.prepIndex\(([\s\S]*)\)$/, '$1');
  try { return JSON.parse(s); } catch { return null; }
};

const KW = grabData('KW');
const SIDX = grabData('SIDX');
if (!KW) fail(`var KW=[…] 를 파싱할 수 없습니다: ${HTML_PATH}`);
if (!SIDX) fail(`var SIDX={…} 를 파싱할 수 없습니다: ${HTML_PATH}`);

const referenced = new Set(); // 누군가 가리키는 id (검색 포함)
const linkedTo = new Set();   // 링크(자동·명시·사이드바)로 도달 가능한 id — 검색 제외
const broken = [];            // {kind, ref, via}
const need = (id, kind, via) => {
  if (!id) return;
  referenced.add(id);
  if (kind !== 'search') linkedTo.add(id);
  if (!defined.has(id)) broken.push({ kind, ref: id, via });
};

// 1-a) 키워드 자동 링크 — 실제 본문에서 쓰인 data-k 만 검사 대상
const usedK = new Map(); // idx → 사용 횟수
const kwLinkTexts = [];  // <a class="k">표면형</a>
for (const m of markup.matchAll(/<a class="k" data-k="(\d+)">([\s\S]*?)<\/a>/g)) {
  usedK.set(+m[1], (usedK.get(+m[1]) || 0) + 1);
  kwLinkTexts.push(m[2]);
}
for (const [idx, n] of usedK) {
  const e = KW[idx];
  if (!e) { broken.push({ kind: 'KW', ref: `KW[${idx}]`, via: `data-k=${idx} (${n}건) — KW 배열 범위 밖` }); continue; }
  if (e.c) need(e.c, 'KW', `data-k=${idx} (${n}건) → 카드 #${e.c}`);
  else {
    need(`f-${e.f}`, 'KW', `data-k=${idx} (${n}건) → 원본 ${e.f}`);
    if (e.t) need(e.t, 'KW', `data-k=${idx} (${n}건) → 섹션`);
  }
}
// 아무도 안 쓰는 KW 엔트리는 앵커 유효성과 무관하지만 사전 낭비 신호 → 경고 집계
const unusedKw = KW.map((_, i) => i).filter((i) => !usedK.has(i));

// 1-b) 정적 명시 링크(a.jump / 사이드바)
for (const m of markup.matchAll(/data-file="([^"]*)"\s+data-target="([^"]*)"/g)) {
  need(`f-${m[1]}`, 'jump', `data-file=${m[1]}`);
  need(m[2], 'jump', `data-file=${m[1]} data-target`);
}
for (const m of markup.matchAll(/data-card="([^"]*)"/g)) need(m[1], 'card', 'data-card');

// 1-c) 검색 인덱스 — 결과 클릭 시 'f-'+f+'--'+slug 로 점프
for (const t of SIDX.topics || []) need(t.c, 'search', `SIDX.topics ${t.num}`);
for (const f of SIDX.files || []) {
  need(`f-${f.f}`, 'search', `SIDX.files ${f.n}`);
  for (const h of f.hs) need(`f-${f.f}--${h[1]}`, 'search', `SIDX ${f.n} → ${h[0]}`);
}

// ---------------------------------------------------------------------------
// 2) 미링크 키워드 — 요약본 색인 섹션의 키워드가 본문에서 자동 링크된 적 있는가
// ---------------------------------------------------------------------------
const linkedSurfaces = new Set(kwLinkTexts.map((t) => canonKey(t)));
// 최장 일치 규칙 때문에 "Mass Entity"가 더 긴 키워드에 삼켜져 링크될 수 있다 —
// 그 구간은 이미 클릭 가능하므로 '자기 표면형을 포함하는 링크'도 링크된 것으로 본다.
const linkedCanons = [...linkedSurfaces];
const isLinked = (ck) => linkedSurfaces.has(ck) || linkedCanons.some((t) => t.includes(ck));
const KW_SKIP = new Set(['복습', '전문', '심화', '연관', '보강', '신규', '기타', '참고', '원본', '요약', '정리'].map(canonKey));
// 생성기가 의도적으로 사전에서 뺀 일반어(KW_STOP)는 검사 대상이 아니다.
// 목록을 복제하면 드리프트가 생기므로 생성기 소스에서 그대로 읽어 온다.
const GEN_PATH = path.join(ROOT, 'tools', 'build-interview-viewer.mjs');
const KW_STOP = new Set(
  (fs.readFileSync(GEN_PATH, 'utf8').match(/const KW_STOP = new Set\(\[([\s\S]*?)\]\.map\(canonKey\)\)/)?.[1] ?? '')
    .split(',').map((s) => s.trim().replace(/^\/\/.*$/m, '').replace(/^'|'$/g, ''))
    .filter((s) => s && !s.startsWith('//')).map(canonKey),
);
if (!KW_STOP.size) console.log('  ⚠ 생성기 KW_STOP 을 읽지 못했습니다 — 일반어가 미링크로 잡힐 수 있습니다');

// 색인 항목이 가리키는 원본 섹션 id (생성기의 domId 규칙 + canon 폴백)
const canonToId = new Map();
for (const id of defined) if (!canonToId.has(canonKey(id))) canonToId.set(canonKey(id), id);
const indexTargetId = (url) => {
  if (/^https?:\/\//i.test(url)) return '';
  const hash = url.indexOf('#');
  let file = hash < 0 ? url : url.slice(0, hash);
  let anchor = hash < 0 ? '' : url.slice(hash + 1);
  try { file = decodeURIComponent(file); anchor = decodeURIComponent(anchor); } catch { /* 그대로 */ }
  const fid = `f-${file.replace(/^\.\//, '').replace(/\.md$/, '').replace(/[^\w가-힣]/gu, '_')}`;
  if (!anchor) return defined.has(fid) ? fid : '';
  const exact = `${fid}--${anchor}`;
  return defined.has(exact) ? exact : (canonToId.get(canonKey(exact)) || '');
};

// 검사 대상 표면형 = 원본 md의 **명시 링크 텍스트 전부**(요약본 색인 포함).
// 색인만 보면 "오픈 어드레싱"처럼 색인 라벨이 아닌 개념어가 사전에서 빠져도 통과해버린다
// (실제로 그 상태로 미링크 0이 나왔다) → 사람이 링크로 지정한 모든 표면형을 대상으로 본다.
const indexKw = new Map(); // canon → {surface, section, url, target}
for (const name of fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.md'))) {
  const lines = fs.readFileSync(path.join(SRC_DIR, name), 'utf8').split(/\r?\n/);
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    for (const m of line.matchAll(/\[([^\]\n]+)\]\(([^)\s]+)\)/g)) {
      const surface = m[1]
        .replace(/`([^`]*)`/g, '$1')
        .replace(/\*\*/g, '')
        .replace(/[\p{Extended_Pictographic}\u{FE0F}①-⑳⭐]/gu, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[\s·—–-]+|[\s·—–-]+$/g, '')
        .trim();
      const bare = surface.replace(/\s*\[?(신규|보강|복습|심화|전문)\]?$/, '').trim(); // 라벨 꼬리 태그는 키워드가 아님
      const ck = canonKey(bare);
      // 생성기 kwValid 와 같은 하한: 2자 미만·숫자만("0.0")은 사전에 넣지 않는다
      if (!ck || ck.length < 2 || /^\d+$/.test(ck) || KW_SKIP.has(ck) || KW_STOP.has(ck)) continue;
      if (/\.md$/i.test(bare) || /^\d+번$/.test(bare)) continue; // 파일명·"23번" 상호참조
      const url = m[2].startsWith('#') ? name + m[2] : m[2];
      if (!indexKw.has(ck)) indexKw.set(ck, { surface: bare, section: name, url, target: indexTargetId(url) });
    }
  }
}
// 판정: 그 표면형이 본문에서 자동 링크된 적이 있는가. (섹션 도달 가능성으로 대체하지 않는다 —
// 다른 키워드가 같은 섹션을 가리킨다는 사실은 이 키워드가 링크됐다는 증거가 아니다.)
const notLinked = [...indexKw.values()].filter((v) => !isLinked(canonKey(v.surface)));
// 색인 링크가 뷰어 앵커로 해석 안 되는 것. 다만 애초에 뷰어 앵커일 수 없는 두 부류가 섞여 있어
// 그대로 세면 결함처럼 보인다. 실측으로 갈린 부류:
//   ① 외부 URL(learn.microsoft.com 등) — 뷰어 앵커가 아니라 바깥 문서다
//   ② 요약본의 도메인 지도 자기 앵커(#1-c-언어--객체지향 등) — 요약본은 원본 섹션이 아니라
//      카드로 렌더되고, 도메인은 #d<번호> 블록으로 이미 화면에 있다. 그 지도 줄 자체는
//      뷰어에서 렌더되지 않으므로(발행본 class="dead" 0개) 죽은 링크가 아니라 미사용 표기다.
// 진짜 결함은 "원본 섹션을 가리키는데 그 앵커가 없는" 경우뿐이다.
const IDX_EXTERNAL = (v) => /^https?:\/\//i.test(v.url || '');
const IDX_SUMMAP = (v) => /^CS_면접_요약본\.md#/.test(v.url || '');
const deadIndexAll = [...indexKw.values()].filter((v) => !v.target);
const deadIndex = deadIndexAll.filter((v) => !IDX_EXTERNAL(v) && !IDX_SUMMAP(v));
const deadIndexSkip = deadIndexAll.length - deadIndex.length;

// 미링크를 '진짜 결함'과 '구조상 링크 불가'로 분류한다.
// 자동 링크(생성기 autoLink)가 손댈 수 있는 곳은 코드·기존 링크 밖의 산문뿐이므로,
// 그 산문에 표면형이 아예 없으면 사전에 넣어도 링크가 생길 수 없다 = 결함이 아니다.
// 반대로 산문에 있는데 링크가 0이면 사전 등록 누락 = ERROR (이게 이 지표의 존재 이유).
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
// 태그 자리는 센티넬( )로 남긴다 — autoLink 는 태그를 넘어 매칭하지 못하므로
// "O(1)</strong> 평균" 처럼 마크업으로 쪼개진 문구는 애초에 링크될 수 없는 자리다.
const proseOf = (s) => unescape(
  s.replace(/<style[\s\S]*?<\/style>/gi, '\u0000') // CSS(user-select 등)가 키워드로 오탐되지 않게
    .replace(/<pre[\s\S]*?<\/pre>/gi, '\u0000')
    .replace(/<code[\s\S]*?<\/code>/gi, '\u0000')
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '\u0000') // 헤딩·<summary>는 생성기가 noAuto로 렌더
    .replace(/<summary[^>]*>[\s\S]*?<\/summary>/gi, '\u0000')
    .replace(/<a\b[\s\S]*?<\/a>/gi, '\u0000') // 기존 링크 안쪽은 autoLink가 건너뛴다
    .replace(/<[^>]+>/g, '\u0000'),
).replace(/[ \t\r\n]+/g, ' ').toLowerCase(); // 공백은 공백 그대로 — 표면형에도 공백이 있다
// 라틴 표면형은 단어 경계까지 봐야 한다 — 생성기도 "select"가 "Selective"에 걸리지 않게 막는다
const occursIn = (text, s) => {
  let i = text.indexOf(s);
  while (i >= 0) {
    if (!/[a-z0-9]$/.test(s) || !/[a-z0-9]/.test(text[i + s.length] || '')) return true;
    i = text.indexOf(s, i + 1);
  }
  return false;
};
// 원본 파일 구획별로 나눠 둔다 — 같은 파일 안에서는 자기 문서 링크가 의도적으로 억제되므로
// "타깃 파일 밖 산문에 등장하는가"로 판정해야 한다.
const proseSegs = [];
{
  let last = 0;
  for (const m of markup.matchAll(/<section class="srcfile" id="(f-[^"]+)"[^>]*>([\s\S]*?)<\/section>/g)) {
    proseSegs.push([null, proseOf(markup.slice(last, m.index))]);
    proseSegs.push([m[1], proseOf(m[2])]);
    last = m.index + m[0].length;
  }
  proseSegs.push([null, proseOf(markup.slice(last))]);
}
const codeText = [...markup.matchAll(/<(code|pre)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => unescape(m[2])).join(' ').toLowerCase();
// 최장 일치에 삼켜진 자리는 '걸릴 자리'가 아니다 — 예: 표 셀 "C++ 표준 RTTI — vtable 옆 type_info"
// 전체가 (자기 문서라서 억제된) 더 긴 표면형으로 먼저 매칭되면, 안쪽 "vtable 옆 type_info"는
// 애초에 후보로 검사되지도 않는다. 생성기에서 실제로 매칭된(links+skips>0) 더 긴 표면형만 본다.
const consumedAt = (text, i, s) => kwSurfaces.some(([surf, links, skips]) => {
  if (links + skips === 0 || surf.length <= s.length) return false;
  const l = surf.toLowerCase();
  const off = l.indexOf(s);
  return off >= 0 && i - off >= 0 && text.startsWith(l, i - off);
});
const inProse = (v) => {
  const s = v.surface.toLowerCase();
  const own = v.target ? v.target.replace(/--.*$/, '') : ''; // f-<파일>--<슬러그> → f-<파일>
  return proseSegs.some(([fid, text]) => {
    if (fid === own) return false;
    let i = text.indexOf(s);
    while (i >= 0) {
      const boundaryOk = !/[a-z0-9]$/.test(s) || !/[a-z0-9]/.test(text[i + s.length] || '');
      if (boundaryOk && !consumedAt(text, i, s)) return true;
      i = text.indexOf(s, i + 1);
    }
    return false;
  });
};
// 생성기가 내보낸 사전 사이드카: canon → {links, skips}
// skips>0 = 매칭은 됐지만 자기 문서·문단당 1회 규칙으로 정상 억제된 것(결함 아님).
const KWMAP_PATH = HTML_PATH.replace(/\.html$/, '.kwmap.json');
const kwmap = new Map();
const kwSurfaces = fs.existsSync(KWMAP_PATH) ? JSON.parse(fs.readFileSync(KWMAP_PATH, 'utf8')) : [];
if (kwSurfaces.length) {
  for (const [surface, links, skips] of kwSurfaces) {
    const ck = canonKey(surface);
    const old = kwmap.get(ck);
    kwmap.set(ck, { links: (old?.links || 0) + links, skips: (old?.skips || 0) + skips });
  }
} else {
  console.log(`  ⚠ ${path.basename(KWMAP_PATH)} 없음 — 생성기를 다시 돌리면 미링크 분류가 정확해집니다`);
}

const unlinked = [];
const excluded = { nav: [], code: [], sup: [] };
for (const v of notLinked) {
  const e = kwmap.get(canonKey(v.surface));
  if (e && e.skips > 0) excluded.sup.push(v);       // 사전에 있고 매칭도 됐으나 자기 문서·중복으로 억제
  else if (!inProse(v)) {                            // 자동 링크가 손댈 수 있는 산문에 아예 없음
    if (codeText.includes(v.surface.toLowerCase())) excluded.code.push(v); // 코드스팬 전용(void·friend·TSubclassOf)
    else excluded.nav.push(v);                                            // 내비게이션 라벨("30초 복잡도 표")
  } else unlinked.push(v);                           // 산문에 있고 억제도 아닌데 링크 0 = 사전 등록 누락
}

// ---------------------------------------------------------------------------
// 4) 고아 앵커 — 헤딩(f-*--*)·카드(t숫자/extra-N) 중 아무도 안 가리키는 것
// ---------------------------------------------------------------------------
const orphans = [...defined].filter(
  (id) => (/^f-.+--.+/.test(id) || /^t\d+$/.test(id) || /^extra-\d+$/.test(id)) && !referenced.has(id),
);

// ---------------------------------------------------------------------------
// 리포트
// ---------------------------------------------------------------------------
function fail(msg) { console.error(`✖ ${msg}`); process.exit(1); }
const show = (arr, fmt) => {
  arr.slice(0, MAX_LIST).forEach((x) => console.log(`    ${fmt(x)}`));
  if (arr.length > MAX_LIST) console.log(`    … 외 ${arr.length - MAX_LIST}건`);
};

console.log(`뷰어: ${HTML_PATH}`);
console.log(`앵커 정의 ${defined.size}개 / 참조 ${referenced.size}개 / KW 사전 ${KW.length}항목 (본문 자동 링크 ${kwLinkTexts.length}건)`);
console.log('');
console.log(`[1] 깨진 점프        ${broken.length}건${broken.length ? '' : '  ✓'}`);
show(broken, (b) => `${b.ref}  ← ${b.via}`);
console.log(`[2] 미링크 키워드    ${unlinked.length}건 / 색인 ${indexKw.size}개${unlinked.length ? '' : '  ✓'}`);
show(unlinked, (u) => `${u.surface}  →  ${u.url}${u.target ? '' : '  [앵커 해석 실패]'}`);
// 제외 항목은 숨기지 않고 항상 개수를 보여준다 — 제외 규칙이 실제 결함을 가리는지 눈으로 확인 가능
console.log(`    (제외) 내비게이션 라벨 ${excluded.nav.length} · 코드스팬 전용 ${excluded.code.length} · 자기문서·중복 억제 ${excluded.sup.length}`
  + `${process.env.SHOW_EXCLUDED ? '' : ' — 목록은 SHOW_EXCLUDED=1'}`);
if (process.env.SHOW_EXCLUDED) {
  show(excluded.nav, (u) => `    nav  ${u.surface}  →  ${u.url}`);
  show(excluded.code, (u) => `    code ${u.surface}  →  ${u.url}`);
  show(excluded.sup, (u) => `    sup  ${u.surface}  →  ${u.url}`);
}
if (deadIndexSkip) console.log(`    (제외) 뷰어 앵커 대상이 아닌 색인 링크 ${deadIndexSkip}건 — 외부 URL·요약본 도메인 지도`);
if (deadIndex.length) {
  console.log(`    (참고) 색인 링크가 뷰어 앵커로 해석되지 않는 항목 ${deadIndex.length}건`
    + `${process.env.SHOW_EXCLUDED ? '' : ' — 목록은 SHOW_EXCLUDED=1'}`);
  // 개수만 보여 주면 원인을 못 찾는다. 어떤 색인 링크가 어디를 못 찾는지 찍는다.
  if (process.env.SHOW_EXCLUDED) show(deadIndex, (v) => `    dead ${v.surface}  →  ${v.url}`);
}
console.log(`[3] 중복 앵커 id     ${dupIds.length}건${dupIds.length ? '' : '  ✓'}`);
show(dupIds, ([id, n]) => `${id}  ×${n}`);
console.log(`[4] 고아 앵커 (경고) ${orphans.length}건`);
show(orphans, (o) => o);
const searchOnly = [...defined].filter((id) => /^f-.+--.+/.test(id) && referenced.has(id) && !linkedTo.has(id));
console.log(`    (참고) 링크 없이 검색으로만 도달하는 섹션 ${searchOnly.length}건 / 본문에서 한 번도 안 쓰인 KW 엔트리 ${unusedKw.length}/${KW.length}`);

// [5] 링크의 '의미' 검증 — 앵커가 있는지가 아니라, 그 절이 그 용어를 다루는 절인지 본다.
// 판정: 링크 텍스트가 목적지 헤딩 또는 그 문서 제목 안에 있는가.
//   있음 = 그 용어를 제목으로 내건 절. 없음 = 언급만 하는 자리일 수 있어 검토 대상.
// h1(문서 최상단)·주제 카드 착지는 통과 — 리드와 `모의면접 답변`이 첫 화면이다.
// 경고만 한다(실패로 세지 않는다). 한글 용어 ↔ 영문 제목(스택↔Stack)처럼 정상인데
// 문자열이 안 맞는 경우가 섞이므로, 사람이 목록을 보고 판단할 지표다.
{
  const canonT = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const headText = new Map(), fileTitle = new Map();
  for (const m of html.matchAll(/<h([1-6]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)) {
    const txt = m[3].replace(/<[^>]*>/g, '').trim();
    headText.set(m[2], { txt, lv: +m[1] });
    if (+m[1] === 1) {
      const f = m[2].replace(/^f-/, '').split('--')[0];
      if (!fileTitle.has(f)) fileTitle.set(f, txt);
    }
  }
  const off = new Map();
  let semOk = 0, semTot = 0;
  for (const m of html.matchAll(/<a class="k" data-k="(\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    semTot++;
    const t = KW[+m[1]], surf = m[2].replace(/<[^>]*>/g, '').trim();
    if (!t || t.c || !t.t) { semOk++; continue; }
    const h = headText.get(t.t);
    if (!h || h.lv === 1) { semOk++; continue; }
    if (canonT(h.txt).includes(canonT(surf)) || canonT(fileTitle.get(t.f) || '').includes(canonT(surf))) { semOk++; continue; }
    const key = `${surf}  →  ${t.f} § ${h.txt}`;
    off.set(key, (off.get(key) || 0) + 1);
  }
  const semBad = semTot - semOk;
  console.log(`[5] 용어와 다른 제목의 절로 착지 (경고) ${semBad}건 / ${semTot} — 의미 도달률 ${(semOk * 100 / semTot).toFixed(1)}%`);
  show([...off.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${String(n).padStart(4)}  ${k}`), (s) => s);
}

const unlinkedOver = Math.max(0, unlinked.length - MAX_UNLINKED);
const errors = broken.length + unlinkedOver + dupIds.length;
console.log('');
console.log(
  errors
    ? `✖ ERROR — 깨진 점프 ${broken.length} · 중복 id ${dupIds.length} · 미링크 ${unlinked.length}(허용 ${MAX_UNLINKED})`
    : `✓ 통과 (미링크 ${unlinked.length} ≤ 허용 ${MAX_UNLINKED})`,
);
process.exit(errors ? 1 : 0);
