---
title: "LeetCode 743 - Network Delay Time (Medium)"
date: 2026-07-22 21:30:00 +0900
categories: ["알고리즘", "LeetCode"]
tags: ["algorithm", "graph", "bfs", "cpp"]
render_with_liquid: false
description: "핵심 접근 — queue 를 최소 힙으로 바꾼 다익스트라, INF 는 -1"
image: /assets/img/thumbs/cards/2026-07-22-algo-leetcode-743-network-delay-time.svg
---

> 출처: <https://leetcode.com/problems/network-delay-time/>

```cpp
// LeetCode 743 - Network Delay Time (Medium)
// https://leetcode.com/problems/network-delay-time/
// (같은 골격의 수업 문제: 백준 1697 숨바꼭질 / 1926 그림 — 가중치 1 BFS
//  / 백준 14497 주난의 난 — 0-1 BFS(deque))

// 문제 설명
// 1 ~ n 번 노드와 방향 간선 times[i] = (u, v, w) 가 주어진다.
// (u 에서 v 로 신호가 가는 데 w 의 시간이 걸린다)
// k 번 노드에서 신호를 보낼 때 n 개 노드 전부가 신호를 받는 최소 시간을 구하고,
// 못 받는 노드가 하나라도 있으면 -1.

// 제약 조건
// 1 <= k <= n <= 100, 1 <= times.length <= 6000  (노드는 적고 간선은 많다)
// 1 <= u, v <= n, u != v, (u, v) 쌍은 유일
// 0 <= w <= 100                                  (가중치 0인 간선이 존재할 수 있다)

// Example
// Input : times=[[2,1,1],[2,3,1],[3,4,1]], n=4, k=2
// Output: 2       (4번이 2만큼 걸려 가장 늦게 받는다)
//
// Input : times=[[1,2,1]], n=2, k=2
// Output: -1      (2 -> 1 간선이 없어 1번이 못 받는다)

// 접근 — BFS 골격 그대로, queue 만 최소 힙으로 바꾼다(= 다익스트라)
// 1) 1926·2589·994에서 BFS가 최단거리를 준 근거는 "간선 하나 = 거리 1"이었다. 비용이 전부 같으니
//    큐에 들어간 순서가 곧 거리 순서였던 것. 가중치가 제각각이면 이 대응이 깨진다 —
//    간선 1개짜리 먼 길이 간선 3개짜리 가까운 길보다 늦을 수 있다.
// 2) 그러면 꺼내는 순서를 다시 맞춰 주면 된다. 누적 시간이 짧은 순으로 꺼내면 "먼저 꺼낸 게 최단"이
//    복구된다 → priority_queue(최소 힙). 0/1 가중치면 14497처럼 deque(0-1 BFS)로도 되지만 w 는
//    0 ~ 100 이라 일반 다익스트라로 간다. 넣는 값은 {누적 시간, 노드} — 힙이 first 로 정렬하니
//    시간을 앞에. 노드를 앞에 두면 번호 순으로 꺼내 의미가 사라진다.
// 3) 확정 시점이 "넣을 때"에서 "꺼낼 때"로 옮겨간다. push 는 후보일 뿐이라 그때 기록하면 나중에
//    올라온 더 짧은 경로가 갱신을 못 한다. pop 한 순간이 "남은 후보 중 최소"가 보장되는 시점이라
//    그때 dist 에 기록하고, 이미 값이 있으면 낡은 후보라 버린다(continue).
// 4) INF 는 0 이 아니라 -1. w = 0 이 허용되므로 "거리 0"과 "미방문 0"이 실제로 충돌한다.
//    -1 로 시작하면 가드가 == -1 한 줄로 끝나고, 도달 불가 노드도 끝까지 -1 로 남아 판정에 그대로
//    재사용된다. (0x3f3f3f3f 대신 -1 을 무한대로 쓰기로 정해둔 규칙이 여기서 실물로 확인된다)
// 5) 답은 dist 의 최댓값인데 -1 이 섞이면 max 로는 안 잡힌다(-1 < 실제 시간). 최댓값 루프에서
//    -1 을 만나면 즉시 return -1. 노드 번호가 1-indexed 라 초기화·판정 루프 모두 1 ~ n.
// 시간 O((N + E) log E), 공간 O(N + E)   (N <= 100, E <= 6000)

#include <vector>
#include <queue>

using namespace std;

vector<pair<int, int>> v[104];    // 인접 리스트 (1-indexed) — pair는 {도착 노드, 가중치}
int dist[104];                    // 최단 시간표. -1 = 미방문(무한대) — w=0 과 겹치지 않게 하는 장치

class Solution {
public:
    int networkDelayTime(vector<vector<int>>& times, int n, int k)
    {
        for (int i = 1; i <= n; i++)     // 여러 번 호출되는 함수라 매 호출 리셋
        {
            v[i].clear();
            dist[i] = -1;
        }

        for (auto& t : times)
            v[t[0]].push_back({ t[1], t[2] });

        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
        pq.push({ 0, k });               // {누적 시간, 노드} — 힙이 시간 기준으로 정렬되게 시간을 앞에

        while (pq.size())
        {
            int cost = pq.top().first;
            int here = pq.top().second;
            pq.pop();

            if (dist[here] != -1) continue;   // 이미 확정된 노드면 낡은 후보 → 버림 (visited 자리)

            dist[here] = cost;                // 꺼낸 순간이 최단 확정 시점

            for (auto& p : v[here])
                if (dist[p.first] == -1)      // 확정 안 된 이웃만 후보로
                    pq.push({ cost + p.second, p.first });
        }

        int ret = 0;

        for (int i = 1; i <= n; i++)
        {
            if (dist[i] == -1) return -1;     // 한 노드라도 못 받으면 불가능 (max 전에 걸러야 한다)
            if (dist[i] > ret) ret = dist[i];
        }

        return ret;
    }
};
```

