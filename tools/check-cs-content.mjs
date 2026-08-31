// CS 문서 내용 검증 — 검사기들이 못 보던 두 가지를 본다.
//
//   [1] 구획 설명 충실도 — 4구획을 세워 놓고 정작 그 안에 설명이 없는 절
//   [2] 꼬리질문 연결   — 링커가 다음 주제로 이어지는가
//
//   node tools/check-cs-content.mjs        요약 + 미달 목록
//   node tools/check-cs-content.mjs -v     파일별 전수
//
// md 를 직접 읽는다(발행본 불필요). 빌드 전에도 돌릴 수 있다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'raw', 'cs-notion');
const GU = new Set(['정의', '차이점', '동작', '활용·사용법', '활용']);
const SKIP_FILE = /^(CS_면접_요약본|00_index|발표_)/;
const verbose = process.argv.includes('-v');

// 본문 한 줄이 "설명"인가 — 헤딩·코드펜스·표 구분선·빈 줄은 아니다
const isProse = (l) => l.trim() && !/^#{1,6} /.test(l) && !/^\s{0,7}```/.test(l)
  && !/^\|[\s:|-]+\|$/.test(l) && !/^-{3,}$/.test(l);

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md') && !SKIP_FILE.test(f));
let guTotal = 0, guEmpty = 0, guThin = 0;
const emptyList = [], thinList = [], chainList = [];
let chainDocs = 0, chains = 0, links = 0, deep = 0, badAnchor = 0;

// 앵커 사전 — 링크 대상이 실재하는지 보려면 전 파일 헤딩을 먼저 모아야 한다
const slug = (t) => {
  let o = '';
  for (const ch of t.replace(/`([^`]*)`/g, '$1').replace(/\*\*?([^*]*)\*\*?/g, '$1').trim().toLowerCase())
    if (/[\p{L}\p{N}_-]/u.test(ch)) o += ch; else if (ch === ' ') o += '-';
  return o;
};
const anchors = new Map();   // 파일(확장자 없음) → Set(슬러그)
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.md'))) {
  const set = new Set();
  let inFence = false;
  for (const l of fs.readFileSync(path.join(DIR, f), 'utf8').split(/\r?\n/)) {
    if (/^\s{0,7}```/.test(l)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = l.match(/^#{1,6}\s+(.+)$/);
    if (m) set.add(slug(m[1]));
  }
  anchors.set(f.replace(/\.md$/, ''), set);
}

