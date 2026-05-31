---
title: "4.나이출력"
date: 2026-02-26 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
---

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

