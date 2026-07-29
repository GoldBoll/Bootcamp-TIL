// 프로그래머스 12944 - 평균 구하기 (Lv.1)
// https://school.programmers.co.kr/learn/courses/30/lessons/12944

// 문제 설명
// 정수를 담고 있는 배열 arr의 평균값을 return 한다.

// 제약 조건
// arr은 길이 1 이상, 100 이하인 배열
// arr의 원소는 -10,000 이상 10,000 이하인 정수

// Example
// Input : [1,2,3,4]   Output: 2.5
// Input : [5,5]       Output: 5

// 접근 — 합 누적 후 실수 나눗셈
// 1) 범위 기반 for로 원소를 전부 더한다. 상한이 100 x 10,000 = 1,000,000이라 int로 충분.
// 2) 나눗셈에서 두 함정을 동시에 피해야 한다.
//    - 정수 / 정수는 정수 나눗셈이라 2.5가 2로 잘린다.
//    - arr.size()는 size_t(unsigned)라서 int sum이 unsigned로 승격된다.
//      sum이 음수면 -2 / 2u 가 거대한 양수가 되어 답이 완전히 깨진다.
//    분자를 double로 캐스팅하면 분모도 double로 변환되므로 두 함정이 한 번에 해결된다.
// 시간 O(n), 공간 O(1)

#include <string>
#include <vector>

using namespace std;

double solution(vector<int> arr) {
    int sum = 0;                          // 최대 1,000,000 — int 상한 안쪽
    for (int x : arr) sum += x;

    return (double)sum / arr.size();      // 분자를 실수로 올려 정수 나눗셈·unsigned 승격 동시 회피
}
