---
title: "프로그래머스 — CodeKata 19"
date: 2026-04-22 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/programmers.svg
description: "부족한 금액 계산하기 — N번째 이용료가 price×N으로 늘어날 때 부족한 금액을 for문 누적과 등차수열 합 공식 두 가지로 푼 풀이"
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/82612>

for문으로 누적하는 풀이와 등차수열 합 공식으로 O(1)에 끝내는 풀이 두 가지다. 어느 쪽이든 `price * i` 곱셈이 int 범위를 넘을 수 있어서 `(long long)` 캐스팅을 먼저 해주는 게 핵심이다.

```cpp
//https://school.programmers.co.kr/learn/courses/30/lessons/82612

#include <string>
#include <vector>

using namespace std;

// for문 풀이
long long solution(int price, int money, int count)
{
    long long answer = 0;
    long long total = 0;

    for (int i = 1; i <= count; i++)
    {
        total += (long long)price * i;
    }

    answer = total - money;
    return answer > 0 ? answer : 0;
}

// 등차수열 합 공식 풀이 — O(1)
// long long solution(int price, int money, int count)
// {
//     long long total = (long long)price * count * (count + 1) / 2;
//     long long diff = total - money;
//     return diff > 0 ? diff : 0;
// }
```

> **핵심 요약** — 회차마다 price×N으로 늘어나는 요금의 누적 합은 등차수열 합 공식 `price * count * (count + 1) / 2`로 반복문 없이 O(1)에 구할 수 있다. 곱셈 중간값이 int 범위를 넘지 않도록 `(long long)` 캐스팅을 곱셈 앞에 붙이는 것까지가 풀이의 완성이다.
{: .prompt-tip }


