// 사람이 "읽어 보니 정상"이라 확정한 자리 — **판정기록을 읽는 곳은 여기 하나다.**
//
// 왜 모듈인가 — 2026-08-05 에 같은 종류의 구멍이 두 번 났다.
//   ① `읽기검증.mjs` 가 `split(/^##+ *뒤집은 판정/m)[0]` 로 앞부분만 읽어 표 34행 중 0행을 봤다.
//      「읽어 보니 정상」 표가 그 절 **뒤에** 있었다. 판정이 전부 무효였다.
//   ② `링크-의미검증.mjs` 는 기록을 **아예 안 읽었다.** 얇은 착지는 `check-cs` ④ 에 실려 나가는
//      수치인데, 그 산출 도구가 기록을 안 보니 판정을 내려도 그 축에서는 계속 뽑혔다.
// 둘 다 "워커는 읽었는데 검사기는 안 읽었다"였다. 읽는 자리를 하나로 만든다.
//
// **줄 번호와 인용문 둘 다로 잡는다.** 줄 번호만으로는 편집 한 번에 기록이 썩는다 —
// 다른 워커가 위쪽을 고치면 줄이 밀려 엉뚱한 자리를 가리킨다. 줄이 밀려도 문장이 남아 있으면
// 판정은 유효하고, 문장이 바뀌었으면 그때는 다시 판정할 자리가 맞다.

import { readFileSync } from 'node:fs';

const REC = '_work/판정기록-오탐.md';

// 절 제목 대조용 — 기록 표기와 발행본 표기가 공백·기호에서 갈린다
const canonSec = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** 판정기록을 읽어 `isCleared(file, line, text)` 를 돌려준다 */
export function loadVerdicts(path = REC) {
  const cleared = new Set();      // "파일.md:줄"
  const clearedSec = new Set();   // "파일.md|절제목" — 얇은 착지처럼 절 단위로 잡히는 축용
  const clearedText = [];         // { f, frag } — 기록에 인용된 문장 조각
  try {
    const rec = readFileSync(path, 'utf8');
    // 「뒤집은 판정」 **그 절만** 도려낸다 — 뒤집은 것은 이제 후보로 다시 뽑아야 하니까.
    // 절 단위로 쪼개서 뺀다. `split(...)[0]` 은 그 뒤에 오는 표까지 통째로 버린다(①번 사고).
    const upto = rec.split(/^(?=## )/m).filter(s => !/^## *뒤집은 판정/.test(s)).join('');
    // 첫 칸은 세 꼴로 적힌다 — `파일:줄` · `파일` · `파일 § 절 제목`.
    // **셋째를 놓치고 있었다.** 얇은 착지는 줄이 아니라 **절**로 잡히는데 그 꼴이 안 읽혀
    // `13_vector_vs_list § 10. 모의면접 답변 템플릿` 은 등재해 놓고도 계속 후보로 나왔다.
    for (const row of upto.split('\n').filter(l => /^\|/.test(l))) {
      const fm = /`([0-9A-Za-z_가-힣-]+?)(?:\.md)?(?::([0-9·,\s]+)|\s*§\s*([^`]+))?`/.exec(row);
      if (!fm) continue;
      const file = `${fm[1]}.md`;
      for (const ln of (fm[2] || '').split(/[·,\s]+/).filter(Boolean)) cleared.add(`${file}:${ln}`);
      // 절 판정은 **어느 축의 판정인지까지** 기억한다. 표 둘째 칸이 축이다.
      // 안 그러면 `B4 오탐` 판정 하나가 같은 절의 얇은 착지까지 조용히 지운다 —
      // 판정은 축 단위로 유효하지 절 전체를 면제하는 게 아니다.
      if (fm[3]) {
        const axis = (row.split('|')[2] || '').trim();
        clearedSec.add(`${file}|${canonSec(fm[3])}|${canonSec(axis)}`);
      }
      // 인용문 지문도 **축을 달고 다닌다.** 축 없이 두면 얇은 착지 판정의 인용문이
      // 같은 문장을 보는 B1·B4 후보까지 조용히 지운다(실측: B1 2→0 · B4 1→0 으로 잘못 줄었다).
      // 판정은 축 단위로 유효하지 그 문장을 영구 면제하는 게 아니다.
      const axisCol = canonSec((row.split('|')[2] || '').trim());
      // 굽은 따옴표와 곧은 따옴표를 **둘 다** 받는다 — 사람이 어느 쪽을 쓸지 정할 수 없고,
      // 한쪽만 받으면 멀쩡히 등재한 판정이 조용히 무시된다(실측으로 걸렸다).
      for (const q of row.matchAll(/["“”]([^"“”]{6,60})["“”]/g))
        clearedText.push({ f: file, frag: q[1].replace(/[…\s]+/g, ''), axis: axisCol });
    }
  } catch { /* 기록이 아직 없으면 전부 후보로 둔다 */ }

  const isCleared = (f, line, text, axisHint) =>
    cleared.has(`${f}:${line}`) ||
    (text != null && clearedText.some(c => c.f === f && c.frag &&
      (!axisHint || !c.axis || c.axis.includes(canonSec(axisHint))) &&
      String(text).replace(/\s+/g, '').includes(c.frag.slice(0, 12))));

  // 절 제목으로 묻는다 — 얇은 착지는 줄 번호가 아니라 절로 잡힌다.
  // 기록의 제목 표기와 발행본 표기가 공백·기호에서 갈리므로 눌러서 비교한다.
  // `axisHint` 를 주면 그 축의 판정만 인정한다. 축 문자열은 부분 일치로 본다
  // (기록은 `얇은 착지 [산문 부족] 65자/80` 처럼 수치까지 적혀 있다).
  const isClearedSection = (f, sectionText, axisHint) => {
    const key = `${f}|${canonSec(sectionText)}|`;
    for (const k of clearedSec) {
      if (!k.startsWith(key)) continue;
      if (!axisHint || k.slice(key.length).includes(canonSec(axisHint))) return true;
    }
    return false;
  };

  return { cleared, clearedSec, clearedText, isCleared, isClearedSection };
}
