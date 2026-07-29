// 프로그래머스 43165 - 타겟 넘버 (Lv.5)
// https://school.programmers.co.kr/learn/courses/30/lessons/43165
// (같은 이진 분기 골격: 백준 15651 N과 M (3) — 매 자리에서 선택지가 고정된 중복 순열)

// [스타일 절충] 프로그래머스는 solution 함수 제출 형식이라 cin으로 입력을 받지 않는다.
//              강사 스타일 cin 기반 main 대신, 예제를 담은 로컬 테스트 main을 아래에 분리했다.

// 문제 설명
// n 개의 음이 아닌 정수가 순서대로 주어진다. 순서를 바꾸지 않고 각 수에 + 또는 - 를 붙여
// 더했을 때 타겟 넘버를 만드는 방법의 수를 반환하라.

// 제약 조건
// 2 <= numbers 길이 <= 20
// 1 <= numbers 의 원소 <= 50 (자연수)
// 1 <= target <= 1,000 (자연수)

// Example
// Input : numbers = [1, 1, 1, 1, 1], target = 3
// Output: 5        (-1+1+1+1+1, +1-1+1+1+1, +1+1-1+1+1, +1+1+1-1+1, +1+1+1+1-1)
//
// Input : numbers = [4, 1, 2, 1], target = 4
// Output: 2        (+4+1-2+1, +4-1+2-1)

// 접근 — 자리마다 + / - 두 갈래로 내려가는 DFS
//
// [1단계 — 선택지가 원소가 아니라 부호다]
// 순서를 바꿀 수 없다는 조건이 이 문제를 순열에서 떼어낸다. 고를 것은 "어떤 수를 쓸까"가
// 아니라 "i 번째 수의 부호를 무엇으로 할까"이고, 선택지는 항상 두 개로 고정이다.
// 그래서 visited 배열이 필요 없다 — 각 자리를 정확히 한 번만 지나가므로 상태 오염이 없고,
// 되돌리기(빼고)도 필요 없다. 누적합을 인수로 넘기면 되돌림이 호출 스택에 흡수된다.
//
// [2단계 — 완전탐색으로 갈 수 있는 근거는 제약]
// 잎의 개수는 2^n, n <= 20 이므로 최악 2^20 = 1,048,576 가지. 브루트포스가 그대로 통한다.
//
// [3단계 — 왜 BFS가 아니라 DFS인가 (자료구조 선택 근거)]
// 부호 조합을 큐로 넓혀 나가는 BFS도 답은 같지만, 마지막 레벨에서 큐가 2^20 개의
// 부분합을 동시에 들고 있어야 한다. DFS는 재귀 깊이가 n = 20 으로 고정이라 상태가 한 줄뿐이다.
// 최단 거리를 묻지 않고 "끝까지 내려간 경우의 수"만 세는 문제라 넓이를 유지할 이유가 없다.
//
// [4단계 — 세는 문제이므로 int 반환 dfs]
// 전역 ans++ 대신 실패 0 / 성공 1 을 반환하고, 중간 노드는 두 자식의 반환값을 그대로 더한다.
// 잎에서만 판정하므로 조건 분기가 함수 진입부 한 줄로 끝난다.
//
// 시간 O(2^n) 최악 약 105만, 공간 O(n) (재귀 깊이 20)
//
// [더 줄이려면]
// 남은 수들의 합 rest 를 미리 구해 두면, 목표까지의 거리 |target - sum| > rest 인 순간
// 그 아래 잎은 전부 실패라 잘라낼 수 있다. 또 부분합의 범위가 -1000 ~ 1000 으로 좁으니
// dp[자리][부분합] 카운팅으로 O(n x S)까지 내려간다. 다만 2^20 이 이미 통과 범위라
// 여기서는 골격이 드러나는 완전탐색을 그대로 둔다.

#include <iostream>
#include <vector>
using namespace std;
#define endl '\n'

int n, t;
vector<int> v;

int dfs(int depth, int sum)
{
    if (depth == n) return sum == t ? 1 : 0;

    return dfs(depth + 1, sum + v[depth]) + dfs(depth + 1, sum - v[depth]);
}

int solution(vector<int> numbers, int target)
{
    n = (int)numbers.size();
    t = target;
    v = numbers;

    return dfs(0, 0);
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    cout << solution({ 1, 1, 1, 1, 1 }, 3) << endl;
    cout << solution({ 4, 1, 2, 1 }, 4) << endl;

    cout << solution({ 1, 1 }, 2) << endl;
    cout << solution({ 1, 1 }, 1) << endl;
    cout << solution({ 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
                       50, 50, 50, 50, 50, 50, 50, 50, 50, 50 }, 1000) << endl;

    return 0;
}

// 코드 주석
// int n, t; vector<int> v;           전역 선언 — 재귀 인수를 depth·sum 두 개로 줄인다
// if (depth == n)                    모든 자리의 부호를 정한 잎. 여기서만 판정한다
// return sum == t ? 1 : 0;           세는 문제이므로 성공 1 / 실패 0 을 반환해 위로 누적
// dfs(depth + 1, sum + v[depth])
//   + dfs(depth + 1, sum - v[depth]);
//                                    + 갈래와 - 갈래의 결과를 그대로 더한다.
//                                    누적합을 인수로 넘기므로 visited·되돌리기가 필요 없다
