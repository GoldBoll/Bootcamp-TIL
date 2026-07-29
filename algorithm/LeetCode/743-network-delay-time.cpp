// LeetCode 743 - Network Delay Time (Medium)
// https://leetcode.com/problems/network-delay-time/

// 문제 설명
// 1번부터 n번까지 노드가 있는 네트워크와 방향 간선 times[i] = (u, v, w)가 주어진다.
// (u에서 v로 신호가 가는 데 w의 시간이 걸린다)
// k번 노드에서 신호를 보낼 때 n개 노드 전부가 신호를 받는 최소 시간을 구한다.
// 못 받는 노드가 하나라도 있으면 -1.

// 제약 조건
// 1 <= k <= n <= 100
// 1 <= times.length <= 6000
// 1 <= u, v <= n, u != v
// 0 <= w <= 100   (가중치 0이 존재)
// (u, v) 쌍은 유일 — 다중 간선 없음

// 예제
// 입력                                          출력
// times = [[2,1,1],[2,3,1],[3,4,1]], n=4, k=2   2
// times = [[1,2,1]], n=2, k=1                   1
// times = [[1,2,1]], n=2, k=2                   -1   (2 -> 1 간선이 없어 1번이 못 받음)

// 접근
//
// [1단계 — 유형 판별]
// 최단거리인데 간선마다 가중치 w가 다르다 -> 1926·2589에서 쓰던 그냥 BFS는 못 쓴다.
// BFS는 "간선 하나 = 거리 1"일 때만 큐 순서가 곧 거리 순서라서 맞는 것이고,
// 여기선 간선 1개짜리 먼 길이 간선 3개짜리 가까운 길보다 늦을 수 있다.
// 가중치가 0/1뿐이면 14497처럼 0-1 BFS(deque)로 되지만, w는 0~100이라 일반 다익스트라로 간다.
//
// [2단계 — 큐를 우선순위 큐로 바꾼 BFS]
// 골격은 BFS와 같고 자료구조만 queue -> priority_queue(최소 힙)로 바뀐다.
// 큐에서 꺼내는 순서가 "먼저 넣은 순"에서 "누적 시간이 짧은 순"이 되면서 최단거리가 보장된다.
// 넣는 값도 좌표 하나가 아니라 {누적 시간, 노드} 쌍이다.
//
// [3단계 — INF 대신 -1, 꺼낼 때 확정]
// dist는 -1(미방문)로 시작한다. w가 0일 수 있어서 "거리 0"과 "미방문 0"이 겹치는데,
// -1을 미방문으로 쓰면 그 충돌이 없다. (0x3f3f3f3f 대신 -1을 쓰는 BFS 규칙 그대로)
// 힙에서 꺼낸 노드가 아직 -1이면 그 순간이 최단 확정 시점이라 dist에 기록하고,
// 이미 값이 있으면 뒤늦게 올라온 낡은 후보라 버린다(continue).
//
// [4단계 — 답은 최댓값]
// "전부가 받는 시간" = 가장 늦게 받는 노드의 시간이므로 dist의 최댓값.
// 하나라도 -1이면 도달 불가 -> -1을 반환한다.
//
// [복잡도] 간선 E=6000, 노드 N=100. O((N+E) log E).

// LeetCode는 class Solution 제출이라 강사님 전역 변수 골격과 100% 같지는 않다.
// 인접 리스트 v[]·dist[]는 강사 스타일대로 전역에 두되, 함수가 여러 번 호출되므로
// 진입 직후 리셋한다(2589처럼 BFS를 여러 번 부를 때 매 호출 초기화하는 규칙).
// 하단 main은 로컬 예제 검증용이라 제출 시 제외한다.

#include <iostream>
#include <vector>
#include <queue>
using namespace std;
#define endl '\n'

vector<pair<int, int>> v[104];
int dist[104];

class Solution {
public:
    int networkDelayTime(vector<vector<int>>& times, int n, int k)
    {
        for (int i = 1; i <= n; i++)
        {
            v[i].clear();
            dist[i] = -1;
        }

        for (auto& t : times)
            v[t[0]].push_back({ t[1], t[2] });

        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
        pq.push({ 0, k });

        while (pq.size())
        {
            int cost = pq.top().first;
            int here = pq.top().second;
            pq.pop();

            if (dist[here] != -1) continue;

            dist[here] = cost;

            for (auto& p : v[here])
                if (dist[p.first] == -1)
                    pq.push({ cost + p.second, p.first });
        }

        int ret = 0;

        for (int i = 1; i <= n; i++)
        {
            if (dist[i] == -1) return -1;
            if (dist[i] > ret) ret = dist[i];
        }

        return ret;
    }
};

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    Solution sol;

    vector<vector<int>> t1 = { {2,1,1},{2,3,1},{3,4,1} };
    vector<vector<int>> t2 = { {1,2,1} };
    vector<vector<int>> t3 = { {1,2,1} };

    cout << sol.networkDelayTime(t1, 4, 2) << endl;
    cout << sol.networkDelayTime(t2, 2, 1) << endl;
    cout << sol.networkDelayTime(t3, 2, 2) << endl;

    return 0;
}

// 코드 주석
// vector<pair<int,int>> v[104];      인접 리스트 (1-indexed). pair는 {도착 노드, 가중치}
// int dist[104];                     최단 시간표. -1 = 미방문(무한대) — w=0과 겹치지 않게 하는 장치
// v[i].clear(); dist[i] = -1;        여러 번 호출되는 함수라 매 호출 리셋 (2589 memset과 같은 이유)
// priority_queue<..., greater<>>     최소 힙. queue를 이 한 줄로 바꾼 게 BFS -> 다익스트라의 전부
// pq.push({ 0, k });                 {누적 시간, 노드} 순서 — 힙이 시간 기준으로 정렬되게 first에 시간
// if (dist[here] != -1) continue;    이미 확정된 노드면 낡은 후보 -> 버림 (visited 체크 자리)
// dist[here] = cost;                 힙에서 꺼낸 순간이 그 노드의 최단 확정 시점
// if (dist[p.first] == -1) pq.push(...)
//                                    확정 안 된 이웃만 후보로 넣는다
// int ret;                           전부가 받는 시간 = 가장 늦게 받는 노드의 시간(최댓값)
// if (dist[i] == -1) return -1;      한 노드라도 못 받으면 불가능
