// 백준 6603 - 로또 (Silver 2)
// https://www.acmicpc.net/problem/6603

// 문제 설명
// k개의 수로 이루어진 집합 S(오름차순)에서 6개를 고르는 모든 방법을 사전순으로 출력.
// 입력은 여러 테스트 케이스. 각 줄 = k 다음 k개의 수. 마지막 줄에 0.
// 각 테스트 케이스 사이에는 빈 줄을 하나 출력.

// 제약 조건
// 6 < k < 13, S의 원소는 오름차순으로 주어짐

// 예제
// 입력                        출력
// 7 1 2 3 4 5 6 7             1 2 3 4 5 6 / ... / 2 3 4 5 6 7 (7가지)
// 8 1 2 3 5 8 13 21 34        (28가지)
// 0

// 접근 — 튜터님 스타일 백트래킹 (조합: 시작 인덱스 + 넣고/빼고)
// 6개를 고르는 조합이라 다음 재귀를 i+1부터 넘겨 오름차순·중복 없음을 강제(visited 불필요).
// S가 이미 오름차순이라 인덱스 순 선택이 곧 사전순 출력.
// 수열 자체를 출력하는 문제라 반환값이 없어 void dfs() + ret_v 출력.
// 상태 전진 push_back은 //넣고, 되돌리기 pop_back은 //빼고로 대칭 배치.

#include <iostream>
#include <vector>
using namespace std;
#define endl '\n'

int k;
vector<int> v;
vector<int> ret_v;

void dfs(int here)
{
    if (ret_v.size() == 6)
    {
        for (int i : ret_v)
        {
            cout << i << " ";
        }
        cout << endl;
        return;
    }

    for (int i = here; i < v.size(); i++)
    {
        ret_v.push_back(v[i]);
        dfs(i + 1);
        ret_v.pop_back();
    }
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    while (true)
    {
        cin >> k;
        if (k == 0) break;

        v.clear();
        for (int i = 0; i < k; i++)
        {
            int c;
            cin >> c;
            v.push_back(c);
        }

        dfs(0);
        cout << endl;
    }
}

// 코드 주석
// void dfs(int here)             here = 이번에 고를 수 있는 최소 인덱스 (튜터 스타일 파라미터명)
// if (ret_v.size() == 6)         6개를 다 골랐으면 한 조합 완성 → 출력
// for (int i = here; i < v.size(); i++)   here부터 순회, 다음 재귀는 i+1 → 오름차순·중복 없음(조합)
// ret_v.push_back(v[i]); dfs(i+1); ret_v.pop_back();   넣고 → 재귀 → 빼고 (상태 복원)
// while (true) { cin >> k; if (k == 0) break; ... }   0이 나올 때까지 테스트 케이스 반복
// v.clear();                     테스트 케이스마다 입력 집합 초기화 (ret_v는 pop으로 자동 비워짐)
// cout << endl;                  각 테스트 케이스 뒤 빈 줄
