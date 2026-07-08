---
title: "프로그래머스 — CodeKata 17"
date: 2026-04-20 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/programmers.svg
description: "문제 요약 — 프로그래머스 입문 문제 — 기초 구현 풀이"
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/77884>

```cpp
//https://school.programmers.co.kr/learn/courses/30/lessons/77884

using namespace std;

int solution(int left, int right) {
    int answer = 0;
    
    for(int i = left; i <= right; ++i) {
        int count = 1;
        for(int j = 2; j <= i; ++j) {
            if(i % j == 0) count++;
        }
        if(count % 2 == 0) answer += i;
        else answer -= i;
    }
    return answer;
}
```

