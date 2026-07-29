---
title: "LeetCode 547 - Number of Provinces (Medium)"
date: 2026-07-09 21:30:00 +0900
categories: ["알고리즘", "LeetCode"]
tags: ["algorithm", "graph", "dfs", "cpp"]
render_with_liquid: false
description: "핵심 접근 — 인접 행렬 그대로 두고 int 반환 DFS로 판정문 제거"
image: /assets/img/thumbs/cards/2026-07-09-algo-leetcode-547-number-of-provinces.svg
---

> 출처: <https://leetcode.com/problems/number-of-provinces/>

```cpp
// LeetCode 547 - Number of Provinces (Medium)
// https://leetcode.com/problems/number-of-provinces/
// (같은 골격의 수업 문제: 백준 2606 바이러스 — 06-11 / 백준 1926 그림 — 06-25 "덩어리 세기")

// 문제 설명
// 도시 n개. isConnected[i][j] == 1 이면 i-j 가 직접 연결.
// 직접/간접으로 이어진 도시 묶음 하나가 "지역(province)"이다. 지역의 총 개수를 구하라.

// 제약 조건
// 1 <= n <= 200, isConnected 는 n x n
// isConnected[i][i] == 1        (대각선은 항상 1 — 자기 자신)
// isConnected[i][j] == isConnected[j][i]  (대칭 — 무방향 그래프)

// Example
// Input : {{1,1,0},{1,1,0},{0,0,1}}
// Output: 2       ({0,1} 과 {2})
//
// Input : {{1,0,0},{0,1,0},{0,0,1}}
// Output: 3       (대각선만 1이라 전부 따로)

// 접근 — 연결 요소 개수 세기, dfs 가 int 를 반환하게 만든다
// 1) "덩어리가 몇 개냐" = 연결 요소(connected component) 개수. 모든 정점에서 탐색을 시도하되
//    이미 방문한 정점에서 시작한 탐색은 새 덩어리가 아니므로 세지 않는다 (1926과 같은 골격).
// 2) 입력이 이미 인접 행렬이고 n <= 200 이라 리스트로 변환하지 않는다. 변환해도 O(n^2)를 한 번
//    더 도는 것뿐이라 이득이 없다. dfs 안에서 for (i=0..n-1) if (a[here][i]) 로 이웃을 훑는다.
// 3) "세면 int 반환" 습관 적용. 맨 앞에 if (visited[here]) return 0; 가드를 두면
//    이미 칠해진 덩어리는 0, 처음 밟는 정점은 덩어리를 전부 칠하고 1을 반환한다.
//    덕분에 호출부가 판정 if 없이 ret += dfs(i) 한 줄로 끝난다.
//    단, 재귀 내부 호출의 반환값은 칠하기용이라 버린다 — 누적은 바깥 루프의 최상위 호출뿐.
// 4) 대각선 함정: isConnected[i][i] == 1 이라 dfs(here)는 자기 자신도 이웃으로 본다.
//    진입 직후 visited[here] = 1 을 찍어두므로 재진입은 가드에서 막힌다 (i == here 예외 불필요).
// 5) 3주 전 1971과 달리 재귀 DFS가 안전하다. 최악(200개가 한 덩어리)의 재귀 깊이가 200뿐이다.
// 시간 O(n^2) = 40,000, 공간 O(n) (visited + 재귀 스택 최대 200)

#include <vector>

using namespace std;

int n;
vector<vector<int>> a;                    // dfs 가 인자 없이 공유 — 06-11 템플릿의 v[] 자리
int visited[204];                         // bool 대신 int, n <= 200 이라 여유분 +4

int dfs(int here)
{
    if (visited[here]) return 0;          // 이미 칠해진 덩어리 → 새 지역이 아니다

    visited[here] = 1;                    // 이웃 순회 '전'에 찍어야 대각선 재진입이 막힌다
    for (int i = 0; i < n; i++)
        if (a[here][i])
            dfs(i);                       // 반환값은 버린다 (칠하기용)

    return 1;                             // 이 호출이 새 덩어리를 열었다
}

class Solution {
public:
    int findCircleNum(vector<vector<int>>& isConnected)
    {
        n = (int)isConnected.size();      // size_t → int 캐스팅 (MSVC C4267 제거)
        a = isConnected;

        for (int i = 0; i < n; i++)
            visited[i] = 0;               // 다중 케이스 대비 초기화

        int ret = 0;
        for (int i = 0; i < n; i++)
            ret += dfs(i);                // 판정 if 없이 누적

        return ret;
    }
};
```

## 정리

- **입력 형식이 이미 적합하면 변환하지 않는다.** "그래프는 인접 리스트"가 규칙이 아니라 "정점 대비 간선이 희소한가"가 기준이다. 인접 행렬 + `n ≤ 200`이면 리스트로 바꿔도 순회 비용이 O(n²)를 벗어나지 않으니 변환 자체가 손해다.
- **세는 문제에서 `int` 반환 DFS는 호출부의 `if`를 지운다.** `if (visited[here]) return 0;` 한 줄이 "가지치기"와 "새 덩어리가 아님"을 겸하고, 성공 경로의 `return 1`이 그대로 개수가 된다. 다만 누적은 최상위 호출에서만 해야 한다 — 안쪽 재귀에서도 더하면 한 덩어리를 여러 번 센다.
- **방문 표시를 이웃 순회 전에 찍으면 자기 루프가 공짜로 막힌다.** 대각선이 항상 1인 행렬에서 `i == here` 예외 처리를 따로 안 써도 되는 게 그 결과다. 행렬이 대칭(`[i][j] == [j][i]`)이라는 제약 덕에 한쪽 방향만 훑는 걱정도 없다.
- 3주 전 1971과 정확히 대비되는 지점이 재귀 깊이다. 정점 상한이 200,000 대 200으로 자릿수가 세 개 다르고, 그래서 같은 재귀 DFS가 한쪽에서는 스택 오버플로로 죽고 여기서는 안전하다. `n=200` 전부 연결(최악 깊이) 케이스를 실제로 돌려 확인했다.
- 전역 `n`·`a`·`visited`를 매 호출 새로 세팅하는 이유는 1971과 같다. `n=200` 케이스 직후 `n=3`, `n=1`을 같은 프로세스에서 재호출해 잔여물이 없는지 봤다.
- 검증: 예제 2개 + `n=1` + 체인·고립 혼합 + `n=200` 전부 고립(200) + `n=200` 전부 연결(1)까지, 다중 호출 순서로 6/6 통과 (MSVC `/std:c++17` 컴파일·실행).

> **핵심 요약** — 인접 행렬이 그대로 주어지고 `n ≤ 200`이면 리스트로 변환할 이유가 없고, 재귀 깊이도 최대 200이라 1971(깊이 20만)과 달리 재귀 DFS가 안전하다. `dfs`를 `int` 반환으로 만들고 맨 앞에 `if (visited[here]) return 0;` 가드를 두면 호출부가 `ret += dfs(i)` 한 줄이 되고, 대각선이 항상 1인 함정도 진입 직후 방문 표시 덕에 별도 처리 없이 막힌다.
{: .prompt-tip }
