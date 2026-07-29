// LeetCode 547 - Number of Provinces (Medium)
// https://leetcode.com/problems/number-of-provinces/
// (같은 골격의 수업 문제: 백준 2606 바이러스 — 06-11 DFS / 백준 1926 그림 — 06-25 "덩어리 세기")

// [스타일 절충] LeetCode는 class Solution 제출 형식이라, 전역 선언(n/a/visited)과 dfs 함수는 클래스 위에 그대로 두고
//              강사 스타일 cin 기반 main은 클래스 아래 로컬 테스트용으로 분리했다 (제출 시 main만 제외).

// 문제 설명
// 도시 n개. isConnected[i][j] == 1 이면 i-j 가 직접 연결. 직접/간접으로 이어진 도시 묶음 하나가 "지역(province)".
// 지역의 총 개수를 구하라.

// 제약 조건
// 1 <= n <= 200, isConnected 는 n x n
// isConnected[i][i] == 1 (자기 자신 — 대각선은 항상 1)
// isConnected[i][j] == isConnected[j][i] (대칭 — 무방향 그래프)

// 예제
// 입력                                        출력   설명
// {{1,1,0},{1,1,0},{0,0,1}}                   2      {0,1} 과 {2}
// {{1,0,0},{0,1,0},{0,0,1}}                   3      전부 따로

// 로컬 테스트 입력 형식
// 첫 줄 n / 다음 n 줄에 n개씩 0/1

// 접근
//
// [1단계 — 유형 판별]
// "덩어리가 몇 개냐" = 연결 요소(connected component) 개수. 2606(한 덩어리의 크기) / 1926(덩어리 세기)과 같은 골격.
// 모든 정점에서 탐색을 시도하되, 이미 방문한 정점에서 시작한 탐색은 새 덩어리가 아니므로 세지 않는다.
//
// [2단계 — 인접 리스트를 안 만드는 이유]
// 입력이 이미 인접 행렬이고 n <= 200. 리스트로 변환해도 O(n^2)를 한 번 더 도는 것뿐이라 이득이 없다.
// 행렬을 그대로 두고 dfs 안에서 for (i = 0..n-1) if (a[here][i]) 로 이웃을 훑는다 → 전체 O(n^2) = 40,000.
//
// [3단계 — int 반환 DFS (07-09 습관: 세면 int 반환)]
// dfs 맨 앞에 if (visited[here]) return 0; 가드를 두면
//   이미 방문한 정점에서 시작 → 0 (새 지역 아님)
//   처음 밟는 정점에서 시작 → 덩어리 전체를 칠하고 1 (새 지역)
// 이 되어 main 쪽 판정문 없이 ret += dfs(i) 한 줄로 지역 수가 누적된다.
// 재귀 내부 호출의 반환값은 칠하기용이라 버린다 — 지역 수를 더하는 건 바깥 루프의 최상위 호출뿐.
//
// [4단계 — 대각선 함정]
// isConnected[i][i] == 1 이라 dfs(here)는 자기 자신도 이웃으로 본다.
// 하지만 진입 직후 visited[here] = 1 을 찍어두므로 재진입은 가드에서 return 0 으로 막힌다 (i == here 별도 처리 불필요).
//
// [트레이스 — 예제 1]
// dfs(0): 0 칠함 → 이웃 0(가드), 1 → dfs(1): 1 칠함 → 이웃 0(가드), 1(가드) → 복귀. 반환 1  ret=1
// dfs(1): 이미 방문 → 0                                                                   ret=1
// dfs(2): 2 칠함 → 이웃 2(가드)만. 반환 1                                                  ret=2
//
// [복잡도] 시간 O(n^2), 공간 O(n) (visited + 재귀 깊이 최대 n=200이라 스택 안전).

#include <iostream>
#include <vector>
using namespace std;
#define endl '\n'

int n;
vector<vector<int>> a;
int visited[204];

int dfs(int here)
{
    if (visited[here]) return 0;

    visited[here] = 1;
    for (int i = 0; i < n; i++)
        if (a[here][i])
            dfs(i);

    return 1;
}

class Solution {
public:
    int findCircleNum(vector<vector<int>>& isConnected)
    {
        n = (int)isConnected.size();
        a = isConnected;

        for (int i = 0; i < n; i++)
            visited[i] = 0;

        int ret = 0;
        for (int i = 0; i < n; i++)
            ret += dfs(i);

        return ret;
    }
};

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    int t;
    cin >> t;

    vector<vector<int>> isConnected(t, vector<int>(t));
    for (int i = 0; i < t; i++)
        for (int j = 0; j < t; j++)
            cin >> isConnected[i][j];

    Solution s;
    cout << s.findCircleNum(isConnected) << endl;
}

// 코드 주석
// int n; vector<vector<int>> a;  전역 선언 — dfs가 크기와 행렬을 인자 없이 공유하기 위해 (06-11 템플릿의 v[] 자리)
// int visited[204];              bool 대신 int (강사 스타일 — 0=미방문, 1=방문). n <= 200 이라 여유분 +4
// if (visited[here]) return 0;   가드 + "실패 지점은 return 0" 규칙. 이미 칠해진 덩어리는 새 지역이 아니다
// return 1;                      이 호출이 새 덩어리를 열었다는 뜻 — 07-09 "세면 int 반환" 습관
// if (a[here][i])                인접 행렬을 그대로 훑는다 (n <= 200이라 리스트 변환 불필요). i == here 는 위 가드가 처리
// ret += dfs(i);                 판정 if 없이 누적. 방문 끝난 정점에서 시작하면 0이 더해질 뿐
// n = (int)isConnected.size();   size_t -> int 캐스팅 (MSVC C4267 경고 제거). n <= 200 이라 손실 없음
// a = isConnected;               LeetCode 다중 케이스 대비 — 매 호출 행렬·visited·n 을 새로 세팅
// cin >> t;                      로컬 테스트용 입력 크기 (전역 n 은 findCircleNum 안에서 세팅되므로 이름을 분리)
