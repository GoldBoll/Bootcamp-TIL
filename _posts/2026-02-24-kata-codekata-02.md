---
title: "프로그래머스 — CodeKata 02"
date: 2026-02-24 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/programmers.svg
description: "문제 요약 — 프로그래머스 입문 문제 — 기초 구현 풀이"
---

프로그래머스 입문 문제. 두 정수 `num1`, `num2`를 받아 곱을 반환한다.

```cpp

int solution(int num1, int num2) {
    
    return num1*num2;
}
```

> **오늘 배운 것** — 두 정수를 곱해 그대로 반환하는 기초 구현. solution 함수의 매개변수·반환값 구조에 손을 익히는 단계다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "int끼리 곱셈할 때 주의할 점은 무엇인가요?" → 오버플로우, int 표현 범위, long long 승격, 제한사항 확인
{: .prompt-info }
