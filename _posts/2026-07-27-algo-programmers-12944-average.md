---
title: "프로그래머스 12944 - 평균 구하기 (Lv.1)"
date: 2026-07-27 21:30:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm", "math", "vector"]
render_with_liquid: false
description: "핵심 접근 — 합 누적 후 분자를 double로 올려 정수 나눗셈·unsigned 승격 동시 회피"
image: /assets/img/thumbs/cards/2026-07-27-algo-programmers-12944-average.svg
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/12944>

```cpp
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
```

## 정리

- 로직은 한 줄짜리 합 누적이고, **문제의 실질은 나눗셈 한 줄의 타입 규칙**이다. 반환형이 `double`이라는 사실은 나눗셈 결과를 보호해 주지 않는다. `sum / arr.size()`가 이미 정수 영역에서 계산을 끝낸 뒤에 그 결과를 `double`로 올리기 때문에, 잘린 값이 잘린 상태로 반환된다. 변환은 **연산 후가 아니라 연산 전에** 걸어야 한다.
- 더 위험한 쪽은 정수 나눗셈이 아니라 **`size()`의 unsigned 승격**이다. `arr.size()`는 `size_t`(x64에서 64비트 unsigned)이므로, 산술 변환 규칙에 따라 `int sum`이 `size_t`로 올라간다. 음수 합은 이때 2의 보수 그대로 거대한 양수로 재해석된다. `[-1,-1]`을 캐스팅 없이 계산하면 `-1`이 아니라 **9.223372037e+18**이 나오는 것을 실측으로 확인했다. 정수 나눗셈은 값이 "조금" 틀리지만 이쪽은 자릿수째로 틀린다.
- 두 함정을 각각 막을 필요는 없다. `(double)sum`으로 분자만 올리면 분모 `size_t`도 `double`로 변환되면서 실수 나눗셈이 되고, unsigned 승격 자체가 발생하지 않는다. **캐스팅 한 개가 두 버그를 동시에 닫는다**는 점이 이 문제의 요점.
- 자료형 상한 점검: 원소 100개 x 절댓값 10,000 = 1,000,000으로 `int`(약 21.4억) 대비 여유가 크다. 누적 변수는 항상 이 계산을 먼저 하고 폭을 정한다 — 곱셈이 섞이는 12949 행렬의 곱셈처럼 상한이 빠르게 커지는 문제와 같은 습관.
- 관련 계열: 12931 자릿수 더하기, 12928 약수의 합처럼 "누적 후 한 번 처리"하는 문제는 로직이 아니라 **누적 변수의 타입과 마지막 연산**이 정답을 가른다. 부동소수점 비교가 필요할 때는 `==`가 아니라 `fabs(a - b) < 1e-9` 형태로 판정한다.
- 검증: 예제 2개(2.5, 5)와 경계 케이스 — 원소 1개(`[7]` → 7), 음수 합(`[-1,-1]` → -1), 최대 입력 100개 전부 10,000 / -10,000(→ 10000 / -10000) 통과. 캐스팅을 뺀 버전과 나란히 돌려 unsigned 승격 결과까지 실측 (MSVC `/std:c++17` 컴파일·실행).

> **핵심 요약** — 반환형이 `double`이어도 `sum / arr.size()`는 이미 정수 영역에서 계산이 끝난다. 게다가 `size()`가 unsigned라 음수 합은 자릿수째로 깨진다(`[-1,-1]` → 9.2e18 실측). `(double)sum`으로 분자만 올리면 실수 나눗셈과 unsigned 승격 회피가 한 번에 해결된다.
{: .prompt-tip }
