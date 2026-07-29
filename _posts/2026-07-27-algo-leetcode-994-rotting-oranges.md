---
title: "LeetCode 994 - Rotting Oranges (Medium)"
date: 2026-07-27 21:30:00 +0900
categories: ["알고리즘", "LeetCode"]
tags: ["algorithm", "bfs", "graph", "simulation", "cpp"]
render_with_liquid: false
description: "핵심 접근 — 멀티소스 BFS + visited 를 1부터 시작하는 +1 인코딩"
image: /assets/img/thumbs/cards/2026-07-27-algo-leetcode-994-rotting-oranges.svg
---

> 출처: <https://leetcode.com/problems/rotting-oranges/>

```cpp
// LeetCode 994 - Rotting Oranges (Medium)
// https://leetcode.com/problems/rotting-oranges/
// (같은 골격의 수업 문제: 백준 1926 그림 — 06-25 BFS / 백준 2589 보물섬 — +1 인코딩)

// 문제 설명
// m x n 격자에서 0은 빈칸, 1은 신선한 오렌지, 2는 썩은 오렌지다.
// 1분마다 썩은 오렌지와 상하좌우로 붙은 신선한 오렌지가 같이 썩는다.
// 신선한 오렌지가 하나도 남지 않을 때까지 걸리는 최소 분을 구하고,
// 끝까지 못 썩는 오렌지가 있으면 -1.

// 제약 조건
// m == grid.length, n == grid[i].length, 1 <= m, n <= 10
// grid[i][j] 는 0, 1, 2 중 하나

// Example
// Input : [[2,1,1],[1,1,0],[0,1,1]]
// Output: 4
//
// Input : [[2,1,1],[0,1,1],[1,0,1]]
// Output: -1      (왼쪽 아래 (2,0)이 대각선으로만 닿아 영원히 안 썩는다)
//
// Input : [[0,2]]
// Output: 0       (신선한 오렌지가 처음부터 없다)

// 접근 — 멀티소스 BFS, 시작 칸을 처음부터 전부 큐에 넣는다
// 1) "동시에 퍼지는 최소 시간" = 최단거리이고 한 칸 비용이 전부 1분이라 BFS. m, n <= 10 이라
//    성능 걱정은 없고 난이도는 전부 판정 조건 쪽에 있다.
// 2) 1926 그림은 덩어리마다 bfs(i,j)를 따로 불렀지만, 소스마다 돌려 합치면 비용도 크고
//    "동시 확산"이라는 의미와도 다르다. 썩은 칸을 전부 큐에 넣고 한 번만 돌린다. 큐가 FIFO라
//    초기 큐에 같은 거리(0분)의 칸들만 있으면 라운드가 안 섞인다 — 큐는 항상 "거리 d 다음에 d+1".
// 3) visited +1 인코딩. 거리 0을 그대로 쓰면 visited == 0 이 "미방문"과 "0분 도달"을 겸해
//    시작 칸이 여러 개인 이 문제에서 바로 오답이 된다. 시작 칸을 1로 두고 이웃은 +1 로 누적하면
//    방문 판정이 if (visited[ny][nx]) continue; 한 줄이고, 실제 분은 -1 로 되돌린다 (2589 규칙).
// 4) 불가능 판정은 격자 재스캔이 아니라 남은 개수 카운터로. fresh 를 미리 세두고 썩힐 때마다
//    깎으면 "도달 못 한 칸이 있는가"가 정수 비교 하나가 되고, "신선한 게 처음부터 0개면 0분"도
//    분기 없이 처리된다 (BFS 라운드 수를 세는 구현은 여기서 1을 뱉기 쉽다).
// 5) ret 은 0으로 시작해야 한다 — -1/INF 로 두면 확산이 없을 때 초기값이 그대로 반환된다.
//    dy/dx 는 4방향. 8방향으로 짜면 예제 2가 오류 없이 조용히 4를 낸다.
// 시간 O(m*n), 공간 O(m*n)

#include <vector>
#include <queue>

using namespace std;

int dy[4] = { -1,0,1,0 };                        // 상하좌우만 — 대각선을 넣으면 예제 2가 틀린다
int dx[4] = { 0,1,0,-1 };

class Solution {
public:
    int orangesRotting(vector<vector<int>>& grid)
    {
        int n = grid.size();
        int m = grid[0].size();

        vector<vector<int>> visited(n, vector<int>(m, 0));   // 지역 vector라 매 호출 새로 잡힌다
        queue<pair<int, int>> q;
        int fresh = 0;

        for (int i = 0; i < n; i++)
            for (int j = 0; j < m; j++)
            {
                if (grid[i][j] == 2)
                {
                    q.push({ i, j });            // 썩은 칸을 전부 큐에 — 멀티소스
                    visited[i][j] = 1;           // +1 인코딩: 1 = 0분
                }
                else if (grid[i][j] == 1) fresh++;
            }

        int ret = 0;

        while (q.size())
        {
            int y = q.front().first;
            int x = q.front().second;
            q.pop();

            for (int i = 0; i < 4; i++)
            {
                int ny = y + dy[i];
                int nx = x + dx[i];

                if (ny < 0 || nx < 0 || ny >= n || nx >= m) continue;
                if (visited[ny][nx] || grid[ny][nx] != 1) continue;   // 방문했거나 신선하지 않으면

                visited[ny][nx] = visited[y][x] + 1;
                fresh--;

                if (visited[ny][nx] - 1 > ret) ret = visited[ny][nx] - 1;   // 인코딩을 실제 분으로

                q.push({ ny, nx });
            }
        }

        if (fresh) return -1;                    // 큐가 마를 때까지 못 닿은 오렌지가 있으면 불가능

        return ret;
    }
};
```

