---
title: "프로그래머스 — CodeKata 04"
date: 2026-02-26 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/programmers.svg
description: "문제 요약 — 나이출력"
---

2022년 기준 나이 `age`로 출생 연도를 구하는 문제. 태어난 해에 이미 1살이므로 단순히 `2022 - age`가 아니라 1을 더해 보정해야 한다.

```cpp
//4.나이출력
// 머쓱이는 선생님이 몇 년도에 태어났는지 궁금해졌습니다. 2022년 기준 선생님의 나이 age가 주어질 때, 선생님의 출생 연도를 return 하는 solution 함수를 완성해주세요

// 제한사항
// 0 < age ≤ 120
// 나이는 태어난 연도에 1살이며 매년 1월 1일마다 1살씩 증가합니다.

int solution(int age) {
    int answer = 0;

    answer = 2022 - age + 1;
    return answer;
}
```

> **핵심 요약** — 태어난 해에 1살로 세는 나이 체계에서는 `출생 연도 = 기준 연도 - 나이 + 1`. 빼기만 하고 +1 보정을 빼먹기 쉬운, 전형적인 하나 차이(off-by-one) 문제다.
{: .prompt-tip }
