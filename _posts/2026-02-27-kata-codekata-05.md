---
title: "프로그래머스 — CodeKata 05"
date: 2026-02-27 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
description: "정수 num1과 num2가 매개변수로 주어집니다. 두 수가 같으면 1 다르면 -1을 retrun하도록 solution 함수를 완성해주세요."
image: /assets/img/thumbs/programmers.svg
---

두 정수가 같으면 1, 다르면 -1을 반환하는 문제. 비교 연산자 `==`로 분기해서 처리했다.

```cpp
//5.숫자 비교하기
// 문제 설명
// 정수 num1과 num2가 매개변수로 주어집니다. 두 수가 같으면 1 다르면 -1을 retrun하도록 solution 함수를 완성해주세요.

// 제한사항
// 0 ≤ num1 ≤ 10,000
// 0 ≤ num2 ≤ 10,000

int solution(int num1, int num2) {
    int answer = 0;

    if (num1 == num2) {
        answer = 1;
    }
    else {
        answer = -1;
    }

    return answer;
}
```

> **오늘 배운 것** — 비교 연산자(`==`)로 조건을 판별해 경우에 따라 다른 값을 반환하는 기본 분기 패턴을 연습했다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "비교 연산자 ==와 대입 연산자 =를 혼동하면 어떤 문제가 생기나요?" → 조건문 안 대입은 항상 참/거짓 오판, 컴파일 경고 확인, 의도 명확한 비교식 작성
{: .prompt-info }
