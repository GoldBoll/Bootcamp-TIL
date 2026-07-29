// 프로그래머스 42586 - 기능개발 (Lv.4)
// https://school.programmers.co.kr/learn/courses/30/lessons/42586
// (관련 개념: 백준 1926·2589의 BFS queue 골격 — 앞에서만 꺼내는 FIFO 시뮬레이션)

// [스타일 절충] 프로그래머스는 solution 함수 제출 형식이라 cin으로 입력을 받지 않는다.
//              강사 스타일 cin 기반 main 대신, 예제를 담은 로컬 테스트 main을 아래에 분리했다.

// 문제 설명
// 각 기능의 현재 진도 progresses[i] 와 하루 개발량 speeds[i] 가 주어진다.
// 진도가 100%가 된 기능만 배포할 수 있고, 배포는 하루에 한 번 하루의 끝에 진행된다.
// 뒤의 기능이 먼저 100%가 되어도 앞의 기능이 배포되지 않았다면 함께 배포된다.
// 각 배포마다 몇 개의 기능이 배포되는지를 순서대로 담은 배열을 반환하라.

// 제약 조건
// 작업의 개수 <= 100
// 진도는 100 미만의 자연수, 개발 속도는 100 이하의 자연수
// 배포는 하루에 한 번, 하루의 끝에 (진도 95 + 속도 4 이면 2일 뒤 배포)

// Example
// Input : progresses = [93, 30, 55], speeds = [1, 30, 5]
// Output: [2, 1]        (완성일 7 / 3 / 9 → 7일에 1·2번, 9일에 3번)
//
// Input : progresses = [95, 90, 99, 99, 80, 99], speeds = [1, 1, 1, 1, 1, 1]
// Output: [1, 3, 2]     (완성일 5 / 10 / 1 / 1 / 20 / 1 → 5일, 10일, 20일)

// 접근 — 완성일로 바꾼 뒤 큐 앞을 기준으로 묶는다
//
// [1단계 — 하루씩 굴리지 않는다]
// 진도를 하루 단위로 더해가는 시뮬레이션도 가능하지만, 기능마다 필요한 날짜는
// 처음부터 계산된다: d = ceil((100 - progresses[i]) / speeds[i]).
// 정수 나눗셈으로 올림은 (100 - p + s - 1) / s. 하루 루프가 사라지고 O(n)이 된다.
//
// [2단계 — 왜 큐인가 (자료구조 선택 근거)]
// 완성일만 보면 정렬하고 싶어지지만, 이 문제의 제약은 "앞의 기능이 배포되기 전에는
// 뒤의 기능도 못 나간다"는 순서 보존이다. 즉 꺼내는 쪽은 항상 맨 앞 하나뿐이고
// 중간을 건너뛰어 꺼낼 일이 없다 → 정렬·우선순위 큐가 아니라 FIFO 큐가 맞는 자료구조.
// (완성일이 작은 것부터 꺼내는 우선순위 큐로 바꾸면 순서 제약이 사라져 답이 무너진다.)
//
// [3단계 — 배포일의 기준은 항상 큐의 맨 앞]
// 한 번의 배포일은 "남아 있는 기능 중 맨 앞 기능의 완성일"이다. 그 뒤로 완성일이
// 그 날짜 이하인 기능은 이미 완성되어 있으므로 같은 배포에 묶인다.
// 완성일이 더 큰 기능을 만나면 거기서 끊고, 그 기능이 다음 배포일의 기준이 된다.
// 전체 최댓값을 따로 관리할 필요가 없다 — 맨 앞을 기준으로 삼는 것만으로 처리된다.
//
// 시간 O(n) (각 기능은 큐에 한 번 들어가고 한 번 나온다), 공간 O(n)

#include <iostream>
#include <vector>
#include <queue>
using namespace std;
#define endl '\n'

vector<int> solution(vector<int> progresses, vector<int> speeds)
{
    queue<int> q;

    for (int i = 0; i < progresses.size(); i++)
        q.push((100 - progresses[i] + speeds[i] - 1) / speeds[i]);

    vector<int> answer;

    while (!q.empty())
    {
        int day = q.front();
        q.pop();

        int cnt = 1;

        while (!q.empty() && q.front() <= day)
        {
            q.pop();
            cnt++;
        }

        answer.push_back(cnt);
    }

    return answer;
}

void print(vector<int> v)
{
    for (int i : v) cout << i << " ";
    cout << endl;
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    print(solution({ 93, 30, 55 }, { 1, 30, 5 }));
    print(solution({ 95, 90, 99, 99, 80, 99 }, { 1, 1, 1, 1, 1, 1 }));

    print(solution({ 99 }, { 1 }));
    print(solution({ 1, 1, 1 }, { 100, 100, 100 }));
    print(solution({ 1, 99, 1 }, { 1, 100, 1 }));

    return 0;
}

// 코드 주석
// (100 - progresses[i] + speeds[i] - 1) / speeds[i]
//                                    완성까지 필요한 일수. 정수 나눗셈 올림 = (a + b - 1) / b
// queue<int> q;                      완성일을 입력 순서대로 담는다. 순서 보존이 제약이라 정렬하지 않는다
// int day = q.front();               이번 배포일 = 남은 기능 중 맨 앞 기능의 완성일
// while (!q.empty() && q.front() <= day)
//                                    그 날짜까지 완성되는 뒤 기능은 같은 배포에 묶인다
//                                    완성일이 더 큰 기능에서 끊기고, 그것이 다음 배포일 기준이 된다
// answer.push_back(cnt);             배포 회차 순서대로 개수를 쌓는다
