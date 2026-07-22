---
title: "프로그래머스 — CodeKata 11"
date: 2026-04-09 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
description: "정수 배열 absolutes와 부호 배열 signs가 주어질 때,"
image: /assets/img/thumbs/programmers.svg
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/76501>

```cpp
// 코드카타 11. 절댓값 더하기 (Lv.1)
// https://school.programmers.co.kr/learn/courses/30/lessons/76501

// 문제 설명
// 정수 배열 absolutes와 부호 배열 signs가 주어질 때,
// signs[i]가 true이면 absolutes[i]에 양수 부호, false이면 음수 부호를 붙여 모두 더한 값을 반환.

// 제한사항
// absolutes의 길이: 1 이상 1,000 이하
// absolutes의 원소: 1 이상 1,000 이하의 정수
// signs의 길이 = absolutes의 길이
// signs[i]: true이면 양수, false이면 음수

// 입출력 예
// absolutes  | signs             | return
// [4, 7, 12] | [true, false, true]  | 9
// [1, 2, 3]  | [false, false, true] | 0

#include <stdio.h>
#include <stdbool.h>
#include <stdlib.h>

// absolutes_len은 배열 absolutes의 길이입니다.
// signs_len은 배열 signs의 길이입니다.
int solution(int absolutes[], size_t absolutes_len, bool signs[], size_t signs_len) {

    int answer = 0;

    for (int i = 0; i < absolutes_len; i++)
    {
        if (signs[i])
            answer += absolutes[i];
        else
            answer -= absolutes[i];
    }
    return answer;
}
```

부호 배열을 따로 변환하지 않고, 순회하면서 `signs[i]`가 true면 더하고 false면 빼는 식으로 한 번에 합산했다. 이번 문제는 C 스타일 시그니처(`int[]` + `size_t` 길이 인자)라서, `vector`가 아니라 배열과 길이를 따로 받는 형태에 맞춰 작성했다.

> **오늘 배운 것** — 부호를 붙여 더하는 문제는 조건에 따라 `+=`/`-=`만 갈라주면 별도 변환 배열 없이 한 번의 순회로 끝난다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "C 스타일 배열 인자와 vector의 차이는 무엇인가요?" → 배열은 포인터로 전달, 길이 정보 별도 인자(size_t), vector는 크기 내장, 범위 기반 순회, 경계 안전성
{: .prompt-info }

