---
title: "프로그래머스 120817 - 배열의 평균값 (Lv.0)"
date: 2026-07-15 21:30:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm", "vector", "stl", "cpp"]
render_with_liquid: false
description: "핵심 접근 — 합은 int로 정확히, 나눌 때만 double 캐스팅"
image: /assets/img/thumbs/cards/2026-07-15-algo-programmers-120817-array-average.svg
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/120817>

```cpp
// 프로그래머스 120817 - 배열의 평균값 (Lv.0)
// https://school.programmers.co.kr/learn/courses/30/lessons/120817

// 문제 설명
// 정수 배열 numbers가 매개변수로 주어진다. numbers 원소의 평균값을 반환하라.

// 제약 조건
// 0 <= numbers의 원소 <= 1,000
// 1 <= numbers의 길이 <= 100
// 정답의 소수 부분이 .0 또는 .5인 경우만 입력으로 주어진다.

// Example
// Input : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
// Output: 5.5   (합 55 / 개수 10)
//
// Input : [89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99]
// Output: 94.0  (합 1034 / 개수 11)

// 접근 — 정수로 모으고, 나누는 순간에만 실수로
// 함정은 알고리즘이 아니라 자료형 두 군데다.
// 1) 합계: accumulate의 초기값을 0(int)으로 주면 누적도 int로 진행된다. 원소를 double로
//    바꿔가며 더하면 부동소수 오차가 쌓이지만, 정수로 모으면 합은 항상 정확하다.
//    상한이 100 x 1000 = 100,000이라 int로 충분.
// 2) 나눗셈: vector::size()의 반환형은 size_t(부호 없는 정수)다. sum / numbers.size()로
//    쓰면 int인 sum이 size_t로 승격돼 "정수 나눗셈"이 되고 5.5가 5로 잘린다.
//    한쪽만 double로 캐스팅하면 나머지 한쪽도 double로 승격돼 실수 나눗셈이 된다.
// 시간 O(n), 공간 O(1)

#include <string>
#include <vector>
#include <numeric>

using namespace std;

double solution(vector<int> numbers) {
    int sum = accumulate(numbers.begin(), numbers.end(), 0);   // 최대 100 * 1000 = 100,000 — int로 충분
    return static_cast<double>(sum) / numbers.size();          // size()가 size_t라 캐스팅 없으면 정수 나눗셈
}
```

## 정리

- **`accumulate`의 초기값이 누적 자료형을 결정한다.** `0`을 주면 int로, `0.0`을 주면 double로, `0LL`을 주면 long long으로 누적된다. 원소가 정수인데 결과만 실수인 문제는 **정수로 모아 마지막에 한 번만 나누는 것**이 정확도·성능 양쪽에서 유리하다. 실수로 누적하면 덧셈마다 반올림 오차가 생긴다.
- **`size()`는 `size_t`(부호 없는 64비트)** 라서 `sum / numbers.size()`는 int를 unsigned로 끌어올린 뒤 정수 나눗셈을 한다. 5.5가 5로 잘리고, 반환형이 double이어도 이미 잘린 값이 승격될 뿐이다. `static_cast<double>` 한쪽만 붙이면 다른 피연산자도 double로 승격돼 해결된다.
- **상한 점검**: 원소 1,000 × 길이 100 = 100,000. int(약 21억) 대비 한참 아래라 `long long`이 필요 없다. 반대로 원소가 10^9급이었다면 int 합이 넘쳤을 것이고, 그때는 `accumulate(..., 0LL)`이 답이다.
- **"소수 부분이 .0 또는 .5"라는 제약의 의미** — 0.5는 2의 거듭제곱 분수라 이진 부동소수로 오차 없이 표현된다. 그래서 이 문제에 한해 `== 5.5` 같은 등호 비교가 안전하다. 일반적인 평균(1/3 등)은 이진수로 딱 떨어지지 않으므로 등호 대신 `fabs(a - b) < eps`를 써야 한다.
- 같은 계열로 묶어 두면 좋은 것은 **"정수로 계산하다 마지막에만 실수로 바꾸는"** 문제군이다. 평균·비율·할인율처럼 나눗셈이 한 번 끼는 문제는 전부 이 축에서 갈린다 — 나누는 시점을 뒤로 미룰수록 누적 오차가 줄고, 아예 나누지 않고 양변에 분모를 곱해 정수 비교로 바꾸면 오차가 사라진다.
- 검증: 예제 2개(5.5, 94.0)와 경계 케이스(길이 1의 `[0]` → 0.0, 길이 100 전부 1000 → 1000.0) 통과 (MSVC `/std:c++17 /utf-8` 컴파일·실행).

> **핵심 요약** — 정수 배열의 평균은 합을 int로 정확히 모으고 나누는 순간에만 double로 캐스팅한다. `size()`가 `size_t`라 캐스팅을 빠뜨리면 정수 나눗셈으로 소수부가 통째로 잘린다.
{: .prompt-tip }
