// [알고리즘 시험 3] MT 장보기 — 백트래킹과 가지치기  (34점)
//
// 문제 설명
// 양수 가격 목록에서 몇 개를 골라 합이 예산(target)과 "정확히" 같아지는
// 조합이 모두 몇 가지인지 센다. 각 상품은 담는다/안 담는다 두 갈래.
//
// 접근 — 백트래킹 + 가지치기 (prices는 오름차순 정렬되어 들어옴)
// 분기 순서가 중요: 성공 → 가지치기 → 실패 순으로 검사해야 한다.
//  · 성공: sum == target 이면 1 (양수뿐이라 더 담으면 반드시 초과 → 즉시 확정)
//  · 가지치기: sum > target 이면 0 (더 내려가도 절대 못 맞춤 → 탐색 중단)
//  · 실패: idx == size 까지 왔는데 못 맞췄으면 0
// 성공 검사를 실패 검사보다 "먼저" 둬야, 마지막 상품을 담아 딱 맞춘
// 조합({10} 단독 등)을 실패로 버리지 않는다.
//
// ── 소문항 답안 ─────────────────────────────────────────
// 1) 성공/실패 순서를 바꾸면 T4가 9로 나오는 이유
//    → ① 마지막 상품을 담아 정확히 예산을 맞춘 조합({10} 단독)이
//         (idx==size 검사가 먼저라) "실패"로 처리되기 때문
// 2) T4 탐색 노드 수 (성공→가지치기→실패 순) → 349
// 3) [TODO 2] 가지치기 주석 처리 시 T4 탐색 노드 수 → 1701 (정답은 그대로 10)
// 4) (서술) 가지치기는 "정답(결과값)"을 바꾸지 않고 탐색량(노드 수·속도)만
//    줄이는 장치다. 349 vs 1701 — 답 10은 그대로지만 노드 수만 달라진다.
// ────────────────────────────────────────────────────────

#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
using namespace std;

long long explored = 0;   // 탐색한 노드 수 (자동 집계 — 건드리지 마세요)

// idx번째 상품부터 "담는다 / 안 담는다"를 결정한다.
//   sum    = 지금까지 담은 금액의 합
//   target = 정확히 맞춰야 하는 예산
//   반환   = 합을 정확히 target으로 만드는 경우의 수
long long countWays(const vector<int>& prices, int idx, int sum, int target) {
    explored++;

    // [TODO 1] 성공 — 합이 정확히 target (양수뿐이라 더 담으면 반드시 초과)
    if (sum == target) return 1;

    // [TODO 2] 가지치기 — 이미 초과했으면 더 내려가도 못 맞춤
    if (sum > target) return 0;

    // [TODO 3] 실패 — 상품을 다 봤는데 못 맞췄으면 0
    if (idx == (int)prices.size()) return 0;

    // [TODO 4] idx번째를 담는 경우 + 안 담는 경우
    long long withItem    = countWays(prices, idx + 1, sum + prices[idx], target);
    long long withoutItem = countWays(prices, idx + 1, sum, target);

    return withItem + withoutItem;
}

// ───────────── 채점용 main (수정 금지) ─────────────
int main() {
    int pass = 0, total = 0;

    auto check = [&](vector<int> prices, int target, long long expected, string name) {
        total++;
        sort(prices.begin(), prices.end());   // 정렬은 백트래킹의 동반자
        explored = 0;
        long long got = countWays(prices, 0, 0, target);
        bool ok = (got == expected);
        if (ok) pass++;
        long long maxNodes = (1LL << (prices.size() + 1)) - 1;   // 가지치기 없는 이론상 최대
        cout << (ok ? "[PASS] " : "[FAIL] ") << name
             << " — 기대값 " << expected << ", 내 답 " << got
             << "  (탐색 노드 " << explored << " / 최대 " << maxNodes << ")" << endl;
    };

    check({5, 12, 8, 3, 7},                15, 3,  "테스트 1: 상품 5개, 예산 15");
    check({2, 4, 6, 8},                    10, 2,  "테스트 2: 상품 4개, 예산 10");
    check({3, 3, 3},                        6, 3,  "테스트 3: 같은 가격 3개");
    check({1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, 10, 10, "테스트 4: 상품 10개, 예산 10");

    cout << endl << pass << " / " << total << " 통과"
         << (pass == total ? " — 수고했습니다, 시험 끝!" : " — TODO를 다시 살펴보세요.") << endl;
    return 0;
}

/* ── 실행 출력 (IO) ─────────────────────────────────────────────
입력(가격 목록, 예산) → 출력(합=예산 조합 수) + 탐색 노드(가지치기 효과)

  {5,12,8,3,7},  15 → 3   (탐색 노드 49 / 최대 63)
  {2,4,6,8},     10 → 2   (탐색 노드 27 / 최대 31)
  {3,3,3},        6 → 3   (탐색 노드 13 / 최대 15)
  {1..10},       10 → 10  (탐색 노드 349 / 최대 2047)

콘솔:
  [PASS] 테스트 1: 상품 5개, 예산 15 — 기대값 3, 내 답 3  (탐색 노드 49 / 최대 63)
  [PASS] 테스트 2: 상품 4개, 예산 10 — 기대값 2, 내 답 2  (탐색 노드 27 / 최대 31)
  [PASS] 테스트 3: 같은 가격 3개 — 기대값 3, 내 답 3  (탐색 노드 13 / 최대 15)
  [PASS] 테스트 4: 상품 10개, 예산 10 — 기대값 10, 내 답 10  (탐색 노드 349 / 최대 2047)

  4 / 4 통과 — 수고했습니다, 시험 끝!

※ [TODO 2] 가지치기 주석 처리 시 테스트 4 탐색 노드: 349 → 1701 (정답 10은 불변)
──────────────────────────────────────────────────────────────── */
