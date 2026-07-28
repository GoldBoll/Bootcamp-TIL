---
title: "프로그래머스 — CodeKata 06"
date: 2026-03-03 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/cards/2026-03-03-kata-codekata-06.svg
description: "문제 요약 — 다음에 올 숫자"
---

등차수열 아니면 등비수열이 보장되는 배열에서 다음 항을 구하는 문제. 앞 세 원소만 보면 판별이 끝난다 — 첫 두 항의 차와 그다음 차가 같으면 등차, 아니면 등비다. 등차면 마지막 원소에 공차를 더하고, 등비면 공비를 곱한다. 제한사항에서 공비가 0이 아닌 정수임을 보장하므로 `common[1] / common[0]` 정수 나눗셈으로 공비를 구해도 안전하다.

```cpp
//6.다음에 올 숫자
// 등차수열 혹은 등비수열 common이 매개변수로 주어질 때, 마지막 원소 다음으로 올 숫자를 return 하도록 solution 함수를 완성해보세요.

// 제한사항
// 2 < common의 길이 < 1,000
// -1,000 < common의 원소 < 2,000
// common의 원소는 모두 정수입니다.
// 등차수열 혹은 등비수열이 아닌 경우는 없습니다.
// 등비수열인 경우 공비는 0이 아닌 정수입니다.

#include <string>
#include <vector>
using namespace std;

int solution(vector<int> common) 
{
    // 등차수열 판별: 앞의 두 차와 그다음 차가 같으면 등차
    if ((common[1] - common[0]) == (common[2] - common[1])) 
    {
        int d = common[1] - common[0]; // 공차
        return common.back() + d; // 마지막 + 공차
    }  
    else 
    {
        int r = common[1] / common[0]; // 공비 (0 아님 보장)
        return common.back() * r; // 마지막 * 공비
    }
}
```

> **핵심 요약** — 수열 전체를 훑지 않아도 앞 세 원소 비교만으로 등차/등비를 판별할 수 있고, "공비는 0이 아닌 정수"라는 제한사항이 정수 나눗셈을 안심하고 쓸 수 있는 근거가 된다. 제한사항이 곧 구현을 단순하게 만드는 힌트다.
{: .prompt-tip }

