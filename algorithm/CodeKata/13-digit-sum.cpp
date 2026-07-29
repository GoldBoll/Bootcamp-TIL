// 프로그래머스 12931 - 자릿수 더하기 (Lv.1)
// https://school.programmers.co.kr/learn/courses/30/lessons/12931

// 문제 설명
// 자연수 N이 주어지면 N의 각 자릿수의 합을 구해서 return 한다.
// N = 123이면 1 + 2 + 3 = 6.

// 제약 조건
// N의 범위: 100,000,000 이하의 자연수

// Example
// Input : 123   Output: 6
// Input : 987   Output: 24

// 접근 — 10으로 나누며 마지막 자리를 떼어낸다
// 1) n % 10 이 현재 마지막 자릿수, n /= 10 이 그 자리를 버린 수.
//    두 연산을 n이 0이 될 때까지 반복하면 모든 자릿수를 한 번씩 훑는다.
// 2) 반복 횟수는 자릿수 = O(log10 N). N 상한이 1억이라 최대 9회.
// 3) 자릿수합 상한은 99,999,999의 72 — int로 충분.
// to_string 후 c - '0'으로 더하는 방법도 같은 O(log10 N)이지만,
// 문자열 할당이 없는 나눗셈 방식을 기본으로 둔다.
// 시간 O(log10 N), 공간 O(1)

#include <string>
#include <vector>

using namespace std;

int solution(int n) {
    int sum = 0;

    while (n > 0) {
        sum += n % 10;                    // 마지막 자릿수
        n /= 10;                          // 그 자리를 버림
    }

    return sum;
}
