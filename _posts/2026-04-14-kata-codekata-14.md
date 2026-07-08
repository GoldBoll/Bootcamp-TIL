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

