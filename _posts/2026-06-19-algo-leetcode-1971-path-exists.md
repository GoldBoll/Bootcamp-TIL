---
title: "LeetCode 1971 - Find if Path Exists in Graph (Easy)"
date: 2026-06-19 21:30:00 +0900
categories: ["알고리즘", "LeetCode"]
tags: ["algorithm", "graph", "bfs", "dfs", "stack-overflow", "cpp"]
render_with_liquid: false
description: "핵심 접근 — 인접 리스트 + BFS 큐, 재귀 DFS는 깊이 20만에서 죽는다"
image: /assets/img/thumbs/cards/2026-06-19-algo-leetcode-1971-path-exists.svg
---

> 출처: <https://leetcode.com/problems/find-if-path-exists-in-graph/>

```cpp
// LeetCode 1971 - Find if Path Exists in Graph (Easy)
// https://leetcode.com/problems/find-if-path-exists-in-graph/
// (같은 골격의 수업 문제: 백준 2606 바이러스 — 06-11 DFS)

// 문제 설명
// 정점 0 ~ n-1 의 무방향 그래프. edges[i] = {u, v} 는 u-v 양방향 간선이다.
// source 에서 destination 으로 가는 경로가 존재하면 true, 없으면 false.

// 제약 조건
// 1 <= n <= 200,000, 0 <= edges.length <= 200,000
// 중복 간선 없음, 자기 루프 없음, 0 <= source, destination <= n - 1

// Example
// Input : n=3, edges={{0,1},{1,2},{2,0}}, source=0, destination=2
// Output: true    (0->1->2 로 닿는다)
//
// Input : n=6, edges={{0,1},{0,2},{3,5},{5,4},{4,3}}, source=0, destination=5
// Output: false   ({0,1,2} 와 {3,4,5} 가 분리된 두 덩어리)

// 접근 — 인접 리스트 + BFS 큐 (이 제약에서 재귀 DFS는 실제로 죽는다)
// 도달성만 묻고 최단거리는 안 물으므로 DFS/BFS 어느 쪽이든 답은 같다. 골격을 정하는 건 제약이다.
// 1) 정점이 2*10^5 이면 인접 행렬은 4*10^10 칸이라 물리적으로 못 잡는다. 간선도 2*10^5 인
//    희소 그래프라 인접 리스트가 유일한 선택. 무방향이니 양쪽에 push_back (2606과 동일).
// 2) 2606은 N <= 100 이라 재귀 DFS로 충분했지만 여기는 0-1-2-...-199999 일자 그래프가 가능하다.
//    실측: 2606식 재귀 dfs를 그 입력에 얹으면 MSVC x64 기본 스택 1MB에서
//    종료 코드 0xC00000FD = STATUS_STACK_OVERFLOW 로 프로세스가 죽는다. 같은 입력을 아래 BFS는 통과.
// 3) source == destination 이면 간선을 볼 것도 없이 true — n=1 / 간선 0개 입력을 이 가지로 방어한다.
// 4) LeetCode는 한 프로세스에서 여러 케이스를 연달아 호출한다. 전역 v/visited 에 이전 케이스가
//    남으면 없는 간선이 살아나 false 가 true 로 뒤집히므로 매 호출 앞에서 0 ~ n-1 만 초기화한다.
// 시간 O(n + E), 공간 O(n + E)

#include <vector>
#include <queue>

using namespace std;

vector<int> v[200004];                   // 인접 리스트 (06-11 템플릿 그대로)
int visited[200004];                     // bool 대신 int — 0=미방문, 1=방문

class Solution {
public:
    bool validPath(int n, vector<vector<int>>& edges, int source, int destination)
    {
        for (int i = 0; i < n; i++)      // 다중 케이스 대비 — 이번에 쓰는 범위만 초기화
        {
            v[i].clear();
            visited[i] = 0;
        }

        for (auto e : edges)
        {
            v[e[0]].push_back(e[1]);
            v[e[1]].push_back(e[0]);
        }

        if (source == destination) return true;

        queue<int> q;                    // 06-11 BFS 큐 템플릿 — 반복문이라 깊이 20만에도 안전
        q.push(source);
        visited[source] = 1;

        while (!q.empty())
        {
            int here = q.front(); q.pop();
            for (int i : v[here])
            {
                if (!visited[i])
                {
                    if (i == destination) return true;   // 큐에 넣기 전에 도착 판정
                    visited[i] = 1;
                    q.push(i);
                }
            }
        }

        return false;
    }
};
```

## 정리

- 같은 도달성 문제라도 **제약이 골격을 정한다**. 2606(`N ≤ 100`)에서 굳힌 "DFS/BFS 아무거나 써도 된다"는 습관을 `n ≤ 200,000`에 그대로 옮기면 오답이 아니라 **프로세스가 사라진다** — 일자 그래프 입력에서 종료 코드 `0xC00000FD`(`STATUS_STACK_OVERFLOW`)를 직접 확인했다. DFS/BFS 등가성은 "답이 같다"는 뜻이고 실행 가능성은 별개다.
- 자료구조 선택이 알고리즘 선택보다 먼저 온다. 정점 대비 간선이 희소하면 인접 리스트, 정점이 작고 이미 행렬로 주어지면 행렬 — 여기서는 행렬이 `(2·10⁵)²`라 계산해 보는 것만으로 탈락한다.
- 조기 종료 두 개가 각각 다른 역할을 한다. `source == destination`은 `n=1`·간선 0개 입력을 분기 없이 처리하고, 큐에 **넣기 전** 도착 판정은 정답에 영향 없이 남은 정점 순회만 줄인다. 시작점은 push되는 게 아니라 초기값으로 들어가므로 앞 가지가 없으면 `n=1`이 `false`가 된다.
- **채점 환경의 호출 방식이 초기화 습관을 바꾼다.** 백준은 1케이스 = 1프로세스라 전역이 0으로 시작하는 걸 믿어도 됐지만, LeetCode는 한 프로세스에서 여러 케이스를 호출한다. `v[]`에 남은 간선은 `false`를 `true`로 뒤집고, `visited[]`에 남은 1은 갈 수 있는 곳을 못 가게 만든다. 배열 전체 20만이 아니라 `0 ~ n-1`만 돌면 충분하다.
- 그 오염은 **큰 케이스를 먼저 돌린 뒤 작은 케이스를 재호출해야** 드러난다. 반대 순서면 잔여물이 있어도 조용히 통과한다.
- 검증: 예제 2개와 `n=1`·분리 그래프·직접 간선을 포함해 `n=200000` → `n=6` → `n=3` → `n=1` 순으로 같은 프로세스에서 이어 호출해 5/5 통과 (MSVC 19.44 `/EHsc /W3 /std:c++17 /O2` 컴파일·실행).

> **핵심 요약** — 도달성 문제에서 DFS/BFS는 답이 같을 뿐이고, `n = 200,000` 일자 그래프에 2606식 재귀 DFS를 얹으면 `0xC00000FD`(`STATUS_STACK_OVERFLOW`)로 프로세스가 죽는다. 인접 리스트는 그대로 두고 큐 골격으로 갈아타면 깊이와 무관해지며, LeetCode는 한 프로세스에서 여러 케이스를 호출하므로 전역 배열은 매 호출 `0 ~ n-1`만 명시적으로 초기화해야 한다.
{: .prompt-tip }
