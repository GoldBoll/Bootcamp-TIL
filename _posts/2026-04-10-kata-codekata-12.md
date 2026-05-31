---
title: "프로그래머스 — CodeKata 12"
date: 2026-04-10 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/12948>

```cpp
// 코드카타 12. 핸드폰 번호 가리기 (Lv.1)
// https://school.programmers.co.kr/learn/courses/30/lessons/12948

// 문제 설명
// 전화번호가 문자열 phone_number로 주어질 때,
// 전화번호의 뒷 4자리를 제외한 나머지 숫자를 전부 *로 가린 문자열을 반환.

// 제한사항
// phone_number의 길이: 4 이상 20 이하

// 입출력 예
// phone_number     | return
// "01033334444"    | "*******4444"
// "027778999"      | "*****8999"

#include <string>
#include <vector>

using namespace std;

string solution(string phone_number) {
    string answer = "";
    for(int i = 0; i < phone_number.size(); i++)
    {
        if(i < phone_number.size() - 4)
            answer += "*";
        else
            answer += phone_number[i];
    }
    return answer;
}
```

