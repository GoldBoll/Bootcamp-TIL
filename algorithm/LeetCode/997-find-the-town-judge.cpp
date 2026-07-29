// LeetCode 997 - Find the Town Judge (Easy)
// https://leetcode.com/problems/find-the-town-judge/
// (같은 골격의 수업 문제: 백준 7785 회사에 있는 사람 — 06-04 자료구조 / "존재 여부를 배열 하나에 눌러 담기")

// [스타일 절충] LeetCode는 class Solution 제출 형식이라, 전역 선언(cnt)은 클래스 위에 그대로 두고
//              강사 스타일 cin 기반 main은 클래스 아래 로컬 테스트용으로 분리했다 (제출 시 main만 제외).

// 문제 설명
// 1 ~ n 번 사람. 마을 재판관은 (1) 아무도 안 믿고 (2) 자기 빼고 전원이 그를 믿고 (3) 그런 사람이 정확히 한 명.
// trust[i] = {a, b} 는 "a가 b를 믿는다". 재판관 번호를 반환, 없으면 -1.

// 제약 조건
// 1 <= n <= 1,000, 0 <= trust.length <= 10,000
// 모든 쌍은 유일, a != b, 1 <= a, b <= n

// 예제
// 입력                                   출력   설명
// n=2, trust={{1,2}}                     2      2는 아무도 안 믿고 1이 믿음
// n=3, trust={{1,3},{2,3}}               3      3은 아무도 안 믿고 1,2가 믿음
// n=3, trust={{1,3},{2,3},{3,1}}         -1     3이 1을 믿어서 조건 (1) 위반
// n=1, trust={}                          1      혼자면 "아무도 안 믿고 나머지 0명이 믿는" 조건을 그냥 만족

// 로컬 테스트 입력 형식
// 첫 줄 n m / 다음 m 줄 a b

// 접근
//
// [1단계 — 유형 판별]
// 그래프처럼 생겼지만 탐색이 필요 없다. 조건이 전부 "차수(degree)"로 번역되기 때문.
//   조건 (1) 아무도 안 믿음 = 나가는 간선 0개 (outdegree == 0)
//   조건 (2) 전원이 믿음    = 들어오는 간선 n-1개 (indegree == n - 1)
// 간선을 한 번 훑으며 차수만 세면 끝 → O(n + E).
//
// [2단계 — 배열 두 개를 하나로 (5622 다이얼 트릭의 재사용)]
// in[]/out[] 두 배열 대신 cnt[] 하나에 (indegree - outdegree)를 바로 누적한다.
// 다이얼(5622)에서 "숫자"가 아니라 "최종 걸리는 초"를 룩업 테이블에 직접 박아둔 것과 같은 발상 —
// 중간 표현을 만들지 않고 판정에 쓸 최종 값을 곧장 쌓는다. 판정은 cnt[i] == n - 1 한 줄.
//
// [3단계 — 이 압축이 안전한 이유 (증명)]
// indegree <= n-1 이고 outdegree >= 0 이므로 cnt = in - out == n-1 이 되려면
// in == n-1 이고 동시에 out == 0 이어야만 한다 → 조건 (1)(2)와 정확히 동치. 오탐 없음.
// 조건 (3) 유일성도 자동 — 두 명이 동시에 out == 0 이면 서로를 믿을 수 없어 둘 다 in == n-1 이 불가능.
//
// [4단계 — 함정: n = 1]
// trust가 비고 n=1이면 cnt[1] == 0 == n-1 → 1번이 재판관. "믿는 사람이 0명인데 재판관?"이 맞는 답이다.
// 차수 방식은 이 케이스를 조건 분기 없이 그냥 통과한다 (별도 if 필요 없음).
//
// [트레이스 — 예제 3]
// {1,3}: cnt[1]-- cnt[3]++  {2,3}: cnt[2]-- cnt[3]++  {3,1}: cnt[3]-- cnt[1]++
// cnt[1]=0, cnt[2]=-1, cnt[3]=1. n-1 = 2 와 같은 값이 없으므로 -1
//
// [복잡도] 시간 O(n + E), 공간 O(n). 탐색·정렬 없이 한 번 훑기.

#include <iostream>
#include <vector>
using namespace std;
#define endl '\n'

int cnt[1004];

class Solution {
public:
    int findJudge(int n, vector<vector<int>>& trust)
    {
        for (int i = 1; i <= n; i++)
            cnt[i] = 0;

        for (auto t : trust)
        {
            cnt[t[0]]--;
            cnt[t[1]]++;
        }

        for (int i = 1; i <= n; i++)
            if (cnt[i] == n - 1)
                return i;

        return -1;
    }
};

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    int n, m;
    cin >> n >> m;

    vector<vector<int>> trust;
    while (m--)
    {
        int a, b;
        cin >> a >> b;
        trust.push_back({ a, b });
    }

    Solution s;
    cout << s.findJudge(n, trust) << endl;
}

// 코드 주석
// int cnt[1004];                 전역 배열, 1-indexed (n <= 1000 이라 여유분 +4). 전역 0 초기화에 의존
// for (i=1; i<=n; i++) cnt[i]=0; LeetCode 다중 케이스 대비 초기화 — 1 ~ n 만 쓰므로 그 범위만
// cnt[t[0]]--; cnt[t[1]]++;      한 배열에 (들어온 신뢰 - 나간 신뢰)를 바로 누적. in/out 두 배열이 필요 없다
// for (auto t : trust)           범위 기반 for (인덱스 불필요)
// cnt[i] == n - 1                "전원이 믿고(+n-1) 아무도 안 믿는다(-0)" 를 한 번에 판정
// return -1;                     루프를 다 돌 때까지 못 찾으면 재판관 없음
