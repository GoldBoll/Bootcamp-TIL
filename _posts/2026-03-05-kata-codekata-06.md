---
title: "6.다음에 올 숫자"
date: 2026-03-05 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
---

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

