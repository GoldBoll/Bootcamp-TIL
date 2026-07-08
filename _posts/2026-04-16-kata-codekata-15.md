---
title: "프로그래머스 — CodeKata 15"
date: 2026-04-16 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/programmers.svg
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/12922>

```cpp
//https://school.programmers.co.kr/learn/courses/30/lessons/12922

#include <string>
#include <vector>

using namespace std;

string solution(int n) {
    string answer = "";

    for (int i = 0; i < n ; i++)
    {
        if(i%2 == 0)
        {
            answer += "수";
        }
        else
            answer += "박";
    }
    return answer;
}
```

