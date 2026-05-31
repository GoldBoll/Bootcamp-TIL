---
title: "프로그래머스 — CodeKata 16"
date: 2026-04-17 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/70128>

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

