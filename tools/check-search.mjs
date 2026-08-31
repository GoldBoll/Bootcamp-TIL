// 검색 품질 검사기 — 발행본의 CORE·SIDX를 그대로 꺼내 브라우저 없이 실제 검색을 재현한다.
//
//   node tools/check-search.mjs            전체 검사 (요약 + 실패 목록)
//   node tools/check-search.mjs -v         질의별 전수 출력
//   node tools/check-search.mjs "해시"     질의 하나만 (즉답 + 상위 5)
//
// 판정: 질의마다 "이 파일의 이 절로 가야 한다"를 기대값으로 두고, 즉답(맨 위 큰 박스)과
// 섹션 1위가 그리로 가는지 본다. 기대값은 아래 CASES 에 파일 접두사만 적는다 —
// 절 제목까지 박으면 문서를 손볼 때마다 검사기가 깨져서 오히려 안 돌리게 된다.
import fs from 'node:fs';
import vm from 'node:vm';

const HTML = new URL('../raw/cs-notion/interview-viewer.html', import.meta.url);
const html = fs.readFileSync(HTML, 'utf8');

// ── 발행본에서 검색 엔진과 인덱스를 그대로 꺼낸다
const core = html.slice(html.indexOf('var CORE=(function SEARCH_CORE()'), html.indexOf('/*__CORE_END__*/'));
const P = 'var SIDX=CORE.prepIndex(';
const start = html.indexOf(P) + P.length;
let depth = 0, i = start, inStr = false, esc = false;
for (; i < html.length; i++) {
  const c = html[i];
  if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
  if (c === '"') { inStr = true; continue; }
  if (c === '{' || c === '[') depth++;
  else if (c === '}' || c === ']') { depth--; if (!depth) { i++; break; } }
}
const ctx = vm.createContext({});
vm.runInContext(core + '\nvar SIDX=CORE.prepIndex(' + html.slice(start, i) + ');', ctx);
const search = (q) => vm.runInContext(`CORE.search(SIDX, ${JSON.stringify(q)})`, ctx);

// ── 즉답 선택은 발행본 bestHit 과 같은 규칙이어야 한다. 규칙이 바뀌면 여기도 같이 고칠 것.
function bestHit(r) {
  const bt = r.topics[0], bs = r.sections[0];
  if (bs && bs.band === 1 && bs.def === 0) return { s: bs };
  if (bt && (bt.band === 1 || !bs)) return { t: bt };
  if (bs && bs.band === 1) return { s: bs };
  if (bt) return { t: bt };
  if (bs) return { s: bs };
  return null;
}