## 정리

- **BFS가 최단거리를 주는 근거는 "간선 비용이 전부 같다"는 전제다.** 가중치가 제각각이면 큐 순서(간선 개수 순)와 거리 순서(누적 시간 순)가 어긋나서, 먼저 꺼낸 노드를 확정해 버리면 나중에 더 짧은 경로가 와도 이미 닫혀 있다. 문제를 읽을 때 가중치 유무를 먼저 확인하면 알고리즘이 거기서 결정된다.
- **큐를 무엇으로 바꾸느냐가 알고리즘 이름을 바꾼다.** `queue`(전부 1: 1697·1926) → `deque`(0/1: 14497 0-1 BFS) → `priority_queue`(0~100: 이 문제)로 이어지는 사다리에서 골격은 거의 그대로고, 선언 한 줄과 "넣는 값이 노드 하나에서 `{누적 시간, 노드}` 쌍으로 바뀌는 것"이 차이다. 힙이 `first` 기준으로 정렬하니 시간을 앞에 둬야 한다.
- **확정 시점이 push에서 pop으로 옮겨간다.** `visited` 체크가 앉던 자리를 `if (dist[here] != -1) continue;`가 대신하고, 기록은 꺼낸 직후에 한다. 같은 노드가 여러 번 힙에 들어가는 건 정상이며 두 번째 이후는 이 가드에서 걸린다.
- **미방문 표식은 실제 값으로 나올 수 없는 값이어야 한다.** `0 ≤ w`라서 비용 0으로 이어진 노드의 최단 시간이 진짜 0이 될 수 있고, 그러면 `0`은 표식으로 못 쓴다. 수업에서 `0x3f3f3f3f` 대신 `-1`을 무한대로 쓰기로 정해뒀던 게 **왜 생긴 규칙인지** 이 제약에서 실물로 확인됐다 — 습관이 먼저 있었고 그걸 필요로 하는 케이스를 나중에 만난 셈이다.
- 그 인코딩의 대가가 최댓값 루프다. "전부가 받는 시간"은 가장 늦게 받는 노드의 시간이라 `max`가 답인데, 도달 불가 `-1`은 `-1 < 실제 시간`이라 조용히 무시된다. 그래서 `max`를 갱신하기 **전에** `-1`을 만나면 즉시 반환해야 한다. 노드가 1-indexed라 두 루프 모두 `1 ~ n`으로 맞춘다.
- 검증: 예제 3개 + `w=0` 간선 포함(0) + 우회 경로가 더 빠른 그래프(2) + `n=1`(0) + 예제 1 재호출(전역 리셋 확인, 2) 통과 (MSVC `/std:c++17` 컴파일·실행).

> **핵심 요약** — BFS의 "먼저 꺼낸 게 최단"은 간선 비용이 전부 같을 때만 성립하므로, 가중치가 0~100으로 제각각이면 `queue`를 최소 힙으로 바꿔 꺼내는 순서를 누적 시간 오름차순으로 만든다. 확정 시점도 push가 아니라 pop으로 옮겨 `if (dist[here] != -1) continue;`가 `visited` 체크를 대신한다. `w = 0`이 허용돼 "거리 0"과 "미방문 0"이 실제로 충돌하므로 무한대는 `-1`로 인코딩하고, 답이 최댓값이라 `-1`은 `max` 전에 즉시 걸러 `-1`을 반환해야 한다.
{: .prompt-tip }
