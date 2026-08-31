#!/usr/bin/env node
// ============================================================================
// check-def-coverage.mjs — "정의 먼저" 커버리지 진단
//
//   node tools/check-def-coverage.mjs         요약 + 결손 상위 30
//   node tools/check-def-coverage.mjs list    결손 전체(유입 많은 순)
//
// 왜 이 지표인가 — 모집단을 좁게 잡는 이유:
//   면접에서 필요한 건 "그 개념을 물었을 때 첫 문장이 나오는가"다. 그래서 모집단은
//   ① 요약본 45주제 카드(뷰어 첫 화면) ② 링크·색인이 가리키는 원본 섹션(사람이 실제로
//   클릭·검색해 들어오는 지점) 두 개다.
//   개념 섹션 전수(lv2~4, 2037건)로 재면 결손이 1505건 나오지만 그 대부분은
//   `3.1 std::vector — 연속 메모리` 처럼 상위 절이 이미 정의를 세운 하위 절이다.
//   거기에 또 정의를 넣으면 같은 말이 반복돼 훑기가 나빠지므로 결손으로 세지 않는다.
//   → 제외 규칙: level 3 이상 섹션은 상위 절 중 하나가 정의를 갖고 있으면 통과.
//     (level 2 는 그 파일의 독립 개념 단위이므로 스스로 정의를 가져야 한다.)
//   → 제외 규칙 2: 4구획(차이점·동작·활용·사용법) 헤딩과 그 하위는, 같은 파일에
//     정의를 세운 `정의` 구획이 있으면 통과. 4구획은 한 개념을 넷으로 나눈 형제라
//     정의는 `정의` 칸이 전담한다. 여기에 또 정의를 요구하면 같은 말을 네 번 쓰게 된다.
//     45_algo_* 처럼 파일 하나가 개념 하나인 문서가 이 형태다.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'raw', 'cs-notion');
const SUMMARY = 'CS_면접_요약본.md';

