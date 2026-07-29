// 프로그래머스 12930 - 이상한 문자 만들기 (Lv.1)
// https://school.programmers.co.kr/learn/courses/30/lessons/12930

// 문제 설명
// 문자열 s는 한 개 이상의 단어로 구성되고, 각 단어는 하나 이상의 공백문자로 구분된다.
// 각 단어의 짝수번째 알파벳은 대문자로, 홀수번째 알파벳은 소문자로 바꾼 문자열을 반환하라.

// 제약 조건
// 문자열 전체가 아니라 단어별로 짝/홀수 인덱스를 판단한다. 첫 글자는 0번째(짝수).
// s는 알파벳과 공백으로만 구성되고, 공백이 연속으로 나올 수 있다.

// Example
// Input : "try hello world"
// Output: "TrY HeLlO WoRlD"

// 접근 — 공백에서 리셋되는 단어 내 카운터
// 인덱스를 문자열 전체가 아니라 단어 단위로 세는 것이 전부다.
// 1) 카운터 idx를 들고 순회, 공백을 만나면 idx = 0으로 리셋하고 그 글자는 건드리지 않는다.
// 2) 알파벳이면 idx의 홀짝으로 toupper/tolower를 골라 제자리에서 덮어쓰고 idx++.
// 3) 공백이 연속이면 리셋만 반복되므로 별도 분기 없이 처리된다.
// 시간 O(n), 공간 O(1) (입력 문자열을 그대로 변환)

#include <string>
#include <cctype>

using namespace std;

string solution(string s) {
    int idx = 0;                                        // 단어 내 알파벳 위치 (공백에서 0으로 리셋)

    for (char& c : s) {                                 // 참조로 받아 제자리 변환 — 결과 버퍼 불필요
        if (c == ' ') { idx = 0; continue; }            // 공백은 그대로 두고 카운터만 초기화

        unsigned char u = static_cast<unsigned char>(c);
        c = (idx % 2 == 0) ? toupper(u) : tolower(u);   // 짝수 자리 대문자 / 홀수 자리 소문자
        idx++;
    }

    return s;
}
