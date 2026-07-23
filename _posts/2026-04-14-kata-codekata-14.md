---
title: "프로그래머스 — CodeKata 14"
date: 2026-04-14 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/programmers.svg
description: "문제 요약 — 프로그래머스 입문 문제 — 기초 구현 풀이"
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/12935>

```cpp
//https://school.programmers.co.kr/learn/courses/30/lessons/12935

// #include <string>
// #include <vector>
// #include <algorithm>
// using namespace std;

// vector<int> solution(vector<int> arr) {
//     vector<int> answer;
//     if(arr.empty() || arr.size() == 1)
//     {
//         return {-1};
//     }
//     int min = *min_element(arr.begin(), arr.end());
    
//     for(auto& n : arr)
//     {
//         if(n != min) answer.push_back(n);
//     }
    
//     return answer;
// }



#include <string>
#include <vector>
#include <algorithm>
using namespace std;

vector<int> solution(vector<int> arr) {
    vector<int> answer;
    if(arr.empty() || arr.size() == 1)
    {
        return {-1};
    }
    arr.erase(min_element(arr.begin(), arr.end()));
    
    answer = arr;
    
    return answer;
}
```

주석으로 남겨 둔 첫 풀이는 최솟값과 다른 원소만 새 벡터에 골라 담는 방식이었다. 최종 풀이는 `min_element`가 반복자를 반환한다는 점을 이용해, 그 반복자를 `erase`에 바로 넘겨 원소 하나를 지우는 쪽으로 줄였다.

> **오늘 배운 것** — `min_element`는 최솟값의 위치(반복자)를 돌려주므로, 값을 다시 찾을 필요 없이 `erase`에 바로 넘겨 한 줄로 제거할 수 있다. 원소를 골라 새 벡터에 담는 방식보다 코드가 짧아진다.
{: .prompt-tip }


