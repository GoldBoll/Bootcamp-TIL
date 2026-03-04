#pragma once
#include <string>
#include <vector>
#include <iostream>
using namespace std;

#ifdef RUN_PROGRAMMERS_BEGGINNING_01


int solution(vector<string> babbling) {
    int answer = 0;
    vector<string> token = {"aya", "ye", "woo", "ma"};

    // range-based for: babbling의 각 단어를 복사 없이(const reference) 순회
    for (const string& word : babbling) {
        vector<bool> used(4, false); // 각 발음은 최대 1번만 사용
        int pos = 0;                 // 현재 읽는 위치(왼쪽부터 소비)
        bool ok = true;

        // while 사용 이유: 단어 길이 끝까지 pos를 전진시키며 확인
        // (시간복잡도는 단어 길이 L에 비례, 전체 O(N * L * 4))
        while (pos < (int)word.size()) {
            bool match = false;

            for (int j = 0; j < (int)token.size(); j++) {
                int len = (int)token[j].size();

                // compare(pos, len, token[j]) == 0 :
                // word의 pos부터 len글자가 token[j]와 같으면 매칭
                if (!used[j] &&
                    pos + len <= (int)word.size() &&
                    word.compare(pos, len, token[j]) == 0) {
                    used[j] = true;
                    pos += len;      // 매칭된 길이만큼 이동
                    match = true;
                    break;
                    }
            }

            // 중요: 이 실패 판정은 for문 밖에 있어야 함
            // 토큰 전체를 다 확인한 뒤에도 매칭이 없을 때만 실패
            if (!match) {
                ok = false;
                break;
            }
        }

        // 카운트 증가 시점: '단어 하나' 검증이 끝난 뒤에만 증가
        if (ok && pos == (int)word.size()) {
            answer++;
        }
    }

    return answer;
}
int main()
{
    vector<string> test = {"ayaye", "uuuma", "ye", "yemawoo", "ayaa"};
    cout <<solution(test) << endl;
    
    
    return 0;
}
#endif


// 문제 1) 미니 버전 (토큰 2개)

// 발음 가능한 토큰이 "ab", "cd" 두 개뿐이고, 각 토큰은 단어당 최대 1번만 사용 가능하다.
// 문자열 배열 words가 주어질 때, 발음 가능한 단어 개수를 구해라.

// 입력 예시
// ["ab", "cd", "abcd", "cdab", "abab", "a", "abc"]

// 기대 출력
// 4

// 힌트
// - "ab", "cd", "abcd", "cdab"만 가능
// • "abab"는 "ab" 2번이라 불가


#ifdef RUN_PROGRAMMERS_BEGGINNING_01_01
int solution(vector<string> babbling)
{
    int answer = 0;
    vector<string> token = {"ab","cd"};
    
    for (const string& word: babbling)
    {
        vector<bool> used(2,false);
        int pos =0;
        bool ok = true;
        
        while (pos < (int)word.size())
        {
            bool match = false;
            
            for (int j= 0; j < token.size(); j++)
            {
                int len = (int)token[j].size();
                if (!used[j] && pos + len <= (int)word.size() 
                    && word.compare(pos,len,token[j]) == 0)
                {
                    used[j] = true;
                    pos += len;
                    match = true;
                    break;
                }
            }
            if (!match)
            {
                ok = false;
                break;
            }
        }
        if (ok && pos == (int)word.size())
        {
            answer++;
        }
    }
    
    return answer;
}

int main()
{
    vector<string> test = {"ab", "cd", "abcd", "cdab", "abab", "a", "abc"};
    cout <<solution(test) << endl;
    
    
    return 0;
}


#endif

#ifdef RUN_PROGRAMMERS_BEGGINNING_01_02
int solution(vector<string> babbling)
{
    int answer = 0;
    int count = 0;
    vector<string> validWords;
    vector<string> token = {"aya", "ye", "woo", "ma"};
    
    for (const string& word: babbling)
    {
        vector<bool> used(4,false);
        int pos =0;
        bool ok = true;
        
        while (pos < (int)word.size())
        {
            bool match = false;
            
            for (int j= 0; j < token.size(); j++)
            {
                int len = (int)token[j].size();
                if (!used[j] && pos + len <= (int)word.size() 
                    && word.compare(pos,len,token[j]) == 0)
                {
                    used[j] = true;
                    pos += len;
                    match = true;
                    break;
                }
            }
            if (!match)
            {
                ok = false;
                break;
            }
        }
        if (ok && pos == (int)word.size())
        {
            answer++;
            count++;
            validWords.push_back(word);
        }
    }
    
    for (int i = 0; i < validWords.size(); i++)
    {
        cout << validWords[i] << endl;
    }
    
    cout << count << endl;
    return answer;
}


int main()
{
    vector<string> test = {"yewoo", "wooye", "mayeaya", "ayawooma", "woowoo", "aya"};
    cout <<solution(test) << endl;
    
    return 0;
}
#endif
