# 백준 1926. 그림

- 링크: https://www.acmicpc.net/problem/1926
- 풀이 코드: [exam2.cpp](./exam2.cpp)

## 1. 문제 재진술

0/1 도화지에서 1이 상하좌우로 붙어 있는 덩어리를 그림 하나로 친다. 그림이 몇 개인지, 제일 큰 그림이 몇 칸인지 출력.

## 2. 처음 떠오른 생각

"1로 연결된 것을 한 그림", "대각선은 떨어진 것" — 문장 자체가 연결 요소(connected component) 정의라서 접근 자체는 바로 섰다. 고민한 건 알고리즘 선택이 아니라 **DFS 재귀로 가도 되는가**였다. 500×500이면 전부 1인 최악의 경우 재귀 깊이가 25만까지 갈 수 있다. 채점 환경 스택 사정에 따라 터질 수도 있는 깊이라, 재귀 대신 큐 기반 BFS로 갔다. 어차피 컴포넌트를 다 밟기만 하면 되는 문제라 DFS/BFS 어느 쪽이든 답은 같다.

## 3. 접근 결정

신호: **격자에서 연결된 덩어리 세기** → flood fill. 거리가 필요 없고 개수만 세면 되니까, BFS 규칙 중 "세는 문제는 칸마다 cnt++" 패턴이다. 대각선 제외 조건 그대로 4방향 dy/dx.

## 4. 핵심 아이디어

도화지를 훑다가 안 밟은 1을 만나면 그림 하나 발견(cnt++), BFS로 그 덩어리를 전부 밟으면서 칸 수를 세고 최댓값을 갱신.

## 5. 코드

```cpp
int n, m, cnt, mx;
int a[504][504];
bool visited[504][504];
int dy[] = { -1, 1, 0, 0 };
int dx[] = { 0, 0, -1, 1 };

int bfs(int sy, int sx)
{
    queue<pair<int, int>> q;
    visited[sy][sx] = true;
    q.push({ sy, sx });
    int c = 0;
    while (!q.empty()) {
        int y = q.front().first, x = q.front().second;
        q.pop();
        c++;
        for (int i = 0; i < 4; i++) {
            int ny = y + dy[i], nx = x + dx[i];
            if (ny < 0 || ny >= n || nx < 0 || nx >= m) continue;
            if (!a[ny][nx] || visited[ny][nx]) continue;
            visited[ny][nx] = true;
            q.push({ ny, nx });
        }
    }
    return c;
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    cin >> n >> m;
    for (int i = 0; i < n; i++)
        for (int j = 0; j < m; j++)
            cin >> a[i][j];
    for (int i = 0; i < n; i++)
        for (int j = 0; j < m; j++)
            if (a[i][j] && !visited[i][j]) {
                cnt++;
                mx = max(mx, bfs(i, j));
            }
    cout << cnt << endl << mx << endl;

    return 0;
}
```

## 6. 막힌 점·실수

- **그림이 하나도 없는 경우.** 문제에 "그림이 없으면 넓이는 0"이라고 명시돼 있는데, 전역 `cnt`, `mx`가 0으로 시작하니 BFS가 한 번도 안 불리면 그대로 0 0이 출력된다. 전역 0 초기화 덕에 공짜로 처리됐다.
- **visited 리셋이 필요 없는 경우 구분.** 보물섬(2589)은 시작점마다 dist를 새로 재니까 매번 memset이 필수였는데, 이 문제는 컴포넌트끼리 겹치지 않아서 visited를 한 번 칠한 건 영원히 유효하다. 전역 자동 0 한 번이면 끝. "BFS 여러 번 = 무조건 리셋"이 아니라, **같은 칸을 다시 계산해야 하는지**가 기준이라는 걸 두 문제를 나란히 풀면서 정리했다.
- 입력이 보물섬과 달리 `1 1 0 1 1`처럼 공백 구분이라 string이 아니라 int 배열로 받았다. 붙어 나오면 string, 띄어 나오면 int — 입력 형태부터 확인하는 습관.

## 7. 복잡도

- **시간**: O(nm). 모든 칸은 정확히 한 번 방문된다(visited가 재방문을 막음). 500×500 = 25만.
- **공간**: O(nm). a, visited 배열과 큐.
