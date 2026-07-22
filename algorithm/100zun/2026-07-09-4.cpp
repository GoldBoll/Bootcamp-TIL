// 백준 15651 - N과 M (3) (Silver 3)
// https://www.acmicpc.net/problem/15651

// 문제 설명
// 1~N 중 M개를 고른 수열을 사전순으로 모두 출력.
// 같은 수를 여러 번 골라도 된다. (= 중복 순열)

// 제약 조건
// 1 <= M <= N <= 7

// 예제
// 입력    출력
// 4 2     1 1 / 1 2 / ... / 4 3 / 4 4 (16줄)

// 접근 — 백트래킹 (중복 순열: 아무 제약 없음)
// 수열을 vector ret_v에 push_back으로 쌓고 ret_v.size() == m 이면 완성.
// 중복 허용 + 순서 구분 = 매 자리에서 1~N 전부 후보.
// visited도 시작 인덱스도 없다 — 백트래킹의 가장 원시형.
// 출력이 최대 7^7 = 82만 줄이라 입출력 가속이 필수.

#include <iostream>
#include <vector>
using namespace std;
#define endl '\n'

int n, m;
vector<int> ret_v;

void dfs()
{
    if (ret_v.size() == m)
    {
        for (int i : ret_v)
            cout << i << " ";
        cout << endl;
        return;
    }

    for (int i = 1; i <= n; i++)
    {
        ret_v.push_back(i);
        dfs();
        ret_v.pop_back();
    }
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    cin >> n >> m;
    dfs();
}

// 코드 주석
// for (int i = 1; i <= n; i++)   매 깊이에서 1~N 전부 후보 — visited 검사가 없다
// ret_v.push_back(i); dfs(); ret_v.pop_back();
//                                같은 수를 다시 골라도 됨(중복 허용), 리턴 후 빼서 복원
// dfs();                         start 인자 없이 바로 시작, ret_v.size() == m이면 완성
