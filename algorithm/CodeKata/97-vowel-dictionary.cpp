// 프로그래머스 84512 - 모음사전 (Lv.5)
// https://school.programmers.co.kr/learn/courses/30/lessons/84512

// 문제 설명
// A, E, I, O, U 다섯 글자만으로 만들 수 있는 길이 1~5의 모든 단어를
// 사전순으로 나열한 사전이 있다. 주어진 단어 word가 몇 번째인지 반환하라.

// 제약 조건
// 1 <= word 길이 <= 5
// word는 A, E, I, O, U 로만 구성

// Example
// Input : "AAAAE" -> Output: 6
// Input : "AAAE"  -> Output: 10
// Input : "I"     -> Output: 1563
// Input : "EIO"   -> Output: 1189

// 접근 — 사전 자체를 사전순 DFS로 재현하고 순번을 세기
// "몇 번째냐"를 수식으로 풀 수도 있지만, 사전순 = A,E,I,O,U 순 DFS 방문순서와 정확히 같다.
// 즉 사전을 실제로 만들면서 세면 순번 규칙을 따로 유도할 필요가 없다.
// 1) 빈 문자열에서 시작해 A,E,I,O,U 순으로 한 글자씩 붙여 내려간다.
// 2) 단어를 하나 만들 때마다 order를 1 올린다 — 이 값이 곧 그 단어의 사전 순번.
// 3) 길이 5에 도달하면 더 내려가지 않고 형제로 넘어간다.
// 전체 단어 수는 5 + 25 + 125 + 625 + 3125 = 3,905개로 고정이라 사실상 O(1).
// 시간 O(5^5), 공간 O(5) (재귀 깊이)

#include <string>

using namespace std;

string target;                                 // 찾는 단어
int order, answer;                             // 전역 0 초기화에 의존

void dfs(string cur) {
    if (cur == target) { answer = order; return; }   // 빈 문자열은 target(길이 >= 1)과 겹치지 않는다
    if (cur.size() == 5) return;                     // 길이 상한 — 여기서 가지를 닫는다

    for (char c : string("AEIOU")) {            // 사전순 = 이 순서
        order++;                                // 단어 하나 생성 = 순번 하나 소비
        dfs(cur + c);
    }
}

int solution(string word) {
    target = word;
    order = 0; answer = 0;
    dfs("");
    return answer;
}
