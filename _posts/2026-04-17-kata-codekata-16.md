---
title: "프로그래머스 — CodeKata 16"
date: 2026-04-17 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/cards/2026-04-17-kata-codekata-16.svg
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

