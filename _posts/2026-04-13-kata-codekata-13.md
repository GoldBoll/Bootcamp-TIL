---
title: "프로그래머스 — CodeKata 13"
date: 2026-04-13 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
description: "0부터 9까지의 숫자 중 일부가 numbers 배열에 담겨 있을 때,"
image: /assets/img/thumbs/programmers.svg
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/86051>

```cpp
// 코드카타 13. 없는 숫자 더하기 (Lv.1)
// https://school.programmers.co.kr/learn/courses/30/lessons/86051

// 문제 설명
// 0부터 9까지의 숫자 중 일부가 numbers 배열에 담겨 있을 때,
// numbers에서 찾을 수 없는 0부터 9까지의 숫자를 모두 찾아 더한 수를 반환.

// 제한사항
// 1 ≤ numbers의 길이 ≤ 9
// 0 ≤ numbers의 모든 원소 ≤ 9
// numbers의 모든 원소는 서로 다릅니다.

// 입출력 예
// numbers              | result
// [1, 2, 3, 4, 6, 7, 8, 0] | 14
// [5, 8, 4, 0, 6, 7, 9]    | 6

#include <string>
#include <vector>

using namespace std;

int solution(vector<int> numbers) {
    int answer = 0;

    for(auto n : numbers)
    {
        answer += n;
    }

    return 45-answer;
}
```