// 코드펜스 짝 검사 — 홀수면 마지막 여는 펜스가 파일 끝까지 안 닫혀 그 뒤 본문이 통째로
// 코드 블록으로 렌더된다. 19_process_vs_thread 에서 실제로 `연관 문서` 절 25개 링크가
// 마크다운 원문으로 화면에 박혔다(2026-08-05). md 파서 기준 검사는 전부 통과했다 —
// 렌더된 화면에서만 드러나는 종류라 여기서 잡는다.
const fenceOdd = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.md'))) {
  const n = fs.readFileSync(path.join(DIR, f), 'utf8').split(/\r?\n/)
    .filter((l) => /^\s{0,7}```/.test(l)).length;
  if (n % 2) fenceOdd.push(`${f} (${n}개)`);
}

for (const f of files) {
  const L = fs.readFileSync(path.join(DIR, f), 'utf8').split(/\r?\n/);
  let inFence = false;
  const heads = [];
  L.forEach((l, i) => {
    if (/^\s{0,7}```/.test(l)) { inFence = !inFence; return; }
    if (inFence) return;
    const m = l.match(/^(#{1,6})\s+(.+)$/);
    if (m) heads.push({ i, lv: m[1].length, t: m[2].replace(/`/g, '').trim() });
  });

  // ── [1] 구획 충실도
  heads.forEach((h, k) => {
    if (!GU.has(h.t)) return;
    guTotal++;
    // 구획의 범위는 "다음 헤딩"이 아니라 "다음 구획 또는 상위 헤딩"까지다.
    // 중간의 하위 헤딩(#### 세부)도, 같은 레벨의 문답 블록(### Q1. …)도 이 구획에 딸린 내용이다
    // — 문답 모음 절에서 `### 동작` 다음이 `### Q1.` 인 구조를 "빈 구획"으로 오판했었다(실측 4건).
    let ei = k + 1;
    while (ei < heads.length && heads[ei].lv >= h.lv && !GU.has(heads[ei].t)) ei++;
    const end = ei < heads.length ? heads[ei].i : L.length;
    const body = L.slice(h.i + 1, end).filter(isProse);
    const chars = body.join(' ').replace(/\s+/g, '').length;
    if (!body.length) { guEmpty++; emptyList.push(`${f}:${h.i + 1} ${h.t}`); }
    else if (chars < 25) { guThin++; thinList.push(`${f}:${h.i + 1} ${h.t} (${chars}자)`); }
  });

  // ── [2] 꼬리질문 사슬
  // 후보 절이 여럿이다 — `연관 문서 — 한 단계 더 깊이`(링크 사슬) · `N. 회귀 다리`(표) ·
  // `꼬리질문 예상 경로`(코드펜스 트리). 첫 매칭만 보면 링크가 표·트리에만 있는 절을 골라
  // "링크 0"으로 오판한다(26번 실제 사례). 후보 전부를 합쳐서 센다.
  const cands = heads.map((h, k) => [h, k]).filter(([h]) => /연관 문서|회귀 다리|꼬리질문/.test(h.t));
  if (!cands.length) { chainList.push(f + '  — 연관 문서 절 없음'); continue; }
  chainDocs++;
  const lines = [];
  for (const [h, k] of cands) {
    const e = k + 1 < heads.length ? heads[k + 1].i : L.length;
    lines.push(...L.slice(h.i + 1, e));
  }
  let nHere = 0, fence2 = false;
  for (const raw of lines) {
    // 코드펜스 안은 링크가 아니다 — 꼬리질문 트리에 operator[](k) 같은 코드가 들어 있다
    if (/^\s{0,7}```/.test(raw)) { fence2 = !fence2; continue; }
    if (fence2) continue;
    // 인라인 코드를 먼저 지운다 — `operator[](k)` 같은 코드가 마크다운 링크로 오인된다
    const l = raw.replace(/`[^`]*`/g, ' ');
    const ls = [...l.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]);
    if (!ls.length) continue;
    nHere++; chains++; links += ls.length;
    if (ls.length >= 2) deep++;
    for (const u of ls) {
      if (/^https?:/.test(u)) continue;
      const [fp, an] = u.split('#');
      const base = (fp || f).replace(/^\.\//, '').replace(/\.md$/, '');
      const set = anchors.get(base);
      if (!set) { badAnchor++; chainList.push(`${f}  — 대상 파일 없음: ${u}`); continue; }
      if (an && !set.has(an)) { badAnchor++; chainList.push(`${f}  — 앵커 없음: ${u}`); }
    }
  }
  if (!nHere) chainList.push(f + '  — 연관 문서 절에 링크 0');
  if (verbose) console.log(`  ${f.padEnd(34)} 구획 ${String(guTotal).padStart(3)}  사슬 ${nHere}`);
}

// ── [3] 요약 충실도 — 말로 답할 수 있는 요약이 있는가
//   (가) 개념 문서는 파일 상단에 `## 모의면접 답변` 을 갖는다 (색인·복습·발표류 제외)
//   (나) **중요 개념 절**은 45_algo_* 양식을 따른다:
//          ### 모의면접 답변   ← 3~4문장 구술 요약
//          ### 정의            ← 1~2문장, 짧게
//        정의 구획에 요약을 밀어 넣지 마라. 예전 규칙이 "정의 첫 문단 60자 이상"이었는데
//        그 탓에 정의가 벽처럼 부푼 절이 73개 생겼다(2026-08-04 사용자 지적).
//        정의는 짧을수록 좋고, 말할 거리는 그 위 `모의면접 답변` 이 맡는다.
//   중요도는 자동 링크 착지 수로 잰다 — 사람이 실제로 도달하는 절이 중요한 절이다.
//   14_std_map_followup 은 서로 무관한 꼬리질문 11개 모음이라 대표 개념이 없다.
//   억지로 한 덩이 요약을 붙이면 지어내는 것이 되므로 색인류와 같이 제외한다.
const IDXLIKE = /^(00_index|CS_면접_요약본|CS_추가키워드_복습|발표_|키워드-보강|14_std_map_followup)/;
let noAnswer = 0, secTotal = 0;
const noAnsList = [];
for (const f of files) {
  const L = fs.readFileSync(path.join(DIR, f), 'utf8').split(/\r?\n/);
  let fence = false; const heads = [];
  L.forEach((l, i) => {
    if (/^\s{0,7}```/.test(l)) { fence = !fence; return; }
    if (fence) return;
    const m = l.match(/^(#{1,6})\s+(.+)$/);
    if (m) heads.push({ i, lv: m[1].length, t: m[2].replace(/`/g, '').trim() });
  });
  if (!IDXLIKE.test(f) && !heads.some((h) => /^모의면접 답변/.test(h.t))) {
    noAnswer++; noAnsList.push(f);
  }
  // 개념 절 수만 센다. 정의 길이는 검사하지 않는다 —
  // "정의 첫 문단 60자 이상" 규칙이 정의를 벽처럼 부풀린 절을 73개 만들었고(2026-08-04 사용자 지적)
  // 되돌렸다. 정의는 짧을수록 좋고, 말할 거리는 그 위 `모의면접 답변` 이 맡는다.
  heads.forEach((h, k) => {
    const kid = heads[k + 1];
    if (h.lv === 2 && kid && kid.lv > 2 && kid.t === '정의') secTotal++;
  });
}

console.log('=== [1] 구획 설명 충실도 (4구획 ' + guTotal + '개) ===');
console.log('  내용 없음   ' + guEmpty + '건');
console.log('  25자 미만   ' + guThin + '건');
if (emptyList.length) console.log('\n  [내용 없음]\n   ' + emptyList.slice(0, 20).join('\n   '));
if (thinList.length) console.log('\n  [너무 얇음]\n   ' + thinList.slice(0, 15).join('\n   '));

console.log('\n=== [2] 꼬리질문 연결 (문서 ' + files.length + '개) ===');
console.log('  연관 문서 절 보유  ' + chainDocs + '/' + files.length);
console.log('  사슬 ' + chains + '개 / 링크 ' + links + '개 / 2단계 이상 ' + deep + '개');
console.log('  깨진 앵커         ' + badAnchor + '건');
if (chainList.length) console.log('\n  [미달]\n   ' + chainList.slice(0, 20).join('\n   '));

console.log('\n=== [3] 요약 충실도 (개념 절 ' + secTotal + '개) ===');
console.log('  모의면접 답변 없는 문서  ' + noAnswer + '건');
if (noAnsList.length) console.log('\n  [모의면접 답변 없음]\n   ' + noAnsList.join('\n   '));

console.log('\n=== [4] 코드펜스 짝 ===');
console.log('  펜스 홀수 파일  ' + fenceOdd.length + '건' + (fenceOdd.length ? '  ← 그 뒤 본문이 코드 블록으로 렌더된다' : ''));
if (fenceOdd.length) console.log('   ' + fenceOdd.join('\n   '));

const bad = guEmpty + badAnchor + noAnswer + fenceOdd.length;
console.log('\n' + (bad ? '✖ 미달 ' + bad + '건' : '✓ 통과'));
process.exit(bad ? 1 : 0);
