---
title: "프로그래머스 — CodeKata 12"
date: 2026-04-10 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
description: "전화번호가 문자열 phone_number로 주어질 때,"
image: /assets/img/thumbs/programmers.svg
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

빈 문자열에 문자를 하나씩 이어 붙이면서, 현재 인덱스가 `길이 - 4`보다 앞이면 `*`, 그 뒤면 원래 숫자를 넣는 방식으로 풀었다. 뒷 4자리를 따로 잘라 붙이는 방법도 있지만, 인덱스 비교 한 번으로 끝나는 쪽이 더 단순했다.

> **핵심 요약** — 문자열 마스킹은 "몇 번째부터 가릴지"를 인덱스 조건 하나(`i < size() - 4`)로 표현하면 반복문 한 번에 끝난다.
{: .prompt-tip }

