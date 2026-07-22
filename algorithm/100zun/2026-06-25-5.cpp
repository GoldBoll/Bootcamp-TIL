// 백준 14497 - 주난의 난(難)
// https://www.acmicpc.net/problem/14497

// 문제 설명
// N x M 교실. 주난(*)이 점프하면 파동이 상하좌우로 퍼져 친구(1) "한 겹"을 쓰러뜨린다.
// 빈칸(0)으로는 같은 점프 안에서 계속 퍼지고, 친구를 넘으려면 점프 1번이 필요하다.
// 주난이 범인(#)에게 닿는 최소 점프 횟수를 구한다.

// 제약 조건
// 1 <= N, M <= 300
// 1 <= x1, x2 <= N (행), 1 <= y1, y2 <= M (열)
// 칸: 0 빈칸 / 1 친구 / * 주난 / # 범인

// 예제
// 입력                출력
// 5 7 / 3 4 1 2 ...    3
// 3 5 / 3 5 1 1 ...    2
// 3 3 / 2 2 1 1 ...    1

// 접근 - 0-1 BFS (덱)
// 빈칸으로 이동: 가중치 0 (같은 점프, 덱 앞에 push)
// 친구/범인 칸으로 이동: 가중치 1 (점프 1번 소모, 덱 뒤에 push)
// 시작에서 범인까지의 최소 가중치 합이 답.

// 코드 메모
// a[][]    : 1(친구) 또는 0(빈칸). '#'(범인)도 사람이라 1로 둠 -> 마지막 점프 1번 포함
// dist[][] : 최소 점프 횟수, -1(미방문=무한대)로 두고 더 작은 값 발견 시 갱신
// 입력 좌표는 1-base 행/열 -> 0-base로 내려서 사용

#include <iostream>
#include <string>
#include <deque>
#include <cstring>
using namespace std;
#define endl '\n'

int n, m;
int sy, sx, ty, tx;
int a[304][304];
int dist[304][304];

int dy[4] = { -1,0,1,0 };
int dx[4] = { 0,1,0,-1 };

int main()
{
	ios_base::sync_with_stdio(false);
	cin.tie(NULL);
	cout.tie(NULL);

	cin >> n >> m;
	cin >> sy >> sx >> ty >> tx;
	sy--; sx--; ty--; tx--;

	for (int i = 0; i < n; i++)
	{
		string s;
		cin >> s;
		for (int j = 0; j < m; j++)
		{
			if (s[j] == '1' || s[j] == '#') a[i][j] = 1;
			else a[i][j] = 0;
		}
	}

	memset(dist, -1, sizeof(dist));

	deque<pair<int, int>> dq;
	dist[sy][sx] = 0;
	dq.push_front({ sy,sx });

	while (dq.size())
	{
		int y = dq.front().first;
		int x = dq.front().second;
		dq.pop_front();

		for (int i = 0; i < 4; i++)
		{
			int ny = y + dy[i];
			int nx = x + dx[i];

			if (ny < 0 || nx < 0 || ny >= n || nx >= m) continue;

			int w = a[ny][nx];
			int nd = dist[y][x] + w;
			if (dist[ny][nx] == -1 || nd < dist[ny][nx])
			{
				dist[ny][nx] = nd;
				if (w == 0) dq.push_front({ ny,nx });
				else dq.push_back({ ny,nx });
			}
		}
	}

	cout << dist[ty][tx] << endl;

	return 0;
}
