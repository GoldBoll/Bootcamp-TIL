// 프로그래머스 42839 - 소수 찾기 (Lv.5)
// https://school.programmers.co.kr/learn/courses/30/lessons/42839

// 문제 설명
// 한 자리 숫자가 적힌 종이 조각이 흩어져 있다. 조각을 붙여 만들 수 있는
// 소수가 몇 개인지 구하라. 조각은 한 번씩만 쓸 수 있고 일부만 써도 된다.
// "011"이면 [11, 101] 두 개의 소수를 만들 수 있다(011과 11은 같은 수로 취급).

// 제약 조건
// 1 <= numbers 길이 <= 7
// numbers는 '0'~'9' 문자로만 구성된다.
// 011과 11은 같은 수로 본다.

// Example
// Input : "17"    Output: 3   ([7, 17, 71] — 1은 소수가 아님)
// Input : "011"   Output: 2   ([11, 101])

// 접근 — 부분 순열 완전 탐색(백트래킹) + set 중복 제거 + 시행 나눗셈 소수 판정
// 길이가 최대 7이라 만들 수 있는 수의 개수는 P(7,1)+...+P(7,7) = 13,699개뿐이다.
// 상한이 완전 탐색을 허가하므로 가지치기 없이 전부 만들고 걸러낸다.
// 1) visited[i]로 쓴 조각을 표시하며 DFS. 자리 하나를 붙일 때마다 그 시점의 수를
//    후보로 등록한다(길이 1~n 부분 순열이 한 번의 탐색으로 전부 나온다).
// 2) stoi로 정수화하면 "011" -> 11로 선행 0이 자동 정규화되고, set에 넣으면
//    같은 수가 겹쳐 들어오는 경우까지 사라진다. "011과 11은 같다" 규칙이 코드에서 소멸.
// 3) 후보마다 i*i <= n 시행 나눗셈으로 소수 판정. 최대값 7,654,321의 제곱근은 약 2,767.
// 시간 O(n! * n) 생성 + O(후보 수 * sqrt(최댓값)) 판정, 공간 O(후보 수)
// (n <= 7이므로 생성 13,699개 x 판정 2,767회 = 최악 4천만 미만 — 여유)

#include <string>
#include <vector>
#include <set>

using namespace std;

string paper;                                      // 입력 종이 조각
int visited[8];                                    // 조각 사용 여부 (bool 대신 int)
set<int> cand;                                     // 만들 수 있는 서로 다른 수

bool isPrime(int n)
{
    if (n < 2) return false;                       // 0, 1은 소수가 아니다

    for (int i = 2; i * i <= n; i++)               // sqrt 대신 i*i — 부동소수점 오차 회피
        if (n % i == 0) return false;

    return true;
}

void dfs(string cur)
{
    if (cur.size()) cand.insert(stoi(cur));        // 붙일 때마다 등록 = 부분 순열 전부

    for (int i = 0; i < paper.size(); i++)
    {
        if (visited[i]) continue;

        visited[i] = 1;                            // 넣고
        dfs(cur + paper[i]);
        visited[i] = 0;                            // 빼고
    }
}

int solution(string numbers)
{
    paper = numbers;
    cand.clear();
    dfs("");

    int ret = 0;
    for (int n : cand)
        if (isPrime(n)) ret++;

    return ret;
}
