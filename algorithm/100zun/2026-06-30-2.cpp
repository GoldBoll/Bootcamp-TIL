// LeetCode 3 - Longest Substring Without Repeating Characters (Medium)
// https://leetcode.com/problems/longest-substring-without-repeating-characters/

// 문제 설명
// 문자열 s가 주어진다. 중복 문자가 없는 가장 긴 "부분문자열(substring)"의 길이를 반환하라.
// substring은 연속이어야 한다(subsequence 아님).

// 제약 조건
// 0 <= s.length <= 5 * 10^4
// s는 영문자·숫자·기호·공백으로 구성된다.

// Example 1
// Input : s = "abcabcbb"
// Output: 3   → "abc"
//
// Example 2
// Input : s = "bbbbb"
// Output: 1   → "b"
//
// Example 3
// Input : s = "pwwkew"
// Output: 3   → "wke" ("pwke"는 subsequence라 오답)

// 접근 — 가변 크기 슬라이딩 윈도우 + 마지막 등장 위치 기록
// [left, right] 구간을 "중복 없는 윈도우"로 유지하며 right를 끝까지 민다.
// last[c] = 문자 c가 마지막으로 나온 인덱스.
// right의 문자 c가 이미 윈도우 안(last[c] >= left)에 있으면,
// left를 last[c] + 1 로 점프시켜 중복을 윈도우 밖으로 밀어낸다.
// 그 다음 last[c] = right로 갱신하고 best = max(best, right - left + 1).
// left를 한 칸씩 줄이지 않고 "바로 점프"하는 게 핵심 — 전체 O(n).
// last는 char 전 범위(256)를 덮는 배열로 두어 영문/숫자/기호/공백 모두 처리.
// 시간 O(n), 공간 O(1) (고정 크기 256 배열)

#include <string>
#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    int lengthOfLongestSubstring(string s)
    {
        vector<int> last(256, -1);   // 아직 등장 안 한 문자는 -1
        int best = 0, left = 0;

        for (int right = 0; right < (int)s.size(); ++right)
        {
            unsigned char c = s[right];
            if (last[c] >= left)         // 윈도우 안에서 중복 발견
                left = last[c] + 1;      // 중복 직후로 left 점프

            last[c] = right;
            best = max(best, right - left + 1);
        }

        return best;
    }
};
