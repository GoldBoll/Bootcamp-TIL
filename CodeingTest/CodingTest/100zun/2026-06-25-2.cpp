// 백준 1926 - 그림
// https://www.acmicpc.net/problem/1926

// 문제 설명
// n x m 도화지에서 1로 상하좌우 연결된 덩어리가 하나의 "그림"이다 (대각선은 끊김).
// 그림의 개수와, 그 중 가장 넓은 그림의 넓이(포함된 1의 개수)를 출력한다.
// 그림이 하나도 없으면 넓이는 0.

// 제약 조건
// 1 <= n, m <= 500
// 칸은 0(빈칸) 또는 1(색칠)

// 예제
// 입력            출력
// 6 5             4
// 1 1 0 1 1       9
// 0 1 1 0 0
// 0 0 0 0 0
// 1 0 1 1 1
// 0 0 1 1 1
// 0 0 1 1 1

// 접근
// 방문 안 한 1을 만나면 거기서 BFS로 덩어리를 전부 칠한다.
// BFS 한 번이 그림 하나 -> 개수 +1, 그 BFS가 센 칸 수가 그 그림의 넓이.
// 모든 그림 중 최댓값을 갱신. 시간 O(n*m)

#include <iostream>
#include <queue>
using namespace std;
#define endl '\n'

int n, m;
int a[504][504];
int visited[504][504];

int dy[4] = { -1,0,1,0 };
int dx[4] = { 0,1,0,-1 };

// (sy, sx)에서 시작한 그림의 넓이(1의 개수)를 반환
int bfs(int sy, int sx)
{
	queue<pair<int, int>> q;
	visited[sy][sx] = true;
	q.push({ sy,sx });

	int cnt = 1;	// 시작 칸 포함

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
			cnt++;
		}
	}

	return cnt;
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

	int total = 0;	// 그림 개수
	int big = 0;	// 가장 넓은 그림의 넓이

	for (int i = 0; i < n; i++)
		for (int j = 0; j < m; j++)
			if (a[i][j] == 1 && !visited[i][j])
			{
				total++;
				int area = bfs(i, j);
				if (area > big) big = area;
			}

	cout << total << endl;
	cout << big << endl;

	return 0;
}
