// LeetCode 787 - Cheapest Flights Within K Stops (Medium)
// https://leetcode.com/problems/cheapest-flights-within-k-stops/

// 문제 설명
// n개 도시와 항공편 flights[i] = [from, to, price]가 주어진다.
// src에서 dst까지 "경유 k번 이하"로 갈 때의 최소 비용을 구한다.
// 그런 경로가 없으면 -1.

// 제약 조건
// 2 <= n <= 100
// 0 <= flights.length <= n * (n - 1) / 2
// 0 <= from, to < n, from != to
// 1 <= price <= 10^4
// 0 <= src, dst, k < n, src != dst

// 예제
// 입력                                                                    출력
// n=4, [[0,1,100],[1,2,100],[2,0,100],[1,3,600],[2,3,200]], 0->3, k=1     700
//      (0-1-2-3 이 400으로 더 싸지만 경유 2번이라 실격, 0-1-3 = 700)
// n=3, [[0,1,100],[1,2,100],[0,2,500]], 0->2, k=1                         200
// n=3, [[0,1,100],[1,2,100],[0,2,500]], 0->2, k=0                         500

// 접근
//
// [1단계 — 왜 다익스트라(743)를 그대로 못 쓰나]
// 743처럼 최소 힙으로 풀면 "도시에 처음 도착한 비용이 최단"이라고 확정해버린다.
// 그런데 여기선 싸게 왔지만 경유를 많이 쓴 경로가 나중에 막힐 수 있다.
// 예제 1이 정확히 그 함정이다 — 도시 2에 200(경유 1회)으로 도착한 게 더 싸지만,
// 거기서 3으로 더 가면 경유 2회가 되어 실격. 비싼 쪽(0-1-3)이 답이 된다.
// 즉 상태가 "도시"만이 아니라 (도시, 사용한 경유 수)라서 비용만으로 확정하면 안 된다.
//
// [2단계 — 라운드 수로 경유를 제한한다 = 벨만-포드]
// 경유 k번 이하 = 비행기를 최대 k+1번 탄다.
// 그러면 "간선을 정확히 r번 이하 쓴 최소 비용"을 r = 1..k+1 라운드로 올려가며 갱신하면 끝이다.
// 14497의 라운드 BFS(큐 2개로 점프 단위를 끊던 것)와 같은 발상 — 퍼지는 횟수를 세는 게 목적이라
// 한 라운드에서 퍼진 결과가 같은 라운드 안에서 또 퍼지지 않게 막는 게 핵심이다.
//
// [3단계 — prev 스냅샷이 이 문제의 전부]
// 라운드마다 갱신 직전의 dist를 prev로 복사해두고, 갱신은 prev만 보고 한다.
// 이게 없으면 같은 라운드에서 방금 갱신된 값이 연쇄로 또 갱신되어(0->1->2가 한 라운드에)
// 비행기를 k+1번보다 많이 탄 경로가 슬쩍 섞인다. 라운드 BFS에서 temp 큐를 따로 두는 것과 같은 이유.
//
// [4단계 — INF는 -1]
// 미방문/도달 불가를 -1로 둔다(BFS 규칙 그대로). prev[from]이 -1이면 아직 못 간 도시라 건너뛰고,
// 목적지가 끝까지 -1이면 그대로 답이 -1이 된다 — 별도 판정 코드가 필요 없다.
//
// [복잡도] 라운드 (k+1) * 간선 E. n <= 100, E <= 4950, k < 100 이므로 넉넉하다.

// LeetCode는 class Solution 제출이라 강사님 전역 변수 골격과 100% 같지는 않다.
// dist/prev는 n에 맞춰 매번 새로 잡아야 해서 함수 안 지역 vector로 뒀고,
// -1 INF 인코딩·범위 기반 for·의도 주석 등 나머지 규칙은 그대로 적용했다.
// 하단 main은 로컬 예제 검증용이라 제출 시 제외한다.

#include <iostream>
#include <vector>
using namespace std;
#define endl '\n'

class Solution {
public:
    int findCheapestPrice(int n, vector<vector<int>>& flights, int src, int dst, int k)
    {
        vector<int> dist(n, -1);
        dist[src] = 0;

        for (int r = 0; r <= k; r++)
        {
            vector<int> prev = dist;

            for (auto& f : flights)
            {
                if (prev[f[0]] == -1) continue;

                int cost = prev[f[0]] + f[2];

                if (dist[f[1]] == -1 || cost < dist[f[1]]) dist[f[1]] = cost;
            }
        }

        return dist[dst];
    }
};

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    Solution sol;

    vector<vector<int>> f1 = { {0,1,100},{1,2,100},{2,0,100},{1,3,600},{2,3,200} };
    vector<vector<int>> f2 = { {0,1,100},{1,2,100},{0,2,500} };
    vector<vector<int>> f3 = { {0,1,100},{1,2,100},{0,2,500} };

    cout << sol.findCheapestPrice(4, f1, 0, 3, 1) << endl;
    cout << sol.findCheapestPrice(3, f2, 0, 2, 1) << endl;
    cout << sol.findCheapestPrice(3, f3, 0, 2, 0) << endl;

    return 0;
}

// 코드 주석
// vector<int> dist(n, -1);           도시별 최소 비용. -1 = 아직 못 감(무한대)
// dist[src] = 0;                     출발지만 0으로 시작
// for (int r = 0; r <= k; r++)       라운드 k+1번 = 비행기 최대 k+1번 = 경유 k번 이하
// vector<int> prev = dist;           갱신 직전 스냅샷. 이번 라운드 갱신은 prev만 보고 한다
//                                    (없으면 한 라운드에 연쇄 갱신되어 경유 제한이 깨진다)
// if (prev[f[0]] == -1) continue;    아직 도달 못 한 도시에서 출발하는 항공편은 건너뜀
// int cost = prev[f[0]] + f[2];      f = {from, to, price} — 이전 라운드 비용 + 항공료
// if (dist[f[1]] == -1 || cost < dist[f[1]])
//                                    미방문이거나 더 싸면 갱신. -1 가드가 INF 비교를 대신한다
// return dist[dst];                  끝까지 -1이면 경로 없음 — 그대로 반환하면 답이 된다
