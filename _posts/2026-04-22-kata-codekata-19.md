---
title: "프로그래머스 — CodeKata 19"
date: 2026-04-22 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/programmers.svg
description: "문제 요약 — 프로그래머스 입문 문제 — 기초 구현 풀이"
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/82612>

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

