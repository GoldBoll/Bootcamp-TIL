// 프로그래머스 87946 - 피로도 (Lv.5)
// https://school.programmers.co.kr/learn/courses/30/lessons/87946
// (같은 백트래킹 골격: 백준 18429 근손실 — 전체 순열 + 제약 미달 시 가지치기, int 반환 dfs)

// [스타일 절충] 프로그래머스는 solution 함수 제출 형식이라 cin으로 입력을 받지 않는다.
//              강사 스타일 cin 기반 main 대신, 예제를 담은 로컬 테스트 main을 아래에 분리했다.

// 문제 설명
// 현재 피로도 k 로 던전을 탐험한다. 던전마다 "최소 필요 피로도"와 "소모 피로도"가 있고,
// 현재 피로도가 최소 필요 피로도 이상일 때만 입장할 수 있으며 입장하면 소모 피로도가 깎인다.
// 각 던전은 한 번만 탐험할 수 있고 순서는 자유롭게 정할 수 있다.
// 최대 몇 개의 던전을 탐험할 수 있는지 반환하라.

// 제약 조건
// 1 <= k <= 5,000
// 1 <= dungeons 길이 <= 8, dungeons[i] = [최소 필요 피로도, 소모 피로도]
// 1 <= 최소 필요 피로도, 소모 피로도 <= 1,000
// 최소 필요 피로도 >= 소모 피로도

// Example
// Input : k = 80, dungeons = [[80, 20], [50, 40], [30, 10]]
// Output: 3        ([80,20] → [30,10] → [50,40] 순서면 80 → 60 → 50 → 10 으로 셋 다 통과)

// 접근 — 순서를 전부 만들어 보는 백트래킹 (완전탐색)
//
// [1단계 — 그리디가 왜 틀리나]
// "최소 필요 피로도가 큰 것부터" 같은 기준을 세우고 싶어지지만, 예제가 그대로 반례다.
// 그 기준이면 [80,20] → [50,40] 으로 80 → 60 → 20 이 되어 [30,10] 이 막혀 답이 2가 된다.
// "소모 피로도가 작은 것부터"도 [30,10] → [50,40] 순서에서 [80,20] 이 막혀 2가 된다.
// 남은 피로도가 다음 선택의 가능 범위를 바꾸는 구조라, 한 축의 정렬 기준으로 고정할 수 없다.
//
// [2단계 — 완전탐색으로 갈 수 있는 근거는 제약]
// 던전이 최대 8개니 모든 순서를 만들어도 8! = 40,320 가지. 판별법 로직도의 출발점인
// 브루트포스가 제약 안에서 그대로 통한다. 순서가 답을 바꾸므로 조합이 아니라 순열이다.
//
// [3단계 — visited 순열 백트래킹 + 제약 가지치기]
// N과 M (5)와 같은 골격: visited 로 이미 쓴 던전을 막고, 넣고 → 재귀 → 빼고를 대칭으로 둔다.
// 여기에 문제 제약을 가지치기로 얹는다 — k 가 최소 필요 피로도보다 작으면 그 가지는 버린다.
// 전체 순열을 다 만들고 나서 유효성을 검사하는 방식(next_permutation)보다 이쪽이
// 못 들어가는 순간 하위 순열 전체를 잘라내므로 실제 탐색량이 크게 줄어든다.
//
// [4단계 — "다 못 돌아도 답"이라 깊이 자체가 후보다]
// 8개를 모두 도는 것이 목표가 아니라 최대 개수를 구하는 문제다. 그래서 완성 지점에서만
// 값을 만드는 대신, 매 호출에서 int ret = depth 로 시작한다. 더 들어갈 던전이 없으면
// 그 깊이가 그대로 그 경로의 결과가 되고, 들어갈 수 있으면 자식의 결과와 max 를 취한다.
//
// 시간 O(n!) 최악 8! x n = 약 32만, 공간 O(n) (재귀 깊이 + visited)

#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;
#define endl '\n'

int n;
int visited[8];

int dfs(vector<vector<int>>& dungeons, int k, int depth)
{
    int ret = depth;

    for (int i = 0; i < n; i++)
    {
        if (visited[i]) continue;
        if (k < dungeons[i][0]) continue;

        visited[i] = 1;
        ret = max(ret, dfs(dungeons, k - dungeons[i][1], depth + 1));
        visited[i] = 0;
    }

    return ret;
}

int solution(int k, vector<vector<int>> dungeons)
{
    n = (int)dungeons.size();
    for (int i = 0; i < n; i++) visited[i] = 0;

    return dfs(dungeons, k, 0);
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    cout << solution(80, { {80, 20}, {50, 40}, {30, 10} }) << endl;

    cout << solution(1, { {10, 10} }) << endl;
    cout << solution(10, { {10, 10} }) << endl;
    cout << solution(80, { {80, 20}, {50, 40} }) << endl;
    cout << solution(5000, { {1000,1000},{1000,1000},{1000,1000},{1000,1000},
                             {1000,1000},{1000,1000},{1000,1000},{1000,1000} }) << endl;

    return 0;
}

// 코드 주석
// int n; int visited[8];             전역 선언 — 재귀 전반에서 공유. 던전 최대 8개라 크기 고정
// for (int i = 0; i < n; i++) visited[i] = 0;
//                                    solution 이 여러 번 호출되는 로컬 테스트를 위한 리셋
// int ret = depth;                   더 들어갈 던전이 없으면 지금 깊이가 그 경로의 결과가 된다
//                                    (모든 던전을 도는 게 목표가 아니므로 완성 지점이 따로 없다)
// if (visited[i]) continue;          같은 던전 재입장 금지 — 순열이므로 visited 로 막는다
// if (k < dungeons[i][0]) continue;  최소 필요 피로도 미달 → 이 가지의 하위 순열 전체를 잘라낸다
// visited[i] = 1; ... visited[i] = 0;
//                                    넣고 / 빼고 대칭. 피로도는 인수로 넘겨(k - 소모) 복원이 불필요
// ret = max(ret, dfs(...));          자식 경로들 중 최대 개수를 위로 올린다
