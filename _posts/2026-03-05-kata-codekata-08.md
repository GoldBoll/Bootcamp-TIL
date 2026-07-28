---
title: "프로그래머스 — CodeKata 08"
date: 2026-03-05 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
description: "연속된 세 개의 정수를 더해 12가 되는 경우는 3, 4, 5입니다. 두 정수 num과 total이 주어집니다. 연속된 수 num개를 더한 값이 total이 될 때, 정수 배열을 오름차순으로 담아 return하도록 solution함수를 완성해보세요."
image: /assets/img/thumbs/cards/2026-03-05-kata-codekata-08.svg
---

연속된 num개 수의 합이 total이 되는 수열을 구하는 문제. 케이스를 나누는 대신 등차수열 합 공식에서 첫 항 `start = total/num - (num-1)/2`를 유도해, 분기 없이 start부터 num개를 채우는 방식으로 풀었다.

```cpp
// 8. 연속된 수의 합
// 문제 설명
// 연속된 세 개의 정수를 더해 12가 되는 경우는 3, 4, 5입니다. 두 정수 num과 total이 주어집니다. 연속된 수 num개를 더한 값이 total이 될 때, 정수 배열을 오름차순으로 담아 return하도록 solution함수를 완성해보세요.

// 제한사항
// 1 ≤ num ≤ 100
// 0 ≤ total ≤ 1000
// num개의 연속된 수를 더하여 total이 될 수 없는 테스트 케이스는 없습니다.

#include <string>
#include <vector>
using namespace std;

vector<int> solution(int num, int total) 
{
    vector<int> answer;

    int start = total / num - (num - 1) / 2;

    for (int i = 0; i < num; i++) 
    {
        answer.push_back(start + i);
    }

    return answer;
}
```

> **핵심 요약** — 연속 수열 문제는 첫 항만 구하면 나머지는 start+i로 결정된다. 등차수열 합 공식을 start에 대해 정리하면 `start = total/num - (num-1)/2`로 분기 없는 단일 식이 나온다.
{: .prompt-tip }

