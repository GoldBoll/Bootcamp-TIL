---
title: "프로그래머스 — CodeKata 09"
date: 2026-04-08 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
description: "vector<string> seoul에서 'Kim'의 인덱스를 찾아 '김서방은 x에 있다'를 반환 — find + 이터레이터 거리 계산"
image: /assets/img/thumbs/programmers.svg
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/12919>

```cpp
// 코드카타 24. 서울에서 김서방 찾기 (Lv.1)
// https://school.programmers.co.kr/learn/courses/30/lessons/12919

// 문제 설명
// vector<string> seoul에서 "Kim"의 인덱스(위치) x를 찾아,
// "김서방은 x에 있다" 형식의 문자열을 반환

// 제한사항
// seoul의 길이: 1 이상 1000 이하
// 원소 길이: 1 이상 20 이하
// "Kim"은 반드시 한 번만 존재

// 입출력 예
// seoul          | return
// ["Jane", "Kim"] | "김서방은 1에 있다"

// 핵심 포인트
// - vector에서 특정 문자열의 인덱스를 찾는 문제
// - C++에서 string 비교는 == 연산자 직접 사용 가능
// - std::find() + 포인터 연산으로 한 줄 풀이 가능
// - 두 풀이 모두 선형 탐색 → 시간복잡도 O(n)

#include <string>
#include <vector>
#include <algorithm>
using namespace std;

// 풀이 1 - for 루프 (작성한 코드) | 시간복잡도: O(n)
//string solution(vector<string> seoul) {
//    int idx = 0;
//    for (int i = 0; i < seoul.size(); i++) {
//        if (seoul[i] == "Kim") {
//            idx = i;
//            break;
//        }
//    }
//    return "김서방은 " + to_string(idx) + "에 있다";
//}

// 풀이 2 - find + 포인터 연산 (STL 활용) | 시간복잡도: O(n)
// find()는 이터레이터(메모리 주소 객체)를 반환하므로
// - seoul.begin()으로 두 이터레이터 사이의 거리(칸 수)를 계산해 정수 인덱스로 변환
string solution(vector<string> seoul) {
    int idx = find(seoul.begin(), seoul.end(), "Kim") - seoul.begin();
    return "김서방은 " + to_string(idx) + "에 있다";
}
```

> **오늘 배운 것** — `find()`는 정수 인덱스가 아니라 이터레이터를 반환하므로, `begin()`을 빼서 두 위치 사이의 거리(칸 수)를 인덱스로 변환한다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "std::find의 반환값을 인덱스로 바꾸려면 어떻게 하나요?" → 이터레이터 반환, begin()과의 거리, 정수 인덱스 변환, 선형 탐색 O(n)
{: .prompt-info }
