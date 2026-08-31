// CS 문서·뷰어 통합 검증 — 손댔으면 이거 하나만 돌리면 된다.
//
//   node tools/check-cs.mjs           빌드 후 전 항목 검증
//   node tools/check-cs.mjs --nobuild  빌드 없이 (발행본이 최신일 때)
//
// 검증 3단계(사용자가 상시 요구한 것):
//   ① 구획 설명 충실도 — 4구획을 세워 놓고 그 안에 설명이 있는가
//   ② 꼬리질문 연결   — 링커가 다음 주제로 이어지는가
//   ③ 검색 정의 도달  — 검색했을 때 정의 절이 즉답·1위로 오는가
// 여기에 기존 무결성 검사(링크·정의 먼저·4구획 골격)를 얹어 한 화면에 보인다.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (rel, args = []) => {
  try {
    return { ok: true, out: execFileSync('node', [path.join(ROOT, rel), ...args], { encoding: 'utf8', maxBuffer: 64 << 20 }) };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
};
const pick = (out, re) => (out.match(re) || [])[0] || '—';

if (!process.argv.includes('--nobuild')) {
  process.stdout.write('빌드 중… ');
  const b = run('tools/build-interview-viewer.mjs');
  if (!b.ok) { console.log('실패\n' + b.out.slice(0, 2000)); process.exit(1); }
  console.log(pick(b.out, /자동 링크 \d+개 \/ 타깃 \d+종/) + ' · ' + pick(b.out, /파일상단 폴백 \d+/));
}

const gates = [];
const content = run('tools/check-cs-content.mjs');
const search = run('tools/check-search.mjs');
const links = run('tools/check-viewer-links.mjs');
const defcov = run('tools/check-def-coverage.mjs');
const audit = run('_work/audit-cs-4구획.mjs');
const sem = run('_work/링크-의미검증.mjs');
const read = run('_work/읽기검증.mjs');
const alias = run('_work/별칭검증.mjs');

console.log('\n① 구획 설명 충실도');
console.log('   4구획 ' + pick(content.out, /\(4구획 \d+개\)/) + ' · 내용 없음 ' + pick(content.out, /내용 없음 +\d+건/)
  + ' · ' + pick(content.out, /25자 미만 +\d+건/));
gates.push(['구획 내용 없음', /내용 없음 +(\d+)건/.exec(content.out)?.[1] === '0']);

console.log('\n② 꼬리질문 연결');
console.log('   ' + pick(content.out, /연관 문서 절 보유 +\d+\/\d+/) + ' · ' + pick(content.out, /사슬 \d+개 \/ 링크 \d+개 \/ 2단계 이상 \d+개/));
console.log('   깨진 앵커 ' + pick(content.out, /깨진 앵커 +\d+건/).replace(/\D+/g, '') + '건');
gates.push(['사슬 앵커', /깨진 앵커 +(\d+)건/.exec(content.out)?.[1] === '0']);

console.log('\n③ 검색 정의 도달');
console.log('   ' + pick(search.out, /즉답이 정본으로 +\d+\/\d+ +\([\d.]+%\)/));
console.log('   ' + pick(search.out, /섹션 1위가 정본 +\d+\/\d+ +\([\d.]+%\)/));
console.log('   ' + pick(search.out, /결과 0건 +\d+/));
gates.push(['검색 0건', /결과 0건 +(\d+)/.exec(search.out)?.[1] === '0']);

console.log('\n④ 링크 무결성');
for (const re of [/\[1\] 깨진 점프 +\d+건/, /\[2\] 미링크 키워드 +\d+건/, /\[3\] 중복 앵커 id +\d+건/, /\[4\] 고아 앵커 \(경고\) +\d+건/])
  console.log('   ' + pick(links.out, re));