## 정리

- **시작점이 여러 개인 최단거리는 소스를 전부 큐에 넣고 한 번 돌린다.** 큐가 FIFO라서 초기 큐에 같은 거리의 칸들만 들어 있으면 라운드가 섞이지 않고, 1926 골격에서 바뀌는 건 큐 초기화 한 줄(한 칸 push → 여러 칸 push)뿐이다. 소스마다 BFS를 돌려 최솟값을 합치는 건 비용도 크고 "동시에 퍼진다"는 문제 서술과 의미가 다르다.
- **미방문 표식과 실제 값이 겹치면 인코딩을 옮긴다.** 시작 칸을 `1`로 두고 이웃을 `+1`로 누적하는 +1 인코딩이면 `visited == 0`이 "미방문" 하나만 뜻하게 되고, 방문 판정이 `if (visited[ny][nx]) continue;` 한 줄로 끝난다. 답을 낼 때만 `-1`로 되돌린다. 2589 보물섬에서 굳힌 규칙이 시작점 여러 개인 상황에서 값을 한다.
- **불가능 판정은 재스캔이 아니라 카운터로.** `fresh`를 미리 세두고 깎아 나가면 "도달 못 한 칸이 있는가"가 정수 비교 하나가 되고, `[[0,2]]`처럼 신선한 오렌지가 처음부터 없는 케이스가 분기 없이 `0`이 된다. BFS 라운드 수를 세는 구현이 이 케이스에서 `1`을 뱉는 실수를 카운터 방식이 구조적으로 막는다.
- **답의 초기값과 방향 개수는 예제로 검증되는 항목이다.** `ret`을 `-1`이나 INF로 두면 확산이 한 번도 없을 때 초기값이 그대로 반환되고, 8방향으로 짜면 예제 2가 오류 없이 `4`를 낸다 — 예제 2가 `-1`인 이유가 "대각선으로는 안 퍼진다" 하나이므로 이 예제가 틀리면 `dy/dx`부터 본다. `visited`를 전역이 아니라 지역 `vector`로 잡은 건 격자 크기가 입력마다 달라서인데, 덕분에 매 호출 새로 만들어져 `memset`이 필요 없다 — 앞선 문제들의 "매 호출 리셋" 규칙을 다른 방식으로 만족한 셈이다.
- 검증: 예제 3개 + `[[0,0]]`(빈칸만, 0) + `[[1]]`(소스 없음, -1) + 멀티소스 양쪽 확산(2) + `[[2]]`/`[[1,2]]`(0/1) 통과 (MSVC `/std:c++17` 컴파일·실행).

> **핵심 요약** — 썩은 칸을 전부 큐에 먼저 넣으면 큐가 FIFO라서 라운드가 섞이지 않고, 1926 BFS 골격에서 `cnt++` 자리를 `dist + 1`로 바꾸는 것만으로 분(minute) 누적이 된다. `visited`를 1부터 시작하는 +1 인코딩으로 두면 "미방문 0"과 "0분"이 충돌하지 않고, 불가능 판정은 격자 재스캔 대신 남은 신선 개수 카운터로 하면 "신선한 게 처음부터 없으면 0" 케이스까지 자동으로 맞는다.
{: .prompt-tip }
