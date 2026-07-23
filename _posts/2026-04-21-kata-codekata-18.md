---
title: "프로그래머스 — CodeKata 18"
date: 2026-04-21 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
image: /assets/img/thumbs/programmers.svg
description: "프로그래머스 모의고사 — 수포자 3인의 찍기 패턴을 나머지 연산으로 순회하며 점수를 비교하는 완전탐색 풀이"
---

> 출처: <https://school.programmers.co.kr/learn/courses/30/lessons/42840>

```cpp
//https://school.programmers.co.kr/learn/courses/30/lessons/42840
//
// [문제 설명] 모의고사
// 수포자는 수학을 포기한 사람의 준말입니다. 수포자 삼인방은 모의고사에 수학 문제를
// 전부 찍으려 합니다. 수포자는 1번 문제부터 마지막 문제까지 다음과 같이 찍습니다.
//   1번 수포자가 찍는 방식: 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, ...
//   2번 수포자가 찍는 방식: 2, 1, 2, 3, 2, 4, 2, 5, 2, 1, 2, 3, 2, 4, 2, 5, ...
//   3번 수포자가 찍는 방식: 3, 3, 1, 1, 2, 2, 4, 4, 5, 5, 3, 3, 1, 1, 2, 2, 4, 4, 5, 5, ...
// 1번 문제부터 마지막 문제까지의 정답이 순서대로 들은 배열 answers가 주어졌을 때,
// 가장 많은 문제를 맞힌 사람이 누구인지 배열에 담아 return 하도록 solution 함수를
// 작성하세요. 가장 많이 맞힌 사람이 여럿이면 번호를 오름차순으로 정렬합니다.
//
// [제한 조건]
//   - 시험은 최대 10,000 문제로 구성되어 있습니다.
//   - 문제의 정답은 1, 2, 3, 4, 5 중 하나입니다.
//   - 가장 높은 점수를 받은 사람이 여럿일 경우, return 하는 값을 오름차순 정렬해 주세요.
//
// [입출력 예]
//   answers            | return
//   [1,2,3,4,5]        | [1]
//   [1,3,2,4,2]        | [1,2,3]

#include <string>
#include <vector>

using namespace std;

vector<int> solution(vector<int> answers) {
    vector<int> answer;

    const vector<int> p1 = {1, 2, 3, 4, 5};
    const vector<int> p2 = {2, 1, 2, 3, 2, 4, 2, 5};
    const vector<int> p3 = {3, 3, 1, 1, 2, 2, 4, 4, 5, 5};

    int score[3] = {0, 0, 0};
    for (int i = 0; i < (int)answers.size(); ++i) {
        if (answers[i] == p1[i % p1.size()]) ++score[0];
        if (answers[i] == p2[i % p2.size()]) ++score[1];
        if (answers[i] == p3[i % p3.size()]) ++score[2];
    }

    int best = max({score[0], score[1], score[2]});
    for (int i = 0; i < 3; ++i) {
        if (score[i] == best) answer.push_back(i + 1);
    }

    return answer;
}
```

세 사람의 찍기 패턴은 길이가 5, 8, 10으로 제각각이지만 계속 반복된다는 점이 같다. 패턴을 배열로 박아두고 `i % 패턴길이`로 인덱스를 돌리면 무한 반복을 따로 만들 필요가 없다. 최고점자가 여럿일 수 있어서 최고점을 먼저 구한 뒤 같은 점수를 전부 담는 순서로 처리했다.

> **오늘 배운 것** — 반복되는 패턴은 배열 하나와 나머지 연산(`i % size`)만으로 순회할 수 있다. 동점자 처리는 최댓값을 먼저 확정한 뒤 같은 점수를 모두 담는 2패스가 깔끔하다.
{: .prompt-tip }

