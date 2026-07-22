// 백준 15652 - N과 M (4) (Silver 3)
// https://www.acmicpc.net/problem/15652

// 문제 설명
// 1~N 중 M개를 고른 수열을 사전순으로 모두 출력.
// 같은 수를 여러 번 골라도 되고, 수열은 비내림차순이어야 한다. (= 중복 조합)

// 제약 조건
// 1 <= M <= N <= 8

// 예제
// 입력    출력
// 4 2     1 1 / 1 2 / 1 3 / 1 4 / 2 2 / 2 3 / 2 4 / 3 3 / 3 4 / 4 4

// 접근 — 백트래킹 (중복 조합: 시작 인덱스를 i 그대로)
// 수열을 vector ret_v에 push_back으로 쌓고 ret_v.size() == m 이면 완성.
// 15650(조합)과 딱 한 글자 차이 — 다음 재귀를 i+1이 아니라 i부터.
// "자기 자신부터 다시 고를 수 있다" = 중복 허용, "i 미만은 못 고른다" = 비내림차순.

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
        dfs(i);
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
// dfs(i);                        15650은 dfs(i+1) — i를 그대로 넘기는 한 글자가
//                                "같은 수 재선택 허용(중복) + i 미만 금지(비내림차순)"을 만든다
// ret_v.push_back(i); ... pop_back();   수열에 넣고 리턴 후 빼서 복원
