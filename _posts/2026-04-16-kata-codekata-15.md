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

> **오늘 배운 것** — 번갈아 나오는 패턴은 인덱스의 홀짝(`i % 2`)으로 분기하면 조건 하나로 처리할 수 있다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "반복되는 패턴 문자열을 만들 때 어떤 방식으로 접근하나요?" → 인덱스 홀짝 분기, 모듈러 연산, 문자열 누적, O(n) 순회
{: .prompt-info }