console.log('   ' + pick(links.out, /의미 도달률 [\d.]+%/) + '  (엄밀 판정: ' + pick(sem.out, /의미 도달률 [\d.]+%/).replace('의미 도달률 ', '') + ')');
console.log('   ' + pick(sem.out, /\(A\) 재타깃하면 됨 +\d+건 \/ \d+종/) + ' · ' + pick(sem.out, /\(B\) 절을 만들어야 함 +\d+건 \/ \d+종/));
// 도달률 100% 뒤에 숨는 것 — 도달했다고 쓸모가 있는 건 아니다. 요약에도 끌어올린다(2026-08-05).
// 게이트로 잡지 않는다(고칠 곳 목록이지 합격/불합격이 아니다). 상세는 _work/링크-의미검증.mjs.
console.log('   ' + pick(sem.out, /강한 통과 ①③⑤⑥ [\d.]+%/) + ' · ' + pick(sem.out, /\[약한 통과\] \d+건 \/ \d+종/).replace('[약한 통과] ', '약한 통과(점검 대상) '));
// 얇은 착지는 고치는 법이 갈린다 — 코드만 있는 절은 한 줄 세우면 끝나고, 산문 부족은 읽어 봐야 안다.
console.log('   ' + pick(sem.out, /\[얇은 착지\] \d+건 \/ \d+절/).replace('[얇은 착지] ', '얇은 착지(설명이 없는 절) ')
  + '  ' + pick(sem.out, /갈래: [^\n]+/));
gates.push(['링크 무결성', links.ok]);

console.log('\n⑤ 4구획 골격 · 정의 먼저');
console.log('   ' + pick(audit.out, /대상 절 \d+ \/ 통과 \d+ \/ 미달 \d+/));
console.log('   ' + pick(defcov.out, /주제 카드 +\d+\/\d+ 충족/) + ' · ' + pick(defcov.out, /유입 원본 섹션 +\d+\/\d+ 충족 · 결손 \d+/));
gates.push(['4구획 미달', /미달 (\d+)/.exec(audit.out)?.[1] === '0']);
gates.push(['정의 결손', /결손 (\d+)/.exec(defcov.out)?.[1] === '0']);

// ⑥ 읽다가 막히는 자리 — ①~⑤가 전부 통과하는데도 사용자가 읽다 막힌 자리를 축으로 만든 것이다.
// ①~⑤는 **도달과 골격**을 잰다. 링크가 실재하는가, 구획이 있는가, 정의 절이 있는가.
// 그런데 "map 을 눌렀는데 설명이 없다"가 그 전부를 통과하고 있었다. 막힌 자리는 늘 이 넷이었다 —
// 용어가 던져지고 안 이어짐 · 답변이 말하기 어려움 · 구조가 문서마다 다름 · 다음에 갈 곳이 없음.
// **게이트로 잡지 않는다.** 전부 후보 목록이고 확정은 읽어야 한다 — 기계 판정이 여덟 번 뒤집힌 전례가 있다.
// 상세·전수는 `node _work/읽기검증.mjs [A|B|C|D]`.
console.log('\n⑥ 읽다가 막히는 자리  (후보 목록 · 게이트 아님)');
for (const re of [/A1 [^\n]*\d+건/, /A3 [^\n]*\d+건/, /A4 [^\n]*\d+건/, /B1 [^\n]*\d+건/,
                  /B2 [^\n]*\d+건/, /B3 [^\n]*\d+건/, /B4 [^\n]*\d+건/, /B5 [^\n]*\d+건/, /C1 [^\n]*\d+건/, /C2 [^\n]*\d+건/,
                  /D1 [^\n]*\d+건/, /D2 [^\n]*\d+건/])
  console.log('   ' + pick(read.out, re));
// 등록은 선언이지 보장이 아니다 — 먼저 등록된 쪽이 이겨 별칭이 조용히 진다(공백 든 표면형은 구조적으로 진다).
// 링크 0 은 셋으로 갈린다 — 억제·포함은 정상이고 **미등장만 손볼 자리다**. 요약에는 미등장만 올린다.
console.log('   ' + pick(alias.out, /✗ 다른 곳에 착지 +\d+건/) + ' · △ 미등장 '
  + (/미등장 (\d+)\]/.exec(alias.out)?.[1] ?? '—') + '건');

const bad = gates.filter(([, ok]) => !ok);
console.log('\n' + (bad.length ? '✖ 미달: ' + bad.map(([n]) => n).join(' · ') : '✓ 전 항목 통과'));
process.exit(bad.length ? 1 : 0);
