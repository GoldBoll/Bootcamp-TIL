---
title: "프로그래머스 — CodeKata 03"
date: 2026-02-25 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/programmers.svg
description: "문제 요약 — 프로그래머스 입문 문제 — 기초 구현 풀이"
---

프로그래머스 입문 문제. 두 정수 `num1`, `num2`를 받아 나눈 몫을 반환한다.

```cpp
int solution(int num1, int num2) {
    
    return num1 / num2;
}
```

> **오늘 배운 것** — C++에서 정수끼리 나누면 소수부를 버린 몫이 남는다. 별도 캐스팅 없이 `num1 / num2` 한 줄로 몫을 구할 수 있다.
{: .prompt-tip }
