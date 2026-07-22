// 백준 1697 - 숨바꼭질
// https://www.acmicpc.net/problem/1697

// 문제 설명
// 수빈이는 위치 N, 동생은 위치 K. 1초에 X-1, X+1, 2*X 중 하나로 이동.
// N에서 K까지 가는 가장 빠른 시간(초)을 구한다.

// 제약 조건
// 0 <= N, K <= 100,000

// 예제
// 입력      출력
// 5 17      4
// (5 -> 10 -> 9 -> 18 -> 17, 4초)

// 접근
// 위치를 정점, 세 가지 이동을 간선으로 보는 1차원 BFS.
// N에서 출발해 한 겹씩 퍼지므로 K에 처음 닿는 순간이 최소 시간.
// 위치 범위 0~100000, 2*X가 넘어가는(>100000) 칸은 갈 필요 없어 버림.

// 코드 메모
// visited[] : N에서의 거리 저장 (0 = 미방문, 시작 칸은 1로 표시 -> 실제 거리는 값 - 1)
//             전역이라 자동 0, BFS 한 번뿐이라 memset 불필요
// next      : 현재 now에서 갈 수 있는 세 위치 {now-1, now+1, now*2}를 그 자리에서 순회
// 답        : visited[K] - 1 (K는 항상 도달 가능)

#include <iostream>
#include <queue>
using namespace std;
#define endl '\n'

int n, k;
int visited[100004];

int main()
{
	ios_base::sync_with_stdio(false);
	cin.tie(NULL);
	cout.tie(NULL);

	cin >> n >> k;

	queue<int> q;
	visited[n] = 1;
	q.push(n);

	while (q.size())
	{
		int now = q.front();
		q.pop();

		for (int next : { now + 1, now - 1, now * 2 })
		{
			if (next < 0 || next > 100000) continue;
			if (visited[next]) continue;

			q.push(next);
			visited[next] = visited[now] + 1;
		}
	}

	cout << visited[k] - 1 << endl;

	return 0;
}
