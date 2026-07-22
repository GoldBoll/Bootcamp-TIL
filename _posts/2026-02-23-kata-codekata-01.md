---
title: "프로그래머스 — CodeKata 01"
date: 2026-02-23 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/programmers.svg
description: "문제 요약 — 프로그래머스 입문 문제 — 기초 구현 풀이"
---

첫 번째 코드카타. 두 정수 num1, num2를 받아 차를 반환하는 프로그래머스 입문 문제다.

```cpp

#include <string>
#include <vector>
using namespace std;

int solution(int num1, int num2) {
    
    return num1 - num2;
}
```

> **오늘 배운 것** — 두 정수의 차를 반환하는 기초 구현 문제. main 함수 없이 solution 함수의 반환값으로 채점되는 프로그래머스 풀이 형태에 익숙해지는 것이 목적이었다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "프로그래머스의 solution 함수 기반 풀이는 로컬에서 짜는 코드와 무엇이 다른가요?" → main 함수 없음, solution 반환값으로 채점, 함수 시그니처 준수, 테스트 케이스 비교
{: .prompt-info }

