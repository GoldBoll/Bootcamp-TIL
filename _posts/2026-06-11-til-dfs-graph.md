---
title: "[TIL] 2026-06-11 — 심화 알고리즘 그래프 탐색 DFS 패턴 4종 (백준 2606·1325·11724·2644)"
date: 2026-06-11 21:00:00 +0900
categories: ["TIL", "알고리즘"]
tags: ["til", "algorithm", "dfs", "bfs", "graph", "cpp"]
render_with_liquid: false
image: /assets/img/thumbs/til.svg
---

> 오늘은 **그래프 탐색 심화 알고리즘 수업**이었다. DFS의 기본 틀인 전역 인접 리스트 + visited 배열 패턴을 익히고, 문제 유형에 따라 반환값과 매개변수를 달리하는 세 가지 변형을 연습했다. 백준 2606(바이러스), 1325(효율적인 해킹), 11724(연결 요소의 개수), 2644(촌수계산) 네 문제를 통해 **void → int 반환 → bool + int& 참조** 순으로 DFS 구조를 확장해가는 흐름이었다. 단방향/양방향 그래프 구분과 visited 초기화 타이밍이 핵심 포인트였다.

## 오늘 한 일 요약

1. **DFS/BFS 기본 템플릿 암기** — 전역 `vector<int> v[]` + `bool visited[]`, DFS는 재귀, BFS는 `queue`.
2. **백준 2606 바이러스** — `int dfs()` 반환값 패턴으로 리팩토링. `dfs(1) - 1`로 1번 자신 제외.
3. **백준 1325 효율적인 해킹** — 단방향 그래프 + 모든 노드에서 DFS 실행, `fill`로 visited 매번 초기화, 최댓값 노드 추출.
4. **백준 11724 연결 요소의 개수** — 미방문 노드에서 DFS 시작 횟수 = 컴포넌트 수.
5. **백준 2644 촌수계산** — `bool dfs(int here, int depth, int& ret)` 패턴. 목표 도달 시 `true` 반환으로 즉시 종료.

---

## 1. DFS/BFS 기본 템플릿

전역 배열로 선언하는 것이 핵심이다. 재귀 호출 전반에서 공유되기 때문이다.

```cpp
vector<int> v[1004];   // 인접 리스트 (1-indexed)
bool visited[1004];
```

**DFS (재귀)**

```cpp
void dfs(int here)
{
    visited[here] = true;
    for (int i : v[here])
        if (!visited[i])
            dfs(i);
}
```

**BFS (큐)**

```cpp
void bfs(int start)
{
    queue<int> q;
    q.push(start);
    visited[start] = true;

    while (!q.empty())
    {
        int here = q.front(); q.pop();
        for (int i : v[here])
            if (!visited[i]) { visited[i] = true; q.push(i); }
    }
}
```

| 항목 | DFS | BFS |
|------|-----|-----|
| 구현 | 재귀 | `queue` |
| 탐색 방식 | 깊이 우선 | 너비 우선 |
| 최단 거리 | X | O (가중치 없는 그래프) |
| 주요 용도 | 연결 요소, 경로 탐색 | 최단 경로, 레벨 탐색 |

---

## 2. int 반환 DFS — 컴포넌트 크기 추출

`void` 대신 `int`를 반환하면 DFS 한 번으로 연결된 노드 수를 얻을 수 있다. 이를 활용하면 최댓값 추출이나 크기 비교가 자연스러워진다.

```cpp
int dfs(int here)
{
    visited[here] = true;
    int cnt = 1;                    // 자기 자신 포함
    for (int i : v[here])
        if (!visited[i])
            cnt += dfs(i);          // 하위 노드 수 누적
    return cnt;
}
```

**2606 바이러스** 적용: `dfs(1) - 1` (1번 자신 제외)

**1325 효율적인 해킹** 적용: 모든 노드에서 실행 후 최댓값 추적

