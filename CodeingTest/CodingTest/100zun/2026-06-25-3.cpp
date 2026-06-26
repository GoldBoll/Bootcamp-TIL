// 백준 2589 - 보물섬
// https://www.acmicpc.net/problem/2589

// 문제 설명
// n x m 지도에서 육지(L)끼리 상하좌우로만 이동, 한 칸당 1시간.
// 두 육지 칸 사이 "최단 거리" 중 가장 긴 값을 출력한다 (그래프 지름).

// 제약 조건
// 1 <= n, m <= 50
// 각 칸은 L(육지) 또는 W(바다), 행은 공백 없이 붙어서 입력

// 예제
// 입력            출력
// 5 7             8
// WLLWWWL
// LLLWLLL
// LWLWLWW
// LWLWLLL
// WLLWLWW

// 접근
// 모든 육지 칸을 시작점으로 BFS를 한 번씩 돌려, 그 시작점에서
// 가장 멀리 떨어진 육지까지의 거리를 구한다. 전체 BFS 중 최댓값이 답.
// 육지 칸 수 <= 2500, BFS 한 번 O(n*m) -> O((n*m)^2) 여유

// 코드 메모
// a[][]       : 지도 문자 그대로 ('L' 육지 / 'W' 바다)
// visited[][] : 시작점에서의 거리를 저장 (0 = 미방문, 시작 칸은 1로 표시)
//               -> 거리를 +1 인코딩한 셈이라 실제 거리는 값 - 1
// cnt         : 한 BFS에서 visited 최댓값(= 가장 먼 칸의 인코딩 거리)
// bfs(sy,sx)  : 시작점에서 가장 먼 거리(cnt - 1)를 반환
// ans         : 보물 두 곳 사이 최단 거리의 최댓값

#include <iostream>
#include <string>
#include <queue>
#include <algorithm>
#include <cstring>
using namespace std;
#define endl '\n'

int n, m;
char a[54][54];
int visited[54][54];

int dy[4] = { -1,0,1,0 };
int dx[4] = { 0,1,0,-1 };

int bfs(int sy, int sx)
{
	memset(visited, 0, sizeof(visited));

	queue<pair<int, int>> q;
	q.push({ sy,sx });
	visited[sy][sx] = 1;

	int cnt = 1;

	while (q.size())
	{
		int y = q.front().first;
		int x = q.front().second;

		q.pop();

		for (int i = 0; i < 4; i++)
		{
			int ny = y + dy[i];
			int nx = x + dx[i];

			if (0 > ny || 0 > nx || ny >= n || nx >= m) continue;
			if (visited[ny][nx] || a[ny][nx] == 'W') continue;

			q.push({ ny,nx });
			visited[ny][nx] = visited[y][x] + 1;

			cnt = max(visited[ny][nx], cnt);
		}
	}

	return cnt - 1;
}

int main()
{
	ios_base::sync_with_stdio(false);
	cin.tie(NULL);
	cout.tie(NULL);

	cin >> n >> m;
	for (int i = 0; i < n; i++)
	{
		string s;
		cin >> s;
		for (int j = 0; j < m; j++)
			a[i][j] = s[j];
	}

	int ans = 0;
	for (int i = 0; i < n; i++)
		for (int j = 0; j < m; j++)
			if (a[i][j] == 'L')
			{
				int d = bfs(i, j);
				if (d > ans) ans = d;
			}

	cout << ans << endl;

	return 0;
}
