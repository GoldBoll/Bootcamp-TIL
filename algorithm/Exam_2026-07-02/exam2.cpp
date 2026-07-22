// 백준 1926 - 그림
// https://www.acmicpc.net/problem/1926

// 문제 설명
// 0/1 도화지에서 1이 상하좌우로 연결된 덩어리가 그림.
// 그림의 개수와 가장 넓은 그림의 넓이(1의 개수)를 출력.

// 제약 조건
// 1 <= n, m <= 500. 그림이 없으면 넓이는 0.

// 예제
// 입력                출력
// 6 5                 4
// 1 1 0 1 1           9
// 0 1 1 0 0
// 0 0 0 0 0
// 1 0 1 1 1
// 0 0 1 1 1
// 0 0 1 1 1

// 접근
// 안 밟은 1을 만날 때마다 cnt++, BFS로 덩어리 크기를 세서 최댓값 갱신
// 컴포넌트끼리 안 겹치므로 visited 리셋 불필요(전역 자동 0)

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
