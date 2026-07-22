// 백준 15654 - N과 M (5) (Silver 3)
// https://www.acmicpc.net/problem/15654

// 문제 설명
// 서로 다른 자연수 N개가 주어진다. 그중 중복 없이 M개를 고른 수열(순서 구분)을
// 사전순으로 모두 출력. (= 주어진 배열에서의 순열)

// 제약 조건
// 1 <= M <= N <= 8, 원소는 10000 이하 자연수

// 예제
// 입력           출력
// 3 1 / 4 5 2    2 / 4 / 5
// 4 2 / 9 8 7 1  1 7 / 1 8 / 1 9 / 7 1 / ... (12줄)

// 접근 — 백트래킹 (배열 순열: 정렬 + visited)
// 만들고 있는 수열을 vector ret_v에 push_back으로 쌓고, ret_v.size() == m 이면 완성.
// 사전순 출력이 필요하므로 입력 배열을 먼저 정렬 — 인덱스 오름차순 순회가 곧 사전순.
// 순서가 구분되는 순열이라 visited로 "이미 쓴 원소"만 막고,
// 재귀 후 visited 해제 + ret_v.pop_back()으로 상태를 되돌린다(백트래킹).

#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;
#define endl '\n'

int n, m;
int v[10];
int visited[10];
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

    for (int i = 0; i < n; i++)
    {
        if (!visited[i])
        {
            visited[i] = 1;
            ret_v.push_back(v[i]);
            dfs();
            visited[i] = 0;
            ret_v.pop_back();
        }
    }
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    cin >> n >> m;
    for (int i = 0; i < n; i++) cin >> v[i];
    sort(v, v + n);

    dfs();
}

// 코드 주석
// vector<int> ret_v;             지금까지 고른 수열. push_back으로 쌓고 pop_back으로 뺀다
// if (ret_v.size() == m)         길이가 m이 되면 한 수열 완성 → 출력 후 리턴
// for (int i : ret_v)            범위 기반 for로 수열 출력
// sort(v, v + n);                정렬해 두면 인덱스 순 순회 = 사전순 출력
// int visited[10];               bool 대신 int로 (강사 스타일: 0=미방문, 1=방문)
// visited[i] = 1; ... = 0;           들어가기 전 켜고 리턴 후 꺼서 복원
// ret_v.push_back(v[i]); ... pop_back();  수열에 넣고, 리턴 후 빼서 복원 (visited와 한 쌍)
