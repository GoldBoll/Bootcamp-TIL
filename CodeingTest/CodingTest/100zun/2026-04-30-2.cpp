// LeetCode 50 - Pow(x, n) (Medium)
// https://leetcode.com/problems/powx-n/

// 문제 설명
// pow(x, n) 구현 — x의 n제곱을 반환

// 제약 조건
// -100.0 < x < 100.0
// -2^31 <= n <= 2^31-1  (n이 음수일 수 있음)
// n은 정수
// x != 0 이거나 n > 0
// -10^4 <= x^n <= 10^4

// 예시
// x = 2.00000, n =  10 →  1024.00000
// x = 2.10000, n =   3 →     9.26100
// x = 2.00000, n =  -2 →     0.25000  (2^-2 = 1/4 = 0.25)

// 풀이 비교
// 단순 반복        : 시간 O(n)      — n이 2^31이면 TLE
// 분할 정복 (재귀)  : 시간 O(log n)  — x^n = x^(n/2) * x^(n/2), n 홀수면 x 한 번 더 곱함
// 빠른 거듭제곱 반복 : 시간 O(log n)  — 비트 단위 처리, 스택 없음 → 최적
// 주의: n = INT_MIN (-2^31) 일 때 -n 오버플로우 → long long으로 변환 필요

#include <cmath>
using namespace std;

class Solution {
public:
    double myPow(double x, int n) {
        double answer = 0.0;

        return answer;
    }
};
