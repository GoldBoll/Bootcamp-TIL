// 백준 18429 - 근손실 (Silver 3) — [버전 A] DFS 백트래킹
// https://www.acmicpc.net/problem/18429
// (같은 문제 next_permutation 버전: 2026-07-09-7-np.cpp)

// 문제 설명
// 시작 중량 500. 하루가 지날 때마다 K 감소, 매일 키트 1개를 써서 그 증가량만큼 증가.
// 서로 다른 키트 N개를 N일 동안 하루 하나씩 모두 사용한다.
// 모든 시점(매일 운동 후)에 중량이 500 이상으로 유지되는 사용 순서의 경우의 수를 출력.

// 제약 조건
// 1 <= N <= 8, 1 <= K <= 50, 1 <= A <= 50

// 예제
// 입력           출력
// 3 4 / 3 7 5     4

// 접근 — 튜터님 스타일 백트래킹 (넣고/빼고 + int 반환 누적)
// sum = 현재 중량 - 500 (0이면 딱 500, 음수면 조건 위반).
//   키트 넣기: sum += v[i](증가) 후 sum -= m(하루 경과)  →  sum >= 0 일 때만 재귀.
// dfs는 "그 아래 유효 경우의 수"를 int로 반환 — 완성(ret_v.size()==n) 시 1, 중간은 coin 누적.
// 상태 변경은 //넣고 블록, 되돌리기는 //빼고 블록으로 대칭 배치 (push/visited/sum 짝맞춤).

#include <iostream>
#include <vector>
using namespace std;
#define endl '\n'

int n, m, sum;
vector<int> v;
vector<int> ret_v;
int visited[10];

int dfs()
{
    if (ret_v.size() == n) return 1;

    int coin = 0;
    for (int i = 0; i < n; i++)
    {
        if (!visited[i])
        {
            ret_v.push_back(v[i]);
            visited[i] = 1;
            sum += v[i];
            sum -= m;

            if (sum >= 0)
            {
                coin += dfs();
            }

            ret_v.pop_back();
            visited[i] = 0;
            sum -= v[i];
            sum += m;
        }
    }
    return coin;
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    cin >> n >> m;
    for (int i = 0; i < n; i++)
    {
        int c;
        cin >> c;
        v.push_back(c);
    }

    cout << dfs() << endl;
}

// 코드 주석
// int sum;                       현재 중량 - 500 (전역 0 = 딱 500). sum >= 0 이 "500 이상"
// if (ret_v.size() == n) return 1;   N개 다 썼으면 유효한 한 순서 → 1
// int coin = 0; ... coin += dfs();   자식 가지의 경우의 수를 누적, 마지막에 return coin
// //넣고: push_back + visited=1 + sum += v[i] - m    상태 전진
// if (sum >= 0) coin += dfs();       중량이 500 이상일 때만 다음 날로 (가지치기)
// //빼고: pop_back + visited=0 + sum -= v[i] + m     상태 복원 (넣고의 정확한 역순)
