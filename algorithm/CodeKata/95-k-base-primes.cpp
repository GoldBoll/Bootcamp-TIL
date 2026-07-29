// 프로그래머스 92335 - k진수에서 소수 개수 구하기 (Lv.5)
// https://school.programmers.co.kr/learn/courses/30/lessons/92335

// 문제 설명
// 양의 정수 n을 k진수로 바꿨을 때, 조건에 맞는 소수(P)의 개수를 반환하라.
// 조건은 0P0 / P0 / 0P / P 형태 — 즉 P 안에 0이 없고, 앞뒤가 0이거나 문자열 경계다.
// P는 k진수 표기를 그대로 10진수 수로 읽은 값으로 소수 판정한다.

// 제약 조건
// 1 <= n <= 1,000,000
// 3 <= k <= 10

// Example
// Input : n = 437674, k = 3
// Output: 3    (211020101011 → 211, 2, 1, 1, 11 → 소수는 211, 2, 11)
//
// Input : n = 110011, k = 10
// Output: 2    (110011 → 11, 11 → 둘 다 소수)

// 접근 — 진법 변환 + 0을 구분자로 토큰 분리 + 제곱근 소수 판정
// "앞뒤가 0 또는 경계"라는 조건은 결국 0을 구분자로 문자열을 자르는 것과 같다.
// 정규식이나 4가지 형태 분기 없이, 0에서 끊고 끊긴 조각만 소수 판정하면 된다.
// 1) n을 k진수 문자열로 변환 (나머지를 모아 뒤집는다).
// 2) 왼쪽부터 한 자리씩 cur = cur * 10 + digit 으로 누적하고, 0이나 끝을 만나면 토큰 확정.
// 3) 토큰을 sqrt까지만 나눠 소수 판정.
// 자리 수는 k = 3일 때 최대 13자리(3^12 <= 10^6 < 3^13)이므로 토큰 값이 최대 약 1.1 x 10^12.
// int로 받으면 오버플로 — cur은 long long이어야 한다.
// 시간 O(log_k n * sqrt(최대 토큰)), 공간 O(log_k n)

#include <string>
#include <algorithm>

using namespace std;

// n을 k진수 문자열로 변환
string toBase(int n, int k) {
    string s;
    while (n > 0) { s += char('0' + n % k); n /= k; }
    reverse(s.begin(), s.end());               // 나머지는 낮은 자리부터 나오므로 뒤집는다
    return s;
}

bool isPrime(long long v) {
    if (v < 2) return false;                   // 1은 소수가 아니다 — 토큰 "1"이 자주 나온다
    for (long long d = 2; d * d <= v; d++)     // sqrt까지만 확인
        if (v % d == 0) return false;
    return true;
}

int solution(int n, int k) {
    string s = toBase(n, k);
    int answer = 0;
    long long cur = 0;                         // 진행 중인 토큰의 10진수 값

    // i == s.size() 를 마지막 구분자처럼 취급 — 끝에 0을 붙이는 특수 처리가 사라진다
    for (int i = 0; i <= (int)s.size(); i++) {
        if (i == (int)s.size() || s[i] == '0') {
            if (cur > 0 && isPrime(cur)) answer++;
            cur = 0;                           // 연속된 0은 cur == 0 이라 그냥 건너뛴다
        } else {
            cur = cur * 10 + (s[i] - '0');
        }
    }
    return answer;
}
