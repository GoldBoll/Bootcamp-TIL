// 프로그래머스 Lv.1 - 콜라 문제
// https://school.programmers.co.kr/learn/courses/30/lessons/132267
//
// [문제]  빈 병 a개를 주면 콜라 b병을 주는 마트. 빈 병 n개로 받을 수 있는 콜라 수 반환
// [제약]  1 ≤ b < a ≤ n ≤ 1,000,000 / 정답은 int 범위 내
// [입출력]  a=2,b=1,n=20 → 19 / a=3,b=1,n=20 → 9
//
// 풀이: 보유 병 n이 a 이상인 동안 교환 반복.
//        교환 횟수 n/a, 받는 콜라 (n/a)*b, 남는 병 n%a + 받은 콜라 — O(log n)

#include <string>
#include <vector>

using namespace std;

int solution(int a, int b, int n) {
    int answer = 0;
    while (n >= a) {
        int exchange = n / a;
        answer += exchange * b;
        n = n % a + exchange * b;
    }
    return answer;
}
