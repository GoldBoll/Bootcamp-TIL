// LeetCode 994 - Rotting Oranges (Medium)
// https://leetcode.com/problems/rotting-oranges/

// 문제 설명
// m x n 격자에서 0은 빈칸, 1은 신선한 오렌지, 2는 썩은 오렌지다.
// 1분마다 썩은 오렌지와 상하좌우로 붙은 신선한 오렌지가 같이 썩는다.
// 신선한 오렌지가 하나도 남지 않을 때까지 걸리는 최소 분을 구한다.
// 끝까지 못 썩는 오렌지가 있으면 -1.

// 제약 조건
// m == grid.length, n == grid[i].length
// 1 <= m, n <= 10
// grid[i][j] 는 0, 1, 2 중 하나

// 예제
// 입력                                   출력
// [[2,1,1],[1,1,0],[0,1,1]]              4
// [[2,1,1],[0,1,1],[1,0,1]]              -1   (왼쪽 아래 (2,0)은 대각선으로만 닿아 영원히 안 썩음)
// [[0,2]]                                0    (신선한 오렌지가 처음부터 없음)

// 접근
//
// [1단계 — 유형 판별]
// "동시에 퍼지는 최소 시간" = 최단거리. 가중치가 전부 1이므로 BFS.
// 다만 출발점이 한 곳이 아니라 썩은 오렌지 전부다 -> 멀티소스 BFS.
//
// [2단계 — 멀티소스는 큐에 처음부터 다 넣는다]
// 1926 그림은 덩어리마다 bfs(i,j)를 따로 불렀지만, 여기서는 썩은 칸들이 "동시에" 퍼지므로
// 시작 칸을 전부 큐에 넣고 한 번만 돌린다. 큐 골격은 1926과 완전히 같고,
// 큐 초기화만 한 칸 -> 여러 칸으로 바뀐다. (같은 BFS 골격에서 시작 조건만 교체)
//
// [3단계 — visited +1 인코딩으로 분(minute) 누적]
// 시작 칸을 visited = 1로 두고 이웃은 visited[ny][nx] = visited[y][x] + 1.
// 미방문 0과 "0분"이 겹치지 않는다. 실제 경과 분은 visited - 1.
// 넓이를 세던 1926의 cnt++ 자리가 여기서는 dist 누적으로 바뀐 것뿐이다.
//
// [4단계 — 불가능 판정은 남은 개수로]
// 처음에 신선한 오렌지 수(fresh)를 세두고 썩힐 때마다 하나씩 깎는다.
// BFS가 끝났는데 fresh가 남아 있으면 도달 못 한 칸이 있다는 뜻 -> -1.
// 격자를 다시 훑을 필요가 없고, "신선한 게 처음부터 0개면 0" 예제도 자동으로 처리된다.
//
// [복잡도] 칸마다 한 번씩 큐에 들어가고 4방향만 보므로 O(m*n).

// LeetCode는 class Solution 제출이라 강사님 전역 변수 골격과 100% 같지는 않다.
// 격자 크기에 의존하는 visited는 함수 안 지역(vector)으로 두고, dy/dx·큐 골격·+1 인코딩 등
// 나머지 규칙은 그대로 적용했다. 하단 main은 로컬 예제 검증용이라 제출 시 제외한다.

#include <iostream>
#include <vector>
#include <queue>
using namespace std;
#define endl '\n'

int dy[4] = { -1,0,1,0 };
int dx[4] = { 0,1,0,-1 };

class Solution {
public:
    int orangesRotting(vector<vector<int>>& grid)
    {
        int n = grid.size();
        int m = grid[0].size();

        vector<vector<int>> visited(n, vector<int>(m, 0));
        queue<pair<int, int>> q;
        int fresh = 0;

        for (int i = 0; i < n; i++)
            for (int j = 0; j < m; j++)
            {
                if (grid[i][j] == 2)
                {
                    q.push({ i, j });
                    visited[i][j] = 1;
                }
                else if (grid[i][j] == 1) fresh++;
            }

        int ret = 0;

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
                if (visited[ny][nx] || grid[ny][nx] != 1) continue;

                visited[ny][nx] = visited[y][x] + 1;
                fresh--;

                if (visited[ny][nx] - 1 > ret) ret = visited[ny][nx] - 1;

                q.push({ ny, nx });
            }
        }

        if (fresh) return -1;

        return ret;
    }
};

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    Solution sol;

    vector<vector<int>> g1 = { {2,1,1},{1,1,0},{0,1,1} };
    vector<vector<int>> g2 = { {2,1,1},{0,1,1},{1,0,1} };
    vector<vector<int>> g3 = { {0,2} };

    cout << sol.orangesRotting(g1) << endl;
    cout << sol.orangesRotting(g2) << endl;
    cout << sol.orangesRotting(g3) << endl;

    return 0;
}

// 코드 주석
// int dy[4] / dx[4];                 2D 4방향 이동. 상하좌우만(대각선 없음)이라 예제 2가 -1이 된다
// visited(n, vector<int>(m, 0))      +1 인코딩 거리표. 0 = 미방문, 1 = 시작(0분), k = (k-1)분
// queue에 2를 전부 push             멀티소스 BFS — 썩은 칸이 여러 개여도 큐를 한 번만 돌린다
// int fresh;                         남은 신선한 오렌지 수. 썩힐 때마다 --, 끝나고 남으면 -1
// if (visited[ny][nx] || grid[ny][nx] != 1) continue;
//                                    방문했거나 신선한 오렌지가 아니면(0 또는 2) 건너뜀
// visited[ny][nx] = visited[y][x] + 1;
//                                    1926의 cnt++ 자리를 거리 누적으로 바꾼 부분. 골격은 동일
// ret = visited[ny][nx] - 1;         +1 인코딩을 실제 분으로 되돌린 값 중 최댓값이 답
// if (fresh) return -1;              큐가 마를 때까지 못 닿은 오렌지가 있으면 불가능
// visited는 지역 vector             함수가 여러 번 호출돼도 매번 새로 만들어져 memset이 필요 없다