const stripInlineMd = (s) => s.replace(/`([^`]*)`/g, '$1').replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1').replace(/\*\*/g, '');
function githubSlug(text) {
  let out = '';
  for (const ch of stripInlineMd(text).trim().toLowerCase()) {
    if (/[\p{L}\p{N}_-]/u.test(ch)) out += ch;
    else if (ch === ' ') out += '-';
  }
  return out;
}

// 개념 설명이 아닌 구조·메타 헤딩
// `꼬리질문 대비 — 답변 중 등장 용어 보충` 은 개념 절이 아니라 답변에 나온 용어를 모아 둔 문답
// 묶음이다. 정의로 시작할 물건이 아니다 — 하단 H2 로 통일하면서 유입 모집단에 들어왔다(2026-08-05).
const META = /^(목차|키워드|참고|모의면접 답변|발표 답변|30초 답변|한 줄 정의|핵심 개념|핵심 키워드|학습 영역|학습 매핑|빠른 자가 점검|체크리스트|핵심 요약|정리|총정리|요약|한 줄 요약|답변 흐름|소주제 훑기|꼬리질문 대비|꼬리질문 연결 맵|면접 답변|발표)/;
// 정의 신호 — "X란 …", "X는 …이다", 명시적 정의 라벨
const DEF_LABEL = /(^|\s)(\*\*)?(정의|한 줄 정의|핵심 한 문장|한 줄 요약|한 줄 정리|무엇인가)/;
const DEF_COPULA = /(이란|란|이라고|는|은)\s+.{6,}(이다|입니다|다\.|이에요|말한다|가리킨다|뜻한다|의미한다|자료구조|방식|패턴|기법|구조|알고리즘|단위|영역)/;
// 정의를 담는 구획 헤딩 — 상위 절의 정의로 승계된다
const DEF_SECTION = /^(정의|한 줄 정의|핵심 한 문장|한 줄 정리)$/;

function parse(name) {
  const lines = fs.readFileSync(path.join(DIR, name), 'utf8').split(/\r?\n/);
  const secs = [];
  let cur = null, inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) { inFence = !inFence; if (cur) cur.blocks.push({ k: 'code' }); continue; }
    if (inFence) { if (cur) cur.blocks.push({ k: 'code' }); continue; }
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      cur = { file: name, level: m[1].length, plain: stripInlineMd(m[2]).trim(), slug: githubSlug(m[2]), blocks: [] };
      secs.push(cur);
      continue;
    }
    if (!cur || !line.trim()) continue;
    if (/^\s*\|/.test(line)) cur.blocks.push({ k: 'table' });
    else if (/^>\s?/.test(line)) cur.blocks.push({ k: 'quote', t: line.replace(/^>\s?/, '') });
    else if (/^\s*([-*]|\d+\.)\s+/.test(line)) cur.blocks.push({ k: 'li', t: line.replace(/^\s*([-*]|\d+\.)\s+/, '') });
    else if (/^\s*-{3,}\s*$/.test(line)) continue;
    else cur.blocks.push({ k: 'p', t: line.trim() });
  }
  const dup = new Map();
  for (const s of secs) {
    const n = dup.get(s.slug) || 0;
    dup.set(s.slug, n + 1);
    if (n > 0) s.slug = `${s.slug}-${n}`;
  }
  // 4구획 골격(정의/차이점/동작/활용·사용법)에서는 정의 문장이 `### 정의` 헤딩 아래로 내려간다.
  // 그러면 상위 절의 첫 블록이 비어 "정의 없음"으로 잡히므로, 바로 뒤에 붙은 정의 구획을
  // 그 절의 정의로 대신 본다. (정의 구획은 반드시 그 절의 첫 하위 절이어야 한다 — 순서가 곧 골격)
  // "바로 뒤"로 잡으면 그 사이에 다른 구획이 끼어드는 순간 깨진다 — `### 모의면접 답변`을
  // H2 아래에 넣기 시작하자 정의 구획이 둘째로 밀려 모집단이 602→539로 줄었다.
  // 결손은 계속 0이지만 분모가 줄어 그 0의 뜻이 약해진다. **하위 절 전체에서 찾는다.**
  for (let i = 0; i < secs.length; i++) {
    if (secs[i].blocks.length) continue;
    for (let j = i + 1; j < secs.length && secs[j].level > secs[i].level; j++) {
      if (secs[j].level === secs[i].level + 1 && DEF_SECTION.test(secs[j].plain)) { secs[i].defProxy = secs[j]; break; }
    }
  }
  // 상위 절 체인
  const stack = [];
  for (const s of secs) {
    while (stack.length && stack[stack.length - 1].level >= s.level) stack.pop();
    s.ancestors = stack.slice();
    stack.push(s);
  }
  return secs;
}

