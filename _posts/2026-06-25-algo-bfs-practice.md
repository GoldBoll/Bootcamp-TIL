---
title: "백준 BFS 심화 4문제 — 그림·보물섬·숨바꼭질·주난의 난"
date: 2026-06-25 10:00:00 +0900
categories: ["알고리즘", "백준"]
tags: ["algorithm", "bfs", "graph"]
render_with_liquid: false
image: /assets/img/thumbs/baekjoon.svg
---

> 오늘은 BFS 한 우물만 깊게 팠다. **연결 요소(1926) → 다중 소스 최장거리(2589) → 1차원 BFS(1697) → 0-1 BFS·라운드 BFS(14497)** 순으로, 같은 큐 골격에서 "무엇을 누적하고 큐를 어떻게 쓰느냐"만 문제에 맞게 바꾸는 연습이었다.

공통 골격(`while(q) → front/pop → 4방향 확장`)은 그대로 두고, **세는 문제는 `cnt`, 거리 문제는 `dist`/`visited`, 가중치 0/1 문제는 0-1 BFS**로 가지를 친다는 감을 잡았다.

---

## 1. 그림 (백준 1926) — BFS 연결 요소

출처: <https://www.acmicpc.net/problem/1926>

n×m 격자에서 1이 상하좌우로 연결된 덩어리의 **개수**와 가장 넓은 **넓이**를 구한다.

```cpp
int bfs(int sy, int sx)   // 시작 칸이 속한 그림의 넓이(칸 수)를 반환
{
    queue<pair<int, int>> q;
    visited[sy][sx] = true;
    q.push({ sy,sx });
    int cnt = 1;                      // 시작 칸 포함

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
            if (visited[ny][nx] || a[ny][nx] == 0) continue;
            q.push({ ny, nx });
            visited[ny][nx] = true;
            cnt++;                     // 칸 수 세기
        }
    }
    return cnt;
}
```

- 메인에서 방문 안 한 1을 만날 때마다 `total++`, `bfs`가 돌려준 넓이로 `big` 갱신.
- **`visited`를 BFS 사이에 리셋하지 않는다** — 한 그림을 두 번 세지 않으려면 누적돼야 하기 때문.
- DFS(재귀)로도 풀리지만 250,000칸이 한 덩어리면 재귀 깊이로 **스택 오버플로** 위험 → 격자는 BFS가 안전.

## 2. 보물섬 (백준 2589) — 다중 소스 BFS·그래프 지름

출처: <https://www.acmicpc.net/problem/2589>

육지(L)끼리 상하좌우 이동, **두 육지 사이 최단거리 중 최댓값**(그래프 지름)을 구한다.

```cpp
int bfs(int sy, int sx)   // 시작점에서 도달 가능한 최대 거리
{
    memset(dist, -1, sizeof(dist));  // -1 = 미방문(무한대)
    queue<pair<int, int>> q;
    dist[sy][sx] = 0;
    q.push({ sy,sx });
    int big = 0;

    while (q.size())
    {
        int y = q.front().first, x = q.front().second;
        q.pop();
        for (int i = 0; i < 4; i++)
        {
            int ny = y + dy[i], nx = x + dx[i];
            if (ny < 0 || nx < 0 || ny >= n || nx >= m) continue;
            if (dist[ny][nx] != -1 || a[ny][nx] == 0) continue;
            dist[ny][nx] = dist[y][x] + 1;
            if (dist[ny][nx] > big) big = dist[ny][nx];
            q.push({ ny, nx });
        }
    }
    return big;
}
```

- **모든 육지 칸을 시작점으로 BFS** → 각 BFS의 최대 거리 중 전체 최댓값이 답.
- 1926과 달리 **매 호출마다 `memset`으로 거리표를 리셋**해야 한다 — 시작점이 바뀌면 거리가 전부 달라지기 때문(쓰레기값 제거가 아니라 직전 호출 흔적 지우기).
- `dist`가 **방문 표시(-1 여부)와 거리 기록**을 겸한다 → 별도 `visited` 불필요.

## 3. 숨바꼭질 (백준 1697) — 1차원 BFS

출처: <https://www.acmicpc.net/problem/1697>

위치 N에서 K까지 `X-1`, `X+1`, `2X` 이동으로 가는 최소 시간.

```cpp
queue<int> q;
visited[n] = 1;            // 시작을 1로 표시(거리 +1 인코딩)
q.push(n);

while (q.size())
{
    int now = q.front();
    q.pop();
    for (int next : { now + 1, now - 1, now * 2 })   // dy/dx 대신 후보 3개
    {
        if (next < 0 || next > 100000) continue;
        if (visited[next]) continue;
        q.push(next);
        visited[next] = visited[now] + 1;
    }
}
cout << visited[k] - 1 << endl;   // 인코딩한 1을 빼서 실제 거리
```

- 격자가 아니라 1차원이라 **`dy/dx` 배열 대신 범위 기반 `for (int x : {a,b,c})`** 가 깔끔.
- `visited`가 0이면 미방문인데 시작 거리도 0이라 충돌 → **시작을 1로 올리고 마지막에 -1**(+1 인코딩)로 해결.
- BFS는 가까운 칸부터 퍼지므로 처음 방문값이 곧 최단 시간.
- 전역 배열은 자동 0이고 BFS를 한 번만 부르니 `memset` 불필요. (지역 배열이라면 쓰레기값 때문에 초기화 필수)

