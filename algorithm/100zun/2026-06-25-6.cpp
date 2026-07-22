// 백준 14497 - 주난의 난(難)  [큐 2개 / 라운드 BFS · 튜터님 코드]
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

// 접근 - 큐 2개로 라운드(점프) 진행
// q    : 이번 라운드(점프)에 퍼질 칸. 빈칸(0)은 같은 점프라 q에 다시 넣어 계속 확산.
// temp : 친구/범인(!= '0')을 만나면 쓰러뜨려('0'으로) 다음 라운드로 넘김.
// q를 다 비우면 cnt(점프 수)를 올리고 q = temp 로 교체. 목표 칸이 '0'이 되면 끝.
// visited에 각 칸을 처음 밟은 라운드 번호를 기록 -> 답은 visited[목표].

// 코드 메모
// a[][]       : 지도 문자 그대로. 친구/범인을 쓰러뜨리면 '0'으로 바꿈
// visited[][] : 그 칸을 처음 밟은 라운드(점프 수). 0이면 미방문
// cnt         : 현재 라운드(점프) 수
// 좌표는 1-base 행/열 -> 0-base로 내려서 사용

#include <iostream>
#include <queue>
using namespace std;
#define endl '\n'

int n, m;
int sy, sx, ey, ex, cnt;

int dy[4] = { -1,0,1,0 };
int dx[4] = { 0,1,0,-1 };

char a[304][304];
int visited[304][304];

int main()
{
	ios_base::sync_with_stdio(false);
	cin.tie(NULL);
	cout.tie(NULL);

	cin >> n >> m;
	cin >> sy >> sx >> ey >> ex;
	sy--; sx--; ey--; ex--;

	for (int i = 0; i < n; i++)
		for (int j = 0; j < m; j++)
			cin >> a[i][j];

	queue<pair<int, int>> q;
	q.push({ sy,sx });
	visited[sy][sx] = 1;

	while (a[ey][ex] != '0')
	{
		queue<pair<int, int>> temp;
		cnt++;

		while (q.size())
		{
			int y = q.front().first;
			int x = q.front().second;
			q.pop();

			for (int i = 0; i < 4; i++)
			{
				int ny = y + dy[i];
				int nx = x + dx[i];

				if (ny < 0 || nx < 0 || ny >= n || nx >= m || visited[ny][nx]) continue;

				visited[ny][nx] = cnt;

				if (a[ny][nx] != '0')
				{
					a[ny][nx] = '0';
					temp.push({ ny,nx });
				}
				else
				{
					q.push({ ny,nx });
				}
			}
		}

		q = temp;
	}

	cout << visited[ey][ex] << endl;

	return 0;
}
