// GitHub 슬러그 — **정본은 여기 하나다.**
//
// 사본이 셋이던 동안 슬러그로 두 번 물렸다.
//   · `\s+` 로 공백을 합쳐 `A — B` 의 이중 하이픈이 죽고 멀쩡한 링크 1,739건이 깨진 것으로 나왔다
//   · `①` 을 버려 34_ustruct_vs_uclass 앵커 4건이 깨진 것으로 나왔다 —
//     `①` 은 유니코드 Number-other 라 `\p{N}` 에 들고, 그래서 **슬러그에서 살아남는다**
// 둘 다 문서가 아니라 검사기가 틀린 것이었다. 검사기가 빌더와 다른 규칙을 쓰면
// 그 검사기가 내는 목록 전체를 믿을 수 없다.
//
// 규칙: 소문자화 → 문자·숫자·`_`·`-` 만 남김 → 공백은 **하나씩** 하이픈.
// 공백을 합치지 않는 것이 핵심이다. 버려지는 기호(`—`·`&`)가 앞뒤 공백을 남겨
// 이중 하이픈이 되는데, GitHub 이 실제로 그렇게 만든다.

export const stripInlineMd = (s) =>
  String(s)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    .replace(/\*\*/g, '');

export function githubSlug(text) {
  let out = '';
  for (const ch of stripInlineMd(text).trim().toLowerCase()) {
    if (/[\p{L}\p{N}_-]/u.test(ch)) out += ch;
    else if (ch === ' ') out += '-';
  }
  return out;
}
