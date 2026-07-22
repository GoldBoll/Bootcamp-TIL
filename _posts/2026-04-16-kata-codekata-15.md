---
title: "프로그래머스 — CodeKata 15"
date: 2026-04-16 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/programmers.svg
description: "문제 요약 — 프로그래머스 입문 문제 — 기초 구현 풀이"
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

인덱스의 홀짝만 보면 되는 문제라, 반복문에서 `i % 2`로 "수"와 "박"을 번갈아 붙이는 것으로 끝냈다.

