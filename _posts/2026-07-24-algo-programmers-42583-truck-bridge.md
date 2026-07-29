---
title: "프로그래머스 42583 - 다리를 지나는 트럭 (Lv.5)"
date: 2026-07-24 21:30:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm", "queue", "simulation"]
render_with_liquid: false
description: "핵심 접근 — 다리를 길이 고정 큐로 두고 빈 칸 0을 밀어 1초를 표현"
image: /assets/img/thumbs/cards/2026-07-24-algo-programmers-42583-truck-bridge.svg
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/42583>

```cpp
// 프로그래머스 42583 - 다리를 지나는 트럭 (Lv.5)
// https://school.programmers.co.kr/learn/courses/30/lessons/42583

// 문제 설명
// 트럭 여러 대가 일차선 다리를 정해진 순서대로 건넌다. 다리에는 최대 bridge_length대가
// 동시에 올라갈 수 있고, 다리 위 트럭 무게의 합은 weight를 넘을 수 없다.
// 트럭은 1초에 1만큼 이동하며, 다리에 완전히 오르지 않은 트럭의 무게는 고려하지 않는다.
// 모든 트럭이 다리를 건너는 최소 시간을 반환하라.

// 제약 조건
// 1 <= bridge_length <= 10,000
// 1 <= weight <= 10,000
// 1 <= truck_weights 길이 <= 10,000
// 1 <= truck_weights[i] <= weight

// Example
// Input : bridge_length = 2,   weight = 10,  truck_weights = [7, 4, 5, 6]
// Output: 8
// Input : bridge_length = 100, weight = 100, truck_weights = [10]
// Output: 101
// Input : bridge_length = 100, weight = 100, truck_weights = [10] * 10
// Output: 110

// 접근 — 길이 고정 큐 시뮬레이션
// 다리를 "칸이 bridge_length개인 큐"로 본다. 빈 칸은 0으로 채워 큐 길이를 항상 일정하게 유지한다.
// 1) 1초가 지날 때마다 맨 앞 칸을 pop한다 = 그 칸에 있던 트럭이 다리를 빠져나간다.
//    빠져나간 무게만큼 현재 하중 load를 줄인다.
// 2) 다음 트럭을 올려도 load + 무게 <= weight면 push하고 다음 트럭으로 넘어간다.
//    안 되면 0(빈 칸)을 push해 다리 전체를 한 칸 전진시킨다.
// 3) 큐 길이가 항상 bridge_length이므로 "트럭이 몇 초 남았는지"를 따로 관리할 필요가 없다.
//    push된 순간부터 bridge_length번 pop되면 자동으로 반대편에 닿는다.
// 4) 루프는 마지막 트럭이 "다리에 올라선 시각"에서 끝나므로,
//    그 트럭이 다 건너는 데 필요한 bridge_length를 더해 반환한다.
// 시간 O(트럭 수 * bridge_length) 최악, 공간 O(bridge_length)

#include <vector>
#include <queue>

using namespace std;

int solution(int bridge_length, int weight, vector<int> truck_weights) {
    queue<int> bridge;
    for (int i = 0; i < bridge_length; i++) bridge.push(0);   // 다리 = 길이만큼의 칸, 0은 빈 칸

    int t = 0, load = 0, idx = 0;
    int n = truck_weights.size();

    while (idx < n) {
        t++;
        load -= bridge.front(); bridge.pop();                 // 맨 앞 칸이 다리를 빠져나간다

        if (load + truck_weights[idx] <= weight) {            // 하중이 남으면 다음 트럭 진입
            load += truck_weights[idx];
            bridge.push(truck_weights[idx]);
            idx++;
        }
        else bridge.push(0);                                  // 못 들어가면 빈 칸을 밀어 넣어 한 칸 전진
    }
    return t + bridge_length;                                 // 마지막 트럭이 다리를 다 건너는 시간
}
```

## 정리

- **큐 길이를 `bridge_length`에 고정하고 빈 칸을 0으로 채우는 것**이 이 풀이의 전부다. 트럭마다 "몇 초 남았는지"를 들고 다니면 매초 전부 감소시켜야 하지만, 칸을 물리적으로 채워두면 `pop` 한 번이 곧 1초 경과이고 push된 트럭은 정확히 `bridge_length`번 pop된 뒤 반대편에 닿는다. **시간을 자료구조의 길이로 인코딩**하는 전형적인 시뮬레이션 기법이다.
- 하중은 큐를 순회해서 구하지 않고 **`load` 변수로 증분 유지**한다. 매초 큐를 다 더하면 O(t × bridge_length)가 되지만, push/pop 시점에 `+=`/`-=`만 하면 갱신이 O(1)이다. 슬라이딩 윈도우에서 합을 굴리는 것과 같은 습관.
- 마지막이 `t + bridge_length`인 이유를 헷갈리기 쉽다. `while (idx < n)` 루프는 **마지막 트럭이 다리에 "올라선" 시각**에서 끝난다. 문제가 묻는 것은 다 "건너는" 시간이므로 다리 길이만큼을 더해야 한다. 반대로 루프를 큐가 완전히 빌 때까지 돌리면 이 덧셈이 필요 없지만, 트럭이 없는 구간을 계속 도는 낭비가 생긴다.
- 복잡도는 정직하게 **최악 O(n × bridge_length)**다. 트럭 무게가 전부 `weight`와 같아 한 번에 한 대만 올라갈 수 있으면 매 트럭마다 `bridge_length`초를 쓰므로 10,000 × 10,000 = 10⁸ 회. 실측 0.28초로 통과하긴 하지만 여유가 크지 않다. 못 들어갈 때 1초씩 미는 대신 **"맨 앞 트럭이 빠져나가는 시각"으로 건너뛰면** 반복이 트럭 수에 비례해 O(n)이 된다 — 제약이 한 자리만 커져도 이 최적화가 필요하다.
- 빈 칸을 0으로 쓰는 트릭은 **트럭 무게가 1 이상이라는 제약에 의존**한다. 0이 유효한 무게일 수 있는 변형이라면 `pair<무게, 유효>`나 별도 카운터로 빈 칸을 구분해야 한다. "센티넬 값이 실제 데이터와 겹치지 않는가"는 이런 풀이에서 항상 확인할 지점이다. 커리큘럼 102번.
- 검증: 예제 3개(8, 101, 110) 통과, 경계 `(1, 1, [1])` → 2 / `(1, 10, [1,1,1])` → 4 확인, 최대 규모 `(10000, 10000, [10000] × 10000)` → 100,000,001이 0.28초, 가벼운 최대 입력 `(10000, 10000, [1] × 10000)` → 20,000이 0.00초 미만 (MSVC `/O2 /std:c++17`).

> **핵심 요약** — 다리를 길이 `bridge_length`로 고정한 큐로 두고 빈 칸을 0으로 채우면 `pop` 한 번이 1초가 되어 잔여 시간 관리가 통째로 사라진다. 루프는 마지막 트럭이 올라선 시각에서 끝나므로 `bridge_length`를 더해야 하고, 최악 복잡도는 O(n × bridge_length) ≈ 10⁸이라 시각 건너뛰기 최적화가 여유를 만든다.
{: .prompt-tip }
