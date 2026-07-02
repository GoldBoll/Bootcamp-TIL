# 백준 2589. 보물섬

- 링크: https://www.acmicpc.net/problem/2589
- 풀이 코드: [exam1.cpp](./exam1.cpp)

## 1. 문제 재진술

L/W 격자에서 육지 두 칸을 골랐을 때의 최단거리 중, 가장 긴 값을 찾는 문제다. "최단거리들의 최댓값"이라는 게 포인트.

## 2. 처음 떠오른 생각

"가장 긴 시간이 걸리는 두 곳"이라는 문장만 보고 순간 최장 경로(가장 길게 걷는 길)를 떠올렸는데, 다시 읽으니 아니었다. 두 지점 사이는 어디까지나 **최단거리**로 이동하고, 그 최단거리가 가장 큰 **쌍**을 찾는 거다. 최장 경로였으면 일반 그래프에서 다항 시간에 못 푸는 문제라 뭔가 이상하다 싶었는데, 최단거리 최댓값이면 얘기가 완전히 달라진다.

그럼 브루트포스는 "모든 육지 쌍마다 최단거리 계산"인데, 어차피 BFS는 시작점 하나에서 **모든 칸까지의** 최단거리를 한 번에 준다. 쌍마다 돌 이유가 없고, 시작점마다 한 번씩만 돌면 된다.

## 3. 접근 결정

신호는 명확했다. **격자 + 이동 비용이 칸당 1 + 최단거리** → BFS. 다익스트라까지 갈 것도 없이 가중치가 전부 1이니 BFS로 충분하다. 다만 시작점이 정해져 있지 않으니 모든 육지를 시작점으로 BFS를 돌려야 한다. 비용을 계산해보면 육지 최대 2500칸 × BFS 한 번 O(2500) = 약 625만 연산. 1초 제한에 여유 있다.

## 4. 핵심 아이디어

모든 육지에서 BFS를 돌리고, 그때그때 나온 최단거리들의 전체 최댓값이 답.

## 5. 코드

```cpp
int n, m, ans;
string a[54];
int dist[54][54];
int dy[] = { -1, 1, 0, 0 };
int dx[] = { 0, 0, -1, 1 };

int bfs(int sy, int sx)
{
    memset(dist, 0, sizeof(dist));
    queue<pair<int, int>> q;
    dist[sy][sx] = 1;
    q.push({ sy, sx });
    int ret = 1;
    while (!q.empty()) {
        int y = q.front().first, x = q.front().second;
        q.pop();
        ret = max(ret, dist[y][x]);
        for (int i = 0; i < 4; i++) {
            int ny = y + dy[i], nx = x + dx[i];
            if (ny < 0 || ny >= n || nx < 0 || nx >= m) continue;
            if (a[ny][nx] != 'L' || dist[ny][nx]) continue;
            dist[ny][nx] = dist[y][x] + 1;
            q.push({ ny, nx });
        }
    }
    return ret - 1;
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    cin >> n >> m;
    for (int i = 0; i < n; i++) cin >> a[i];
    for (int i = 0; i < n; i++)
        for (int j = 0; j < m; j++)
            if (a[i][j] == 'L')
                ans = max(ans, bfs(i, j));
    cout << ans << endl;

    return 0;
}
```

## 6. 막힌 점·실수

- **미방문 0과 거리 0 충돌.** 시작점의 거리를 0으로 두면 "아직 안 간 칸"과 구분이 안 된다. 시작점을 1로 놓는 +1 인코딩으로 가고, 반환할 때 `ret - 1`로 되돌렸다. `dist[ny][nx]`가 0이 아니면 방문한 것으로 판정하는 게 한 줄로 끝나서 깔끔하다.
- **BFS를 여러 번 부르니 매 호출 memset 리셋.** 처음 한 번만 0이면 되는 게 아니라, 이전 시작점의 dist가 남아 있으면 다음 BFS에서 방문한 칸으로 오판한다. 시작점마다 부르는 구조라 함수 첫 줄에 memset을 박았다.
- 섬이 여러 개인 지도면 어떤 시작점에서는 도달 못 하는 육지가 생기는데, 그 칸은 dist가 0으로 남아서 최댓값 계산에 자연스럽게 안 잡힌다. 따로 처리할 게 없었다.

## 7. 복잡도

- **시간**: O((nm)²). 육지 칸 수만큼 BFS를 돌리고, BFS 한 번이 O(nm). 50×50 기준 최대 약 625만.
- **공간**: O(nm). dist 배열과 큐.
