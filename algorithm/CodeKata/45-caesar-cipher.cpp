// 프로그래머스 12926 - 시저 암호 (Lv.1)
// https://school.programmers.co.kr/learn/courses/30/lessons/12926

// 문제 설명
// 문장의 각 알파벳을 n만큼 뒤로 밀어 암호화한다. "AB"를 1만큼 밀면 "BC",
// "z"를 1만큼 밀면 "a"가 된다. 문자열 s와 거리 n이 주어질 때 암호문을 반환하라.

// 제약 조건
// 공백은 밀지 않고 그대로 둔다. s는 소문자, 대문자, 공백으로만 구성된다.
// s의 길이 <= 8,000, n은 1 이상 25 이하의 자연수 (대문자는 대문자로, 소문자는 소문자로)

// Example
// Input : s = "AB", n = 1        Output: "BC"
// Input : s = "z",  n = 1        Output: "a"
// Input : s = "a B z", n = 4     Output: "e F d"

// 접근 — 대소문자별 기준점을 빼서 0..25 상대 위치로 바꾸고 % 26
// 'z' + 1이 '{'가 되는 것을 막으려면 알파벳 구간을 0부터 시작하는 좌표로 옮겨야 한다.
// 1) 대문자면 기준점 'A', 소문자면 'a'를 잡는다.
// 2) c - base로 0..25 상대 위치를 얻고 n을 더한 뒤 % 26으로 감아준다.
// 3) 다시 base를 더해 원래 구간(대문자/소문자)으로 되돌린다 — 두 구간을 한 식으로 처리.
// 공백은 어느 구간에도 없으므로 건너뛴다.
// 시간 O(n), 공간 O(1) (입력 문자열을 제자리 변환)

#include <string>
#include <cctype>

using namespace std;

string solution(string s, int n) {
    for (char& c : s) {                                         // 참조로 받아 제자리 변환
        if (c == ' ') continue;                                 // 공백은 밀지 않는다

        char base = isupper(static_cast<unsigned char>(c)) ? 'A' : 'a';   // 구간 기준점
        c = base + (c - base + n) % 26;                          // 0..25로 옮겨 밀고 감은 뒤 복귀
    }

    return s;
}
