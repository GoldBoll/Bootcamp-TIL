---
title: "프로그래머스 — CodeKata 07"
date: 2026-03-04 13:00:00 +0900
categories: ["알고리즘", "프로그래머스"]
tags: ["algorithm"]
render_with_liquid: false
description: "머쓱이는 태어난 지 6개월 된 조카를 돌보고 있습니다. 조카는 아직 'aya', 'ye', 'woo', 'ma' 네 가지 발음을 최대 한 번씩 사용해 조합한(이어 붙인) 발음밖에 하지 못합니다. 문자열 배열 babbling이 매개변수로 주어질 때, 머쓱이의 조카가 발음할 수 있는 단어의 개수를 return하도록 solution 함수를 완성해주세요."
image: /assets/img/thumbs/programmers.svg
---

네 가지 발음 토큰을 각각 최대 1번씩만 써서 만들 수 있는 단어를 세는 문제. pos 포인터로 단어를 왼쪽부터 소비하면서 `compare(pos, len, tok)`으로 토큰을 매칭하고, used 배열로 발음별 1회 제한을 걸었다. 단어 끝까지 소비에 성공한 경우만 카운트한다.

```cpp
//7.옹알이 (1)

// 문제 설명
// 머쓱이는 태어난 지 6개월 된 조카를 돌보고 있습니다. 조카는 아직 "aya", "ye", "woo", "ma" 네 가지 발음을 최대 한 번씩 사용해 조합한(이어 붙인) 발음밖에 하지 못합니다. 문자열 배열 babbling이 매개변수로 주어질 때, 머쓱이의 조카가 발음할 수 있는 단어의 개수를 return하도록 solution 함수를 완성해주세요.

// 제한사항
// 1 ≤ babbling의 길이 ≤ 100
// 1 ≤ babbling[i]의 길이 ≤ 15
// babbling의 각 문자열에서 "aya", "ye", "woo", "ma"는 각각 최대 한 번씩만 등장합니다.
// 즉, 각 문자열의 가능한 모든 부분 문자열 중에서 "aya", "ye", "woo", "ma"가 한 번씩만 등장합니다.
// 문자열은 알파벳 소문자로만 이루어져 있습니다.

#include <string>
#include <vector>

using namespace std;

int solution(vector<string> babbling) {
    int answer = 0;
    vector<string> tok = {"aya","ye", "woo" , "ma"};
    
    for(const string& word : babbling)
    {
        vector<bool> used(4,false);
        int pos = 0;
        bool ok = true;
        
        while(pos<(int)word.size())
        {
            bool matched = false;
            
            for(int j=0; j < 4; j++)
            {
                int len = (int)tok[j].size();
                
                if(!used[j] && pos + len <= (int)word.size()
                  && word.compare(pos,len, tok[j]) == 0)
                {
                    used[j] = true;
                    pos += len;
                    matched = true;
                    break;
                }
            }
            if(!matched)
            {
                ok = false;
                break;
            }
        }
        if(ok && pos == (int)word.size())
        {
            answer++;
        }
    }
    
    
    return answer;
}
```

> **오늘 배운 것** — 문자열을 pos 포인터로 왼쪽부터 소비하며 토큰을 매칭하는 패턴을 익혔다. `pos == word.size()`까지 도달했는지가 성공 판정 기준이고, used 배열이 토큰별 사용 횟수 제한을 담당한다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "토큰 조합으로 만들 수 있는 문자열인지 어떻게 판정하나요?" → pos 포인터 소비, compare(pos, len, tok), used 플래그, 끝까지 소비 성공 여부
{: .prompt-info }
