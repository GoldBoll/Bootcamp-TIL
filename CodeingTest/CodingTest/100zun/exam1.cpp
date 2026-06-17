// [알고리즘 시험 1] 회의실 배정 — 그리디는 "기준"이 전부다  (33점)
//
// 문제 설명
// 회의실이 하나뿐이다. 각 회의는 [시작, 종료) 반열린 구간이며,
// 한 회의가 끝나는 시각에 다음 회의를 바로 시작할 수 있다.
// 겹치지 않게 배정할 수 있는 최대 회의 수를 구하라.
//
// 접근 — 활동 선택(Activity Selection) 그리디
// - 정렬 기준: "종료 시간이 빠른 순"  → 회의를 일찍 끝낼수록 뒤에 남는 시간이
//   최대가 되어 더 많은 회의를 담을 수 있다.  (시작 시간순은 틀린 기준)
// - 선택 조건: 직전 회의가 끝난 시각(lastEnd) 이후에 시작하면 선택.
//   [start, end) 반열린 구간이라 start == lastEnd 도 허용( >= ).
// - 시간 복잡도 O(N log N) (정렬 지배)
//
// ── 소문항 답안 ─────────────────────────────────────────
// 1) [TODO 1] 정렬 기준        → ② return a.end < b.end;
// 2) [TODO 2] 선택 조건        → ② m.start >= lastEnd
// 3) {(0,5),(5,6),(2,7),(6,8),(1,9),(8,9)} → 4 개
//    (0,5)→(5,6)→(6,8)→(8,9) 선택
// 4) (서술) 시작 시간순 정렬은 가장 먼저 (1,10)을 골라 방을 10까지 독점해,
//    안 겹치는 짧은 회의 3개를 모두 놓치기 때문(1개 vs 최적 3개).
// ────────────────────────────────────────────────────────

#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
using namespace std;

// 회의 하나: [start, end) — 이전 회의의 end 시각에 다음 회의를 시작할 수 있다
struct Meeting {
    int start;
    int end;
};

// [TODO 1] 종료 시간 오름차순 — 일찍 끝나는 회의 우선
bool compareMeeting(const Meeting& a, const Meeting& b) {
    return a.end < b.end;
}

// 겹치지 않게 선택할 수 있는 최대 회의 수
int maxMeetings(vector<Meeting> meetings) {
    sort(meetings.begin(), meetings.end(), compareMeeting);

    int count = 0;
    int lastEnd = 0;   // 마지막으로 선택한 회의의 종료 시간

    for (const Meeting& m : meetings) {
        // [TODO 2] 직전 회의가 끝난 뒤(또는 끝나자마자) 시작하면 선택
        if (m.start >= lastEnd) {
            count++;
            lastEnd = m.end;
        }
    }
    return count;
}

// ───────────── 채점용 main (수정 금지) ─────────────
int main() {
    int pass = 0, total = 0;

    auto check = [&](vector<Meeting> meetings, int expected, string name) {
        total++;
        int got = maxMeetings(meetings);
        bool ok = (got == expected);
        if (ok) pass++;
        cout << (ok ? "[PASS] " : "[FAIL] ") << name
             << " — 기대값 " << expected << ", 내 답 " << got << endl;
    };

    check({{2,3},{3,4},{4,5},{1,10}}, 3, "테스트 1: 긴 회의의 유혹");
    check({{1,4},{3,5},{0,6},{5,7},{3,8},{5,9},{6,10},{8,11}}, 3, "테스트 2: 신청 8건");
    check({{0,3},{2,5},{4,7},{6,9},{8,11}}, 3, "테스트 3: 절반만 가능");
    check({{5,9}}, 1, "테스트 4: 회의 하나");

    cout << endl << pass << " / " << total << " 통과"
         << (pass == total ? " — 완료! 다음 문제로 가세요." : " — TODO를 다시 살펴보세요.") << endl;
    return 0;
}

/* ── 실행 출력 (IO) ─────────────────────────────────────────────
입력(회의 목록) → 출력(최대 회의 수)

  {(2,3),(3,4),(4,5),(1,10)}                    → 3
  {(1,4),(3,5),(0,6),(5,7),(3,8),(5,9),(6,10),(8,11)} → 3
  {(0,3),(2,5),(4,7),(6,9),(8,11)}              → 3
  {(5,9)}                                       → 1

콘솔:
  [PASS] 테스트 1: 긴 회의의 유혹 — 기대값 3, 내 답 3
  [PASS] 테스트 2: 신청 8건 — 기대값 3, 내 답 3
  [PASS] 테스트 3: 절반만 가능 — 기대값 3, 내 답 3
  [PASS] 테스트 4: 회의 하나 — 기대값 1, 내 답 1

  4 / 4 통과 — 완료! 다음 문제로 가세요.
──────────────────────────────────────────────────────────────── */
