//https://school.programmers.co.kr/learn/courses/30/lessons/154538

#include <queue>
#include <cstring>

using namespace std;

int dist[1000001];          // 0 = 미방문, 그 외 = 연산 횟수 + 1

int solution(int x, int y, int n) {
    memset(dist, 0, sizeof(dist));      // 여러 번 호출돼도 이전 상태가 남지 않게

    queue<int> q;
    q.push(x);
    dist[x] = 1;                        // +1 인코딩: 미방문 0과 "0회 도달"을 구분

    while (!q.empty()) {
        int here = q.front(); q.pop();
        if (here == y) return dist[here] - 1;

        for (int next : { here + n, here * 2, here * 3 })
            if (next <= y && !dist[next]) {
                dist[next] = dist[here] + 1;
                q.push(next);
            }
    }
    return -1;
}
