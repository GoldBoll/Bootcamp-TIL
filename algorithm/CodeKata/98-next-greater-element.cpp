// 프로그래머스 154539 - 뒤에 있는 큰 수 찾기 (Lv.5)
// https://school.programmers.co.kr/learn/courses/30/lessons/154539

// 문제 설명
// 배열의 각 원소에 대해, 자신보다 뒤에 있으면서 자신보다 크고 가장 가까운 수를
// "뒷 큰수"라 한다. 각 원소의 뒷 큰수를 담은 배열을 반환하라. 없으면 -1.

// 제약 조건
// 4 <= numbers 길이 <= 1,000,000
// 1 <= numbers[i] <= 1,000,000

// Example
// Input : [2, 3, 3, 5]
// Output: [3, 5, 5, -1]        (인덱스 1의 3은 뒤의 3이 '크지 않아' 5까지 기다린다)
//
// Input : [9, 1, 5, 3, 6, 2]
// Output: [-1, 5, 6, 6, -1, -1]

// 접근 — 단조 감소 스택에 "답을 기다리는 인덱스"를 쌓는다
// 이중 루프는 최악 10^6 * 10^6 = 10^12로 즉사한다. 관찰 하나로 O(n)이 된다:
// 앞에 있는 작은 수는 자기보다 큰 수가 나오는 순간 전부 같은 값으로 답이 확정된다.
// 1) 왼쪽부터 순회하며 "아직 답을 못 찾은 인덱스"를 스택에 쌓는다.
//    스택 안의 값은 항상 내려가는 순서(단조 감소)가 유지된다.
// 2) 현재 값이 스택 top의 값보다 크면 그 인덱스의 답은 현재 값 — 꺼내며 확정한다.
//    같은 값일 때는 꺼내지 않는다("크면서"이므로 3 뒤의 3은 답이 아니다).
// 3) 끝까지 남은 인덱스는 뒷 큰수가 없으므로 -1(초기값 그대로).
// 각 인덱스는 한 번 push, 최대 한 번 pop → 시간 O(n), 공간 O(n)

#include <vector>
#include <stack>

using namespace std;

vector<int> solution(vector<int> numbers) {
    int n = numbers.size();
    vector<int> answer(n, -1);                 // 못 찾으면 -1이 그대로 답
    stack<int> st;                             // 뒷 큰수를 기다리는 인덱스들 (값 기준 단조 감소)

    for (int i = 0; i < n; i++) {
        // '<' 이어야 한다 — '<='로 쓰면 같은 값을 뒷 큰수로 잘못 확정한다
        while (!st.empty() && numbers[st.top()] < numbers[i]) {
            answer[st.top()] = numbers[i];
            st.pop();
        }
        st.push(i);
    }
    return answer;
}
