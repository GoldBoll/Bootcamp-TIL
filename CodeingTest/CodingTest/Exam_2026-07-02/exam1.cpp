// 백준 2589 - 보물섬
// https://www.acmicpc.net/problem/2589

// 문제 설명
// L(육지)/W(바다) 지도, 상하좌우 이동에 1시간.
// 두 육지 사이 최단거리 중 가장 긴 값을 출력.

// 제약 조건
// 가로, 세로 각각 50 이하

// 예제
// 입력                출력
// 5 7                 8
// WLLWWWL
// LLLWLLL
// LWLWLWW
// LWLWLLL
// WLLWLWW

// 접근
// 모든 육지에서 BFS, 나온 최단거리의 전체 최댓값
// dist +1 인코딩(시작=1), 호출마다 memset 리셋

#include <iostream>
#include <string>
#include <map>
#include <vector>
#include <queue>
#include <deque>
#include <cstring>
#include <algorithm>
using namespace std;
#define endl '\n'

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