```cpp
int ans = 0;
vector<int> result;
for (int i = 1; i <= n; i++)
{
    fill(visited + 1, visited + n + 1, false);  // 매번 초기화
    int cnt = dfs(i);
    if (cnt > ans)       { ans = cnt; result.clear(); result.push_back(i); }
    else if (cnt == ans) { result.push_back(i); }
}
```

`fill(visited + 1, visited + n + 1, false)` — visited[1]~visited[n]을 false로 초기화. 매 반복마다 새로 탐색해야 하므로 필수.

---

## 3. 단방향 vs 양방향 구분법

문제 문장에서 방향을 읽는다.

| 표현 | 방향 | 간선 추가 |
|------|------|-----------|
| "연결되어 있다", "쌍", "친구 관계" | 양방향 | `v[a].push_back(b); v[b].push_back(a);` |
| "A가 B를 신뢰", "A→B", "단방향 도로" | 단방향 | `v[b].push_back(a);` (역방향 저장) |

1325는 "A가 B를 신뢰 → B 해킹 시 A 감염"이므로, B에서 탐색을 시작해 A에 도달해야 한다. 그래서 입력 `A B`에 대해 `v[b].push_back(a)`로 역방향 저장한다.

---

## 4. bool + int& 참조 DFS — 경로 깊이 추출 (2644)

목표 노드까지의 거리(깊이)를 구해야 할 때 쓰는 패턴이다.

```cpp
bool dfs(int here, int depth, int& ret)
{
    visited[here] = true;

    if (here == e)          // 목표 도달
    {
        ret = depth;
        return true;        // 즉시 상위로 전파
    }

    for (int i : v[here])
    {
        if (!visited[i])
        {
            if (dfs(i, depth + 1, ret))
                return true;    // 하위에서 찾았으면 더 탐색 불필요
        }
    }

    return false;
}

int main()
{
    int ret = -1;
    if (dfs(s, 0, ret)) cout << ret;
    else                 cout << -1;
}
```

- `int& ret` — 참조로 넘겨 DFS 내부에서 답을 저장, 반환값을 bool로 남긴다
- `bool` 반환 — `true`가 위로 전파되면서 불필요한 탐색을 즉시 중단
- `ret = -1` 초기화 — 연결되지 않으면 그대로 -1 출력

---

## 오늘 배운 것 정리

1. **DFS 기본 틀은 전역 인접 리스트 + visited 배열이다.** 배열 크기는 제한 + 4 여유분(1-indexed 접근 시 크기 101 이상 필요).
2. **int 반환 DFS는 컴포넌트 크기를 한 번에 얻는다.** `cnt = 1`로 시작해 재귀 결과를 누적, 반환값으로 최댓값 비교나 컴포넌트 크기 계산이 가능하다.
3. **단방향/양방향은 문장에서 읽는다.** "연결"은 양방향, "A가 B를"처럼 방향이 명시되면 단방향. 1325처럼 역방향 저장이 필요한 경우도 있다.
4. **bool + int& 패턴은 목표를 찾는 순간 탐색을 끊는다.** 깊이나 경로값을 참조로 전달하고 bool 반환으로 조기 종료를 전파한다. 연결 불가 케이스는 초기값(-1)으로 처리.
5. **1325처럼 모든 노드에서 DFS를 반복할 때는 visited를 매번 초기화해야 한다.** `fill(visited + 1, visited + n + 1, false)`로 범위를 명확히 지정.

> **오늘 배운 것** — DFS의 뼈대는 전역 인접 리스트 + visited 하나지만, 문제가 요구하는 답에 따라 반환형이 달라진다. 개수를 세면 int 반환, 목표까지의 깊이를 찾으면 bool + int& 참조로 조기 종료. 단방향/양방향은 코드가 아니라 문제 문장("연결" vs "A가 B를")에서 읽는다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "DFS와 BFS는 각각 언제 씁니까?" → 연결 요소·경로 존재는 DFS, 가중치 없는 최단 거리는 BFS, visited 배열 공유, 재귀 vs 큐, 방향성 판별
{: .prompt-info }