function hasDef(sec) {
  const s = sec.defProxy || sec;
  const firstAny = s.blocks[0];
  if (!firstAny) return false;
  if (firstAny.k === 'table' || firstAny.k === 'code') return false;
  const first = s.blocks.find((b) => b.k === 'p' || b.k === 'li' || b.k === 'quote');
  if (!first || first.t.length < 25) return false;
  return DEF_LABEL.test(first.t) || DEF_COPULA.test(first.t);
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md') && f !== SUMMARY).sort();
const byFile = new Map(files.map((f) => [f, parse(f)]));
const all = [...byFile.values()].flat();

// 유입 카운트: 요약본 색인 + 원본 안 명시 링크가 그 앵커를 몇 번 가리키나
const inbound = new Map();
for (const name of fs.readdirSync(DIR).filter((f) => f.endsWith('.md'))) {
  const src = fs.readFileSync(path.join(DIR, name), 'utf8');
  for (const m of src.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) {
    const url = m[1];
    if (/^https?:/i.test(url)) continue;
    const hash = url.indexOf('#');
    let f = hash < 0 ? url : url.slice(0, hash);
    const a = hash < 0 ? '' : url.slice(hash + 1);
    f = f.replace(/^\.\//, '') || name;
    if (!a) continue;
    const key = `${f}#${a}`;
    inbound.set(key, (inbound.get(key) || 0) + 1);
  }
}

// --- 모집단 ① 요약본 45주제 카드 ---
const sumLines = fs.readFileSync(path.join(DIR, SUMMARY), 'utf8').split(/\r?\n/);
const cards = [];
{
  let mode = '', cardCur = null;
  for (const line of sumLines) {
    if (/^## \d+\.\s/.test(line)) { mode = 'domain'; cardCur = null; continue; }
    if (/^## /.test(line)) { mode = 'extra'; cardCur = null; continue; }
    if (mode !== 'domain') continue;
    const t = line.match(/^### \[(\d+)\.\s*([^\]]+)\]\(([^)]+)\)/);
    if (t) { cardCur = { num: t[1], title: t[2], file: t[3].split('#')[0], def: '' }; cards.push(cardCur); continue; }
    const d = cardCur && !cardCur.def && line.match(/^- \*\*정의\*\*\s*[::]\s*(.*)$/);
    if (d) cardCur.def = stripInlineMd(d[1]).trim();
  }
}
// 카드의 "말로 10~20초" 충족: 원본에 정의 블록(모의면접 답변류)이 있거나 정의 불릿이 120자 이상
const DEF_HEADS = ['모의면접 답변', '발표 답변', '30초 답변', '한 줄 정의', '핵심 개념'];
function fileDefLen(file) {
  const secs = byFile.get(file);
  if (!secs) return 0;
  for (const head of DEF_HEADS) {
    const s = secs.find((x) => x.level === 2 && x.plain.startsWith(head));
    if (!s) continue;
    const txt = s.blocks.filter((b) => b.k === 'p' || b.k === 'li').slice(0, 3).map((b) => b.t).join(' ');
    if (stripInlineMd(txt).length >= 25) return stripInlineMd(txt).length;
  }
  return 0;
}
const cardBad = cards.filter((c) => !(c.def && (fileDefLen(c.file) >= 25 || c.def.length >= 120)));

// --- 모집단 ② 링크·색인 유입 원본 섹션 ---
const entry = all
  .filter((s) => s.level >= 2 && s.level <= 4 && !META.test(s.plain) && (s.blocks.length > 0 || s.defProxy))
  .filter((s) => inbound.has(`${s.file}#${s.slug}`))
  .map((s) => ({ ...s, hits: inbound.get(`${s.file}#${s.slug}`) }));

// 4구획 형제 규칙(위 주석 제외 규칙 2) — 그 파일의 `정의` 구획이 정의를 세웠는가
const GU_SIB = /^(차이점|동작|활용·사용법|활용)$/;
const fileGuDef = new Map();
for (const s of all) {
  if (s.plain.trim() !== '정의' || !hasDef(s)) continue;
  fileGuDef.set(s.file, true);
}
const underGu = (s) => GU_SIB.test(s.plain.trim()) || s.ancestors.some((a) => GU_SIB.test(a.plain.trim()));

// 제외 규칙(위 주석): lv3+ 는 상위 절이 정의를 세웠으면 통과
const entryBad = entry
  .filter((s) => !hasDef(s))
  .filter((s) => !(s.level >= 3 && s.ancestors.some((a) => a.level >= 2 && hasDef(a))))
  .filter((s) => !(underGu(s) && fileGuDef.get(s.file)))
  .sort((a, b) => b.hits - a.hits || a.file.localeCompare(b.file));

const mode = process.argv[2] || '';
console.log('=== "정의 먼저" 커버리지 (모집단 = 카드 45 + 링크·색인 유입 섹션) ===');
console.log(`① 주제 카드           ${cards.length - cardBad.length}/${cards.length} 충족${cardBad.length ? ` · 결손 ${cardBad.map((c) => c.num).join(', ')}` : ''}`);
console.log(`② 유입 원본 섹션      ${entry.length - entryBad.length}/${entry.length} 충족 · 결손 ${entryBad.length}`);
console.log(`   (참고) 개념 섹션 전수 기준으로는 결손이 훨씬 크게 잡힌다 — 상위 절이 정의한 하위 절까지 세기 때문. 위 주석의 제외 규칙 참조.`);
const rows = mode === 'list' ? entryBad : entryBad.slice(0, 30);
if (rows.length) {
  console.log(`\n다음 라운드 대상 — 유입 많은 순 ${mode === 'list' ? '전체' : `상위 ${rows.length}`}:`);
  for (const s of rows) console.log(`  유입 ${String(s.hits).padStart(2)}  lv${s.level}  ${s.file}#${s.slug}  << ${s.plain}`);
}
process.exit(cardBad.length ? 1 : 0);
