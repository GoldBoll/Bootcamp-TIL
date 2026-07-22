---
title: "프로그래머스 — CodeKata 16"
date: 2026-04-17 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/programmers.svg
description: "문제 요약 — 프로그래머스 입문 문제 — 기초 구현 풀이"
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/70128>

두 배열에서 같은 인덱스 원소끼리 곱해 전부 더하면 되는 문제라, 반복문 하나로 누적하면 끝난다.

```cpp
//https://school.programmers.co.kr/learn/courses/30/lessons/70128

#include <string>
#include <vector>

using namespace std;

int solution(vector<int> a, vector<int> b) {
    int answer = 0;
    
        for(int i = 0; i < a.size(); i++)
            answer += a[i] * b[i];
    return answer;
}
```

> **오늘 배운 것** — 두 배열의 같은 인덱스끼리 곱해 누적하는 단일 순회로 답이 나온다. 요구가 단순할 때는 반복문 하나로 끝내는 게 가장 깔끔하다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "두 배열을 인덱스로 짝지어 계산할 때 시간 복잡도는 어떻게 되나요?" → O(n), 단일 순회, 인덱스 접근 O(1), 누적 합
{: .prompt-info }