// ── [질의, 기대 파일 접두사]. 기대가 null 이면 "0건만 아니면 통과"
const CASES = [
  ['해시', '14_std_map_followup'], ['해시 충돌', '15_pushback'], ['rehash', '15_hash_rehash'],
  ['가상 메모리', '29_memory_hierarchy'], ['페이지 폴트', '26_page_fault'],
  ['페이지 테이블', '26_page_fault'], ['페이지 프레임', '26_page_fault'],
  ['컨텍스트 스위칭', '21_context_switching'], ['커널', '21_context_switching'],
  ['특권 모드', '21_context_switching'], ['CR3', '21_context_switching'],
  ['프로세스와 스레드', '19_process_vs_thread'], ['메모리 단편화', '27_memory_fragmentation'],
  ['캐시 히트', '25_cache_hit_miss'], ['캐시 미스', '25_cache_hit_miss'], ['캐시', '25_cache_hit_miss'],
  ['워킹 셋', '26_page_fault'], ['메모리 4영역', '01_runtime'], ['컴파일러', '01_runtime'],
  ['포인터', '07_pointer_reference'], ['레퍼런스', '07_pointer_reference'],
  ['vtable', '05_vtable'], ['가상 함수 테이블', '05_vtable'], ['이름 가리기', '05_vtable'],
  ['얕은 복사', '12_prevent_copy'], ['깊은 복사', '12_prevent_copy'],
  ['RAII', '09_rtti_raii'], ['RTTI', '09_rtti_raii'],
  ['스마트 포인터', '11_smart_pointer'], ['참조 카운팅', '11_smart_pointer'],
  ['불변식', '04_oop'], ['다형성', '04_oop'], ['SOLID', '04_oop'], ['기반 클래스', '04_oop'],
  ['컨테이너', '16_stl_containers'], ['자료구조', '16_stl_containers'], ['array vs vector', '16_stl_containers'],
  ['iterator', '17_find_vs_binary_search'], ['이진 탐색', null],
  ['레드블랙 트리', '14_std_map'], ['트리', '14_std_map'],
  ['뮤텍스', '23_race_condition'], ['임계 구역', '23_race_condition'], ['데드락', '23_race_condition'],
  ['우선순위 역전', '23_race_condition'], ['메모리 배리어', '44_memory_barrier'],
  ['TCP', '30_tcp_vs_udp'], ['UDP', '30_tcp_vs_udp'], ['ACK', '30_tcp_vs_udp'],
  ['소켓', '31_socket'], ['TIME_WAIT', '31_socket'], ['방화벽', '32_firewall'],
  ['UObject', '33_uobject'], ['액터', '33_uobject'], ['블루프린트', '33_uobject'],
  ['리플리케이션', '38_unreal_replication'], ['델리게이트', '41_unreal_delegate'],
  ['스택 오버플로', '20_stack_overflow'], ['스택 프레임', '20_stack_overflow'],
  ['운영체제', '21_context_switching'], ['버퍼', '22_ipc'], ['IPC', '22_ipc'],
];

const arg = process.argv.slice(2);
const verbose = arg.includes('-v');
const one = arg.filter((a) => a !== '-v').join(' ');

const label = (b) => !b ? '없음'
  : b.t ? '[카드] ' + b.t.t.num + '. ' + b.t.t.ti
    : '[절] ' + b.s.fn + ' § ' + b.s.h;

if (one) {
  const r = search(one);
  console.log('질의 "' + one + '"');
  console.log('  즉답 : ' + label(bestHit(r)));
  r.sections.slice(0, 5).forEach((s, n) =>
    console.log('   ' + (n + 1) + '. ' + s.fn + ' § ' + s.h + (s.def === 0 ? '  [정의형]' : '')));
  process.exit(0);
}

let okAns = 0, okSec = 0, zero = 0;
const fail = [];
for (const [q, want] of CASES) {
  const r = search(q);
  const b = bestHit(r);
  const s1 = r.sections[0];
  if (!r.topics.length && !r.sections.length) { zero++; fail.push([q, '0건', '']); continue; }
  const ansFile = b ? (b.t ? '(카드)' : b.s.fn) : '';
  const secFile = s1 ? s1.fn : '';
  const hitA = !want || ansFile.startsWith(want);
  const hitS = !want || secFile.startsWith(want);
  if (hitA) okAns++;
  if (hitS) okSec++;
  if (!hitA || !hitS) fail.push([q, want, label(b) + (hitS ? '' : '  / 섹션1위 ' + secFile)]);
  if (verbose) console.log((hitA ? '  O ' : '  X ') + q.padEnd(16) + label(b));
}
const n = CASES.length;
console.log('=== 검색 품질 (질의 ' + n + '개) ===');
console.log('  즉답이 정본으로   ' + okAns + '/' + n + '  (' + (okAns * 100 / n).toFixed(1) + '%)');
console.log('  섹션 1위가 정본   ' + okSec + '/' + n + '  (' + (okSec * 100 / n).toFixed(1) + '%)');
console.log('  결과 0건          ' + zero);
if (fail.length) {
  console.log('\n미달 ' + fail.length + '건:');
  for (const [q, want, got] of fail) console.log('  ' + q.padEnd(16) + '기대 ' + (want || '(0건 아님)') + '  ←  ' + got);
}
process.exit(zero ? 1 : 0);