## 4. 주난의 난 (백준 14497) — 0-1 BFS vs 큐 2개 라운드 BFS

출처: <https://www.acmicpc.net/problem/14497>

점프 한 번이 친구(1) **한 겹**을 쓰러뜨린다. 빈칸(0)은 같은 점프로 퍼지고 친구를 넘으면 점프 1번 소모 → **가중치 0/1 최단경로**. 두 가지 방식으로 풀었다.

### 방식 A — 0-1 BFS (덱 1개)

```cpp
deque<pair<int, int>> dq;
dist[sy][sx] = 0;
dq.push_front({ sy,sx });

while (dq.size())
{
    int y = dq.front().first, x = dq.front().second;
    dq.pop_front();
    for (int i = 0; i < 4; i++)
    {
        int ny = y + dy[i], nx = x + dx[i];
        if (ny < 0 || nx < 0 || ny >= n || nx >= m) continue;
        int w = a[ny][nx];                 // 빈칸 0, 친구/범인 1
        int nd = dist[y][x] + w;
        if (dist[ny][nx] == -1 || nd < dist[ny][nx])
        {
            dist[ny][nx] = nd;
            if (w == 0) dq.push_front({ ny,nx });   // 같은 점프
            else        dq.push_back({ ny,nx });    // 다음 점프
        }
    }
}
cout << dist[ty][tx] << endl;
```

- 가중치가 **0/1뿐이라** 우선순위 큐(다익스트라) 없이 덱으로: **비용 0 → `push_front`, 비용 1 → `push_back`**. 덱 앞이 늘 최소 비용.
- `#`(범인)도 사람이라 가중치 1 → 마지막 한 방(점프)이 답에 포함.
- INF를 `0x3f`로 두는 건 작위적이라 **`-1`을 "미방문=무한대"** 로 쓰고 `== -1` 가드로 비교.

### 방식 B — 큐 2개 라운드 BFS

```cpp
queue<pair<int, int>> q;
q.push({ sy,sx });
visited[sy][sx] = 1;

while (a[ey][ex] != '0')        // 범인 칸이 쓰러질 때까지
{
    queue<pair<int, int>> temp;
    cnt++;                      // 라운드(점프) 수
    while (q.size())
    {
        int y = q.front().first, x = q.front().second;
        q.pop();
        for (int i = 0; i < 4; i++)
        {
            int ny = y + dy[i], nx = x + dx[i];
            if (ny < 0 || nx < 0 || ny >= n || nx >= m || visited[ny][nx]) continue;
            visited[ny][nx] = cnt;
            if (a[ny][nx] != '0') { a[ny][nx] = '0'; temp.push({ ny,nx }); }  // 쓰러뜨려 다음 라운드
            else                    q.push({ ny,nx });                        // 빈칸은 같은 라운드
        }
    }
    q = temp;                   // 다음 겹으로 교체
}
cout << visited[ey][ex] << endl;
```

- **"점프 = 한 겹"을 그대로 표현**: `q`는 이번 라운드(빈칸 확산), `temp`는 친구를 쓰러뜨려 미루는 다음 라운드.
- `q`를 다 비우면 `cnt++` 하고 `q = temp` → 한 점프 진행. 범인 칸이 `'0'`이 되면 종료.
- 덱 버전(A)과 결과는 같지만, 큐 2개(B)가 문제의 "한 겹씩 쓰러뜨린다"는 의미와 더 직관적으로 맞는다.

---

## 오늘 배운 것 정리

1. **같은 BFS 골격, 다른 누적값** — `while(q)→front/pop→4방향`은 고정이고, 넓이는 `cnt`, 거리는 `dist`, 가중치는 0-1 BFS로 가지를 친다.
2. **그래프 지름은 다중 소스 BFS** — 모든 시작점에서 BFS를 돌려 최대 거리의 최댓값(2589). 이때 거리표를 매 호출 `memset`.
3. **`memset`은 "쓰레기값"이 아니라 "재호출 흔적" 때문** — 전역 배열은 자동 0이라 단일 호출이면 불필요. 다중 호출일 때만 필요.
4. **1D BFS의 확산은 범위 기반 for로** — `{x-1, x+1, 2x}`처럼 후보가 고정/소수면 `dy/dx` 배열보다 `for (int x : {…})`가 간결(1697).
5. **`visited` +1 인코딩으로 0 충돌 회피** — 시작 거리 0과 미방문 0이 겹칠 때 시작을 1로 올리고 마지막에 -1.
6. **0-1 BFS = 가중치 0/1 다익스트라의 덱 버전** — `push_front`(0)/`push_back`(1)으로 우선순위 큐 없이 O(V+E).
7. **큐 2개 라운드 BFS는 "레벨"을 직접 표현** — `q`(이번 겹)/`temp`(다음 겹)로 한 점프씩 진행, 목표가 쓰러지면 종료. 0-1 BFS와 등가지만 문제 의미에 더 가깝다.
8. **INF는 `-1`로** — `0x3f3f3f3f`는 작위적. `-1`을 미방문/무한대로 쓰고 `== -1` 가드로 비교하면 읽기 쉽다.
