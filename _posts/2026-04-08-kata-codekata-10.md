---
title: "프로그래머스 — CodeKata 10"
date: 2026-04-08 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
description: "vector<int> arr에서 int divisor로 나누어 떨어지는 원소만 골라 오름차순 정렬해서 반환."
image: /assets/img/thumbs/programmers.svg
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/12910>

```cpp
// 코드카타 25. 나누어 떨어지는 숫자 배열 (Lv.1)
// https://school.programmers.co.kr/learn/courses/30/lessons/12910

// 문제 설명
// vector<int> arr에서 int divisor로 나누어 떨어지는 원소만 골라 오름차순 정렬해서 반환.
// 나누어 떨어지는 원소가 없으면 [-1] 반환.

// 제한사항
// arr의 길이: 1 이상 100 이하
// arr의 원소: 100 이하의 자연수
// divisor: 1 이상 10 이하의 자연수

// 입출력 예
// arr            | divisor | return
// [5, 9, 7, 10]  | 5       | [5, 10]
// [2, 36, 1, 3]  | 1       | [1, 2, 3, 36]
// [3, 2, 6]      | 10      | [-1]

#include <string>
#include <vector>
#include <algorithm>
#include <iterator>     // back_inserter
using namespace std;

// 풀이 1 - for 루프 + sort | 시간복잡도: O(n + k log k)
//vector<int> solution(vector<int> arr, int divisor) {
//    vector<int> answer;
//
//    for (size_t i = 0; i < arr.size(); i++)
//    {
//        if(arr[i] % divisor == 0)
//        {
//            answer.push_back(arr[i]);
//        }
//    }
//
//    if(answer.size() == 0)
//    {
//        answer.push_back(-1);
//    }
//    else
//    {
//        sort(answer.begin(), answer.end());
//    }
//
//    return answer;
//}

// 풀이 2 - copy_if + sort (STL 활용) | 시간복잡도: O(n + k log k)
vector<int> solution(vector<int> arr, int divisor) {
    vector<int> answer;

    copy_if(arr.begin(), arr.end(), back_inserter(answer),
            [divisor](int x){ return x % divisor == 0; });

    if(answer.empty())
    {
        answer.push_back(-1);
    }
    else
    {
        sort(answer.begin(), answer.end());
    }

    return answer;
}
```

> **오늘 배운 것** — `copy_if` + `back_inserter` + 람다 캡처로 for 루프 필터링을 한 줄로 대체할 수 있다. 결과가 비어 `-1`을 넣은 경우에는 정렬을 건너뛰도록 분기해야 한다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "배열에서 조건에 맞는 원소만 골라 정렬하면 시간복잡도는 어떻게 되나요?" → 필터링 O(n), 정렬 O(k log k), 전체 O(n + k log k), copy_if, back_inserter
{: .prompt-info }
