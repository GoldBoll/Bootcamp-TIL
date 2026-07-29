// 프로그래머스 12928 - 약수의 합 (Lv.1)
// https://school.programmers.co.kr/learn/courses/30/lessons/12928

// 문제 설명
// 정수 n을 입력받아 n의 약수를 모두 더한 값을 return 한다.

// 제약 조건
// n은 0 이상 3000 이하인 정수

// Example
// Input : 12   Output: 28   (1 + 2 + 3 + 4 + 6 + 12)
// Input : 5    Output: 6    (1 + 5)

// 접근 — 약수는 짝으로 나온다 (i, n/i)
// n <= 3000이라 1부터 n까지 훑는 O(n)으로도 통과하지만, 약수의 짝 성질을 쓰면 O(sqrt n).
// 1) i가 n의 약수면 n / i도 반드시 약수다. 두 값의 곱이 n이므로 한쪽은 항상 sqrt(n) 이하.
//    따라서 i를 1부터 sqrt(n)까지만 돌면서 i와 n/i를 같이 더하면 모든 약수를 덮는다.
// 2) i * i == n인 완전제곱수는 i와 n/i가 같은 수라서 두 번 더하면 안 된다. 이때만 i 하나만 더한다.
// 3) 경계: n = 0이면 i * i <= 0 이 처음부터 거짓이라 루프가 안 돌고 0을 반환 —
//    "0으로 나누기"에 닿지 않는다. n = 1이면 i = 1에서 i * i == n 분기로 1만 더해 정답 1.
// 4) 조건은 i * i <= n으로 쓴다. sqrt(n)은 실수 오차로 완전제곱수 경계를 놓칠 수 있다.
// 시간 O(sqrt n), 공간 O(1)

#include <string>
#include <vector>

using namespace std;

int solution(int n) {
    int sum = 0;

    for (int i = 1; i * i <= n; i++) {
        if (n % i != 0) continue;

        if (i * i == n) sum += i;         // 완전제곱수의 가운데 약수는 한 번만
        else            sum += i + n / i; // 짝을 한 번에 처리
    }

    return sum;
}
