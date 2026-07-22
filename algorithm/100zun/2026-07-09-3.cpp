// 백준 15650 - N과 M (2) (Silver 3)
// https://www.acmicpc.net/problem/15650

// 문제 설명
// 1~N 중 중복 없이 M개를 고른 수열을 사전순으로 모두 출력.
// 고른 수열은 오름차순이어야 한다. (= 조합)

// 제약 조건
// 1 <= M <= N <= 8

// 예제
// 입력    출력
// 4 2     1 2 / 1 3 / 1 4 / 2 3 / 2 4 / 3 4

// 접근 — 백트래킹 (조합: 시작 인덱스로 오름차순 강제)
// 수열을 vector ret_v에 push_back으로 쌓고 ret_v.size() == m 이면 완성.
// 오름차순만 허용 = 조합. visited 대신 "다음 재귀는 i+1부터"라는 시작 인덱스
// 하나로 중복과 역순을 동시에 차단한다.
// N과 M 시리즈는 visited 유무 x 시작 인덱스 유무의 2x2 조합이 전부:
//   (1) 순열: visited O, start X   (2) 조합: visited X, start i+1
//   (3) 중복순열: 둘 다 X          (4) 중복조합: visited X, start i

#include <iostream>
#include <vector>
using namespace std;
#define endl '\n'

int n, m;
vector<int> ret_v;

void dfs(int start)
{
    if (ret_v.size() == m)
    {
        for (int i : ret_v)
            cout << i << " ";
        cout << endl;
        return;
    }

    for (int i = start; i <= n; i++)
    {
        ret_v.push_back(i);
        dfs(i + 1);
        ret_v.pop_back();
    }
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    cin >> n >> m;
    dfs(1);
}

// 코드 주석
// void dfs(int start)            start = 이번에 고를 수 있는 최솟값
// if (ret_v.size() == m)         길이가 m이면 한 수열 완성
// ret_v.push_back(i); dfs(i + 1); ret_v.pop_back();
//                                i를 넣고, 다음은 i보다 큰 수만 → 오름차순·중복 없음 자동 보장
// dfs(1);                        1부터 시작
