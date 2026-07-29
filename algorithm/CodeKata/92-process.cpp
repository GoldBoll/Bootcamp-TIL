// 프로그래머스 42587 - 프로세스 (Lv.4)
// https://school.programmers.co.kr/learn/courses/30/lessons/42587
// (같은 FIFO 골격: 42586 기능개발 — 다만 이쪽은 조건 미달이면 큐 뒤로 되돌린다)

// [스타일 절충] 프로그래머스는 solution 함수 제출 형식이라 cin으로 입력을 받지 않는다.
//              강사 스타일 cin 기반 main 대신, 예제를 담은 로컬 테스트 main을 아래에 분리했다.

// 문제 설명
// 운영체제는 다음 규칙으로 프로세스를 관리한다.
// 1) 실행 대기 큐에서 프로세스 하나를 꺼낸다.
// 2) 큐에 더 높은 우선순위의 프로세스가 남아 있으면 꺼낸 프로세스를 큐 뒤로 되돌린다.
// 3) 그렇지 않으면 실행한다.
// priorities 와 대상 프로세스의 인덱스 location 이 주어질 때, 그 프로세스가 몇 번째로
// 실행되는지 반환하라.

// 제약 조건
// 1 <= priorities 길이 <= 100
// 우선순위는 1 ~ 9 (숫자가 클수록 우선순위가 높다)
// 0 <= location < priorities 길이

// Example
// Input : priorities = [2, 1, 3, 2], location = 2
// Output: 1        (우선순위 3이 가장 높아 첫 번째로 실행)
//
// Input : priorities = [1, 1, 9, 1, 1, 1], location = 0
// Output: 5        (9가 먼저 나가고, 남은 1들은 큐 순서대로 → 대상은 5번째)

// 접근 — FIFO 큐 + 남은 최대 우선순위 조회
//
// [1단계 — 정렬하면 답이 사라진다]
// 우선순위만 보면 내림차순 정렬로 끝날 것 같지만, 동점 프로세스끼리의 순서가
// "큐에 남은 순서"로 결정된다. 예제 2에서 우선순위 1이 다섯 개인데 답이 5인 이유가 그것이다.
// 정렬은 이 순서 정보를 지워버리므로 대기열은 큐로 그대로 굴려야 한다.
//
// [2단계 — 인덱스를 함께 들고 다닌다 (자료구조 선택 근거)]
// 답으로 물어보는 것은 "값"이 아니라 "location 번째 원소가 몇 번째로 나가는가"다.
// 큐를 돌리면 원소의 현재 위치는 계속 바뀌므로 원래 인덱스를 잃으면 대상을 식별할 수 없다.
// → queue<pair<int, int>> 로 {우선순위, 원래 인덱스}를 묶어 넣는다.
//
// [3단계 — "더 급한 게 남아 있나"를 O(log n)으로 (자료구조 선택 근거)]
// 규칙 2)를 판정하려면 큐에 남은 최대 우선순위가 필요한데, 큐는 내부를 훑을 수 없다.
// 남은 프로세스의 우선순위만 따로 priority_queue<int> 에 담아 최댓값을 조회한다.
// 실행할 때만 pq.pop() 을 하므로 pq 의 내용은 항상 "아직 실행되지 않은 프로세스"와 일치한다.
// 되돌릴 때는 pq 를 건드리지 않는다 — 되돌린 프로세스도 여전히 남아 있는 프로세스다.
//
// [4단계 — 복잡도]
// 큐를 한 바퀴 돌면 최소 한 개는 실행되어 사라지므로 큐 연산은 최악 O(n^2),
// 우선순위 큐 연산은 O(n log n). n <= 100 이라 최악 1만 회 수준으로 여유가 크다.
// (우선순위가 1~9로 좁으니 int cnt[10] 카운팅으로 최댓값을 O(1)에 찾아 O(n^2)의
//  상수를 더 줄일 수도 있지만, 값 범위에 의존하지 않는 priority_queue 쪽을 택했다.)

#include <iostream>
#include <vector>
#include <queue>
using namespace std;
#define endl '\n'

int solution(vector<int> priorities, int location)
{
    queue<pair<int, int>> q;
    priority_queue<int> pq;

    for (int i = 0; i < priorities.size(); i++)
    {
        q.push({ priorities[i], i });
        pq.push(priorities[i]);
    }

    int order = 0;

    while (!q.empty())
    {
        auto [pri, idx] = q.front();
        q.pop();

        if (pri < pq.top())
        {
            q.push({ pri, idx });
            continue;
        }

        pq.pop();
        order++;

        if (idx == location) return order;
    }

    return order;
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    cout << solution({ 2, 1, 3, 2 }, 2) << endl;
    cout << solution({ 1, 1, 9, 1, 1, 1 }, 0) << endl;

    cout << solution({ 5 }, 0) << endl;
    cout << solution({ 2, 1, 3, 2 }, 3) << endl;
    cout << solution({ 1, 2, 3, 4, 5 }, 0) << endl;

    return 0;
}

// 코드 주석
// queue<pair<int, int>> q;           {우선순위, 원래 인덱스} — 큐를 돌리면 위치가 바뀌므로
//                                    대상을 식별할 인덱스를 값과 함께 들고 다닌다
// priority_queue<int> pq;            아직 실행되지 않은 프로세스의 우선순위. top() = 남은 최댓값
// auto [pri, idx] = q.front();       구조적 바인딩(C++17)으로 first/second 없이 읽는다
// if (pri < pq.top())                더 급한 프로세스가 남아 있으면 실행하지 않고
// q.push({ pri, idx });              큐 뒤로 되돌린다. pq 는 건드리지 않는다(여전히 남아 있으므로)
// pq.pop();                          실행 확정 — 남은 집합에서 제거. pri == pq.top() 이므로 짝이 맞는다
// if (idx == location) return order;  대상 프로세스가 실행된 순간이 곧 답
