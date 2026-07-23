---
title: "프로그래머스 — CodeKata 20"
date: 2026-04-28 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/programmers.svg
description: "문제 요약 — 프로그래머스 입문 문제 — 기초 구현 풀이"
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/12940>

최대공약수·최소공배수 문제. gcd는 유클리드 호제법(두 수를 나머지 연산으로 계속 줄여 나가면 gcd만 남는 성질)으로 구하고, 최소공배수는 두 수의 곱을 gcd로 나눈 값이라는 관계식을 이용해 `n / gcd * m`으로 계산했다.

```cpp
//https://school.programmers.co.kr/learn/courses/30/lessons/12940

#include <string>
#include <vector>

using namespace std;

vector<int> solution(int n, int m) {
    vector<int> answer;

    int num1 = n, num2 = m;
    while (num2 != 0)
    {
        int temp = num2;
        num2 = num1 % num2;
        num1 = temp;
    }
    int max = num1;
    int min = n / max * m;

    answer.push_back(max);
    answer.push_back(min);

    return answer;
}
```

> **오늘 배운 것** — 유클리드 호제법 while 루프 몇 줄이면 gcd가 나오고, lcm은 `gcd × lcm = n × m` 관계식으로 바로 얻는다. 두 값을 따로 계산할 필요가 없다.
{: .prompt-tip }


