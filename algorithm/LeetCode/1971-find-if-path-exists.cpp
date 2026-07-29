// LeetCode 1971 - Find if Path Exists in Graph (Easy)
// https://leetcode.com/problems/find-if-path-exists-in-graph/
// (같은 골격의 수업 문제: 백준 2606 바이러스 — 06-11 DFS 4종 / 100zun/2026-06-11-1.cpp)

// [스타일 절충] LeetCode는 class Solution 제출 형식이라, 전역 선언(v/visited)은 클래스 위에 그대로 두고
//              강사 스타일 cin 기반 main은 클래스 아래 로컬 테스트용으로 분리했다 (제출 시 main만 제외).

// 문제 설명
// 정점 0 ~ n-1 의 무방향 그래프. edges[i] = {u, v} 는 u-v 양방향 간선.
// source 에서 destination 으로 가는 경로가 존재하면 true, 없으면 false.

// 제약 조건
// 1 <= n <= 200,000, 0 <= edges.length <= 200,000
// 중복 간선 없음, 자기 루프 없음, 0 <= source, destination <= n - 1

// 예제
// 입력                                                              출력
// n=3, edges={{0,1},{1,2},{2,0}}, source=0, destination=2           true    (0->1->2, 0->2)
// n=6, edges={{0,1},{0,2},{3,5},{5,4},{4,3}}, source=0, dest=5      false   (0쪽 덩어리와 3-4-5 덩어리가 분리)

// 로컬 테스트 입력 형식
// 첫 줄 n m / 다음 m 줄 u v / 마지막 줄 source destination

// 접근
//
// [1단계 — 유형 판별]
// "닿느냐"만 묻는 무가중치 도달성 문제. 최단거리를 안 물으므로 DFS/BFS 어느 쪽이든 답은 같다.
// 인접 리스트 + 탐색 = 2606 바이러스와 완전히 같은 골격.
//
// [2단계 — 재귀 DFS를 못 쓰는 이유 (수업 문제와 갈리는 지점)]
// 2606은 N <= 100이라 재귀 DFS로 충분했지만 여기는 n이 200,000.
// 0-1-2-...-199999 일자 그래프가 입력으로 들어오면 재귀 깊이 20만 → 스택 오버플로.
// (실측: 2606식 재귀 dfs를 이 입력에 그대로 돌리면 MSVC x64 기본 스택 1MB에서
//  종료 코드 0xC00000FD = STATUS_STACK_OVERFLOW 로 죽는다. 같은 입력을 아래 BFS는 통과.)
// 그래서 같은 인접 리스트 위에 06-25에서 굳힌 BFS 큐 골격을 얹는다 (반복문이라 깊이와 무관).
//
// [3단계 — 조기 종료 2개]
// source == destination 이면 간선을 볼 것도 없이 true. n=1 / edges 빈 입력(제약상 가능)이 이 가지로 처리된다.
// 탐색 중 destination 을 만나면 큐를 더 돌 이유가 없으니 그 자리에서 true.
//
// [4단계 — 전역 배열 재사용 함정]
// LeetCode는 한 프로세스에서 여러 테스트케이스를 연달아 돌린다.
// 전역 v / visited 가 이전 케이스 값을 들고 있으면 없는 간선이 살아남아 오답 → 매 호출 앞에서 0 ~ n-1 초기화.
//
// [트레이스 — 예제 2]
// v[0]={1,2} v[1]={0} v[2]={0} v[3]={5,4} v[4]={5,3} v[5]={3,4}
// q=[0] → 0에서 1,2 방문 → q=[1,2] → 1,2의 이웃은 모두 방문 완료 → 큐 소진 → false
//
// [복잡도] 시간 O(n + E), 공간 O(n + E). n, E 모두 2*10^5 이라 넉넉히 통과.

#include <iostream>
#include <vector>
#include <queue>
using namespace std;
#define endl '\n'

vector<int> v[200004];
int visited[200004];

class Solution {
public:
    bool validPath(int n, vector<vector<int>>& edges, int source, int destination)
    {
        for (int i = 0; i < n; i++)
        {
            v[i].clear();
            visited[i] = 0;
        }

        for (auto e : edges)
        {
            v[e[0]].push_back(e[1]);
            v[e[1]].push_back(e[0]);
        }

        if (source == destination) return true;

        queue<int> q;
        q.push(source);
        visited[source] = 1;

        while (!q.empty())
        {
            int here = q.front(); q.pop();
            for (int i : v[here])
            {
                if (!visited[i])
                {
                    if (i == destination) return true;
                    visited[i] = 1;
                    q.push(i);
                }
            }
        }

        return false;
    }
};

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    int n, m, source, destination;
    cin >> n >> m;

    vector<vector<int>> edges;
    while (m--)
    {
        int a, b;
        cin >> a >> b;
        edges.push_back({ a, b });
    }
    cin >> source >> destination;

    Solution s;
    cout << (s.validPath(n, edges, source, destination) ? "true" : "false") << endl;
}

// 코드 주석
// vector<int> v[200004];         인접 리스트 전역 선언 (06-11 템플릿). 무방향이라 양쪽에 push_back
// int visited[200004];           bool 대신 int (강사 스타일 — 0=미방문, 1=방문)
// v[i].clear(); visited[i] = 0;  LeetCode 다중 케이스 대비 초기화. 0 ~ n-1 만 돌면 충분 (그 위는 안 씀)
// if (source == destination)     자기 자신은 항상 도달 가능. n=1 / 간선 0개 입력을 여기서 방어
// while (!q.empty())             06-25 BFS 큐 골격 그대로 — 재귀가 아니라 깊이 20만에도 스택이 안 터진다
// int here = q.front(); q.pop(); 꺼낸 노드 이름은 here (튜터 컨벤션)
// if (i == destination)          큐에 넣기 전에 도착 판정 — 남은 정점을 더 훑지 않고 즉시 종료
// for (int i : v[here])          범위 기반 for (인덱스 불필요)
