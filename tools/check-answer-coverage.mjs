// 상단 `## 모의면접 답변` 이 그 문서의 소주제를 전부 덮는가.
//
// 사용자 지시(2026-08-05): "소주제도 정의·동작·활용으로 묶여 있으면 위에 모의면접 답변은
// 전부 다 적어줘야 해". 문서에 들어온 사람이 가장 먼저 만나는 글이 상단 답변이고,
// 그게 `#ovdef` 정의 띠의 내용이기도 하다. 소주제가 답변에 없으면 그 주제는 입구가 없다.
//
// `45_algo_*` 는 한 주제에 4구획이라 답변 하나가 그 주제를 온전히 덮는다 — 그게 양식 정본이다.
// 소주제가 여럿인 문서가 그 대응을 못 맞추는 것을 여기서 잡는다.
//
// **이 도구는 후보만 뽑는다.** 헤딩 낱말이 답변에 있는지로 판정하므로 오탐·미탐이 둘 다 난다
// (표기가 달라 놓치거나, 낱말만 스쳐 지나가도 덮은 것으로 센다).
// 최종 확정은 사람이 읽어서 한다 — 문자열 포함 판정만 믿다 이번 라운드 내내 오탐을 냈다.
//
//   node tools/check-answer-coverage.mjs        요약 + 미달 문서
//   node tools/check-answer-coverage.mjs -v     문서별 전수
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { outOfAnswerScope } from './answer-scope.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'raw', 'cs-notion');
const verbose = process.argv.includes('-v');
// 개념 절이 아닌 것 — 답변이 덮을 대상이 아니다
const META = /^(모의면접 답변|발표 답변|학습 영역|키워드|목차|핵심 요약|핵심 개념|정리|총정리|요약|회귀 다리|연관 문서|꼬리질문|면접 Q&A|면접 단골|심화 질문|실전 출제|하위 페이지|빠른 자가|내부 키워드|추가 키워드|오늘|한 줄 정의|소주제 훑기)/;
// 제외 목록은 `tools/answer-scope.mjs` 한 곳에 둔다 — 두 스크립트가 다른 목록을 쓰면
// 다음 사람이 어긋난 수치를 본다(2026-08-05 실측: 여기선 뺀 `CS_면접_요약본` 이
// 다른 스캔에선 `0/7` 결손으로 올라왔다). 판정 근거는 파일명이 아니라 **머리말**이다.
const SKIP_FILE = { test: (f) => outOfAnswerScope(f) };
// META 판정은 번호 접두사를 벗기고 한다 — `## 9. 면접 단골 꼬리물기` 가 `^면접 단골` 을
// 비껴가 소주제로 잡히던 실측 사례가 있다(2026-08-05 워커 발견). 도구 의도상 제외 대상이다.
const isMeta = (t) => META.test(t.replace(/^\s*\d+(?:[.\-–]\d+)*[.)]?\s*/, ''));
const canon = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// 헤딩에서 "이 절이 무엇에 대한 것인가"를 나타내는 낱말들을 뽑는다.
// `5. TSharedRef vs TSharedPtr — null 허용 여부` → [tsharedref, tsharedptr, null허용여부]
const terms = (h) => {
  const base = h.replace(/^\s*\d+(?:[.\-–]\d+)*[.)]?\s*/, '').replace(/[`*]/g, '').trim();
  const parts = [];
  for (const seg of base.split(/\s+[—–]\s+|\s*\/\s*|\s+vs\.?\s+|·/)) {
    const t = seg.trim();
    if (!t) continue;
    parts.push(t);
    for (const m of t.matchAll(/\(([^()]+)\)/g)) parts.push(m[1]);
    const out = t.replace(/\s*\([^()]*\)/g, '').trim();
    if (out && out !== t) parts.push(out);
  }
  return [...new Set(parts.map(canon).filter((x) => x.length >= 2))];
};

const rows = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.md') && !SKIP_FILE.test(x))) {
  const L = fs.readFileSync(path.join(DIR, f), 'utf8').split(/\r?\n/);
  let fence = false; const hs = [];
  L.forEach((l, i) => {
    if (/^\s{0,7}```/.test(l)) { fence = !fence; return; }
    if (fence) return;
    const m = l.match(/^(#{1,6})\s+(.+)$/);
    if (m) hs.push({ i, lv: m[1].length, t: m[2].trim() });
  });
  const ai = hs.findIndex((h) => h.lv === 2 && /^모의면접 답변|^발표 답변/.test(h.t));
  if (ai < 0) continue;
  let ae = ai + 1; while (ae < hs.length && hs[ae].lv > 2) ae++;
  const answer = canon(L.slice(hs[ai].i + 1, ae < hs.length ? hs[ae].i : L.length).join(' '));

  // 유입용 용어 절을 모집단에서 뺀다.
  //   다른 문서에서 그 용어를 눌렀을 때 착지하라고 심어 둔 절이지 이 문서의 소주제가 아니다
  //   (`21_context_switching § 운영체제 (OS)`·`30_tcp_vs_udp § ACK (확인 응답)` 등).
  //   여기에 소주제 답변을 달면 안 된다 — 소주제가 아니기 때문이다(2026-08-05 사용자 지적).
  //
  // 판별은 두 단계다. **"번호가 없으면 용어 절"은 틀렸다** — 37개를 훑어 확인했다.
  //   01_runtime·04_oop·05_vtable·07_pointer_reference 는 문서 전체가 무번호인데
  //   `캡슐화`·`상속`·`Vtable이란?`·`재할당 가능성` 은 그 문서의 본체다.
  //   ① 문서에 번호 절이 하나도 없으면 → 그 문서의 관행이므로 전부 소주제
  //   ② 번호 절이 섞여 있는데 이 절만 무번호면 → 용어 절 후보.
  //      그중 **단일 용어를 세우는 제목**만 제외한다. `array vs vector`·`얕은 복사와 깊은 복사`
  //      처럼 둘을 견주는 제목은 소주제라 남긴다.
  const guAll = [];
  hs.forEach((h, k) => {
    if (h.lv !== 2 || isMeta(h.t)) return;
    let ei = k + 1; while (ei < hs.length && hs[ei].lv > 2) ei++;
    if (hs.slice(k + 1, ei).some((x) => /^(정의|차이점|동작|활용)/.test(x.t))) guAll.push(h.t);
  });
  const hasNumbered = guAll.some((t) => /^\d+\./.test(t));

  // 문답 문서 — 절 제목이 곧 질문인 문서는 통째로 뺀다.
  //   `15_1_vector_vs_hash_concepts` 는 12개 절이 전부 `Q1.`~`Q12.` 이고,
  //   `21_context_switching_followup` 은 스스로 "이 5개 질문이 어떻게 연결되나" 라고 부른다.
  //   여기에 소주제 답변을 달면 **답 위에 답을 얹는 꼴**이라 대상이 아니다.
  // 신호 둘: `Q숫자` 접두 · 제목이 종결어미로 끝남(명사구가 아니라 완결된 문장이다).
  //   "레지스터는 메모리일까요?"·"…스레드가 빠르다" 는 질문/주장이지 주제 이름이 아니다.
  // 문서 단위 과반으로 본다 — `36_unreal_strings § 선택 기준 — 무엇을 언제 쓰나` 처럼
  // 멀쩡한 문서에 한둘 섞인 것까지 빼면 안 되기 때문이다.
  const isQaTitle = (t) => {
    const b = t.replace(/^\s*\d+(?:[.\-–]\d+)*[.)]?\s*/, '').replace(/[`*]/g, '').trim();
    // `지` 는 종결어미로 쓰지 않는다 — `핵심 차이 4가지` 가 걸려 `03_new_vs_malloc` 이
    // 통째로 빠졌다(실측 오탐). `N가지` 는 명사구다.
    return /^Q\d/.test(t.trim()) || /[?？]$/.test(b) || /(다|까|요|나|네)$/.test(b);
  };
  if (guAll.length >= 3 && guAll.filter(isQaTitle).length / guAll.length >= 0.5) continue;

  const isTermSection = (t) => {
    if (!hasNumbered || /^\d+\./.test(t)) return false;
    if (/\bvs\b|와 |과 |·/.test(t.split(/\s+[—–]\s+/)[0])) return false;  // 둘을 견주는 제목은 소주제
    return t.split(/\s+[—–]\s+/)[0].trim().length <= 22;                  // 단일 용어를 세우는 짧은 제목
  };

  const subs = [];
  hs.forEach((h, k) => {
    if (h.lv !== 2 || isMeta(h.t) || isTermSection(h.t)) return;
    // 개념 절 = 4구획을 거느린 H2. 그게 사용자가 말한 "정의·동작·활용으로 묶인 소주제"다
    let ei = k + 1; while (ei < hs.length && hs[ei].lv > 2) ei++;
    const kids = hs.slice(k + 1, ei).map((x) => x.t);
    if (!kids.some((t) => /^(정의|차이점|동작|활용)/.test(t))) return;
    // (다) 형식 — 그 소주제가 **자기 `### 모의면접 답변`** 을 가지면 덮인 것이다.
    // 소주제를 누르고 들어온 사람이 그 자리에서 답을 만나는 게 목적이므로, 상단이 그 소주제를
    // 언급하는지는 부차적이다. 이걸 안 세면 상단을 줄일수록 미포함이 늘어 검사기가
    // (다)와 정면으로 어긋난다(2026-08-05 워커 지적 — 21번을 15→8줄로 줄이자 0→2로 늘었다).
    let ei2 = k + 1; while (ei2 < hs.length && hs[ei2].lv > 2) ei2++;
    if (hs.slice(k + 1, ei2).some((x) => /^모의면접 답변|^발표 답변/.test(x.t))) {
      subs.push({ t: h.t, line: h.i + 1, hit: true, own: true, ts: [] });
      return;
    }
    const ts = terms(h.t);
    // 통짜 낱말이 그대로 있으면 확실히 덮은 것.
    let hit = ts.some((t) => answer.includes(t));
    // 없으면 어절 단위로 본다 — `3. 캐시 히트와 미스의 본질` 은 통짜로는 안 맞지만
    // 답변이 "찾는 데이터가 그 계층에 있으면 캐시 히트, 없으면 캐시 미스" 라고 말하면 덮은 것이다.
    // 조사를 떼고, 내용이 없는 껍데기 낱말(본질·의미·관점·구조…)은 세지 않는다.
    if (!hit) {
      const FILLER = /^(본질|의미|관점|구조|종류|방법|상세|비교|정리|개념|기준|사례|전체|기본|심화|이유|원리|특징|실제|한줄|정의|차이|동작|활용|무엇|어떻게|언제|왜)$/;
      const words = h.t.replace(/^\s*\d+(?:[.\-–]\d+)*[.)]?\s*/, '')
        .split(/[\s—–·/()]+/)
        .map((w) => canon(w.replace(/(와|과|의|은|는|이|가|을|를|에|로|으로|란|이란)$/, '')))
        .filter((w) => w.length >= 2 && !FILLER.test(w));
      if (words.length) {
        const found = words.filter((w) => answer.includes(w)).length;
        hit = words.length <= 2 ? found === words.length : found / words.length >= 2 / 3;
      }
    }
    subs.push({ t: h.t, line: h.i + 1, hit, ts });
  });
  if (!subs.length) continue;
  const miss = subs.filter((s) => !s.hit);
  rows.push({ f, n: subs.length, miss, ansLen: answer.length });
}

rows.sort((a, b) => b.miss.length - a.miss.length || b.n - a.n);
const totSub = rows.reduce((a, b) => a + b.n, 0);
const totMiss = rows.reduce((a, b) => a + b.miss.length, 0);
console.log('=== 상단 모의면접 답변의 소주제 커버리지 ===');
console.log(`  문서 ${rows.length}개 · 소주제(4구획을 거느린 H2) ${totSub}개`);
console.log(`  답변이 안 덮는 소주제 ${totMiss}개  (${(100 - totMiss * 100 / totSub).toFixed(1)}% 커버)`);
console.log('  ※ 헤딩 낱말 기준 후보다. 확정은 읽어서 한다 — 표기가 다르면 놓치고, 스쳐만 가도 덮은 것으로 센다.\n');
for (const r of rows) {
  if (!r.miss.length && !verbose) continue;
  console.log(`${r.f}  소주제 ${r.n}개 중 ${r.miss.length}개 미포함  (답변 ${r.ansLen}자)`);
  for (const m of r.miss) console.log(`   :${m.line}  ${m.t.slice(0, 62)}`);
}
