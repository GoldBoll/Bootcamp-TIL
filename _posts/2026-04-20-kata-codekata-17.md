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

약수의 개수가 짝수면 그 수를 더하고, 홀수면 빼는 문제. `left`부터 `right`까지 각 수마다 2부터 자기 자신까지 나머지 연산으로 약수를 직접 세고(약수 1은 `count = 1` 초기값으로 미리 포함), 개수의 홀짝에 따라 `answer`에 더하거나 뺐다.

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

> **핵심 요약** — 약수 개수는 2부터 i까지 나머지 연산으로 세면 되고, 약수 1을 초기값 `count = 1`로 처리하면 루프 시작을 2로 당길 수 있다. 이후 `count % 2` 홀짝 분기로 더할지 뺄지 결정한다.
{: .prompt-tip }

