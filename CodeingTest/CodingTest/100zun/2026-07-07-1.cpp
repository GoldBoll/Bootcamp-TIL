// LeetCode 560 - Subarray Sum Equals K (Medium)
// https://leetcode.com/problems/subarray-sum-equals-k/

// 문제 설명
// 정수 배열 nums와 정수 k가 주어질 때,
// 합이 정확히 k인 연속 부분배열(subarray)의 총 개수를 반환하라.

// 제약 조건
// 1 <= nums.length <= 2 * 10^4
// -1000 <= nums[i] <= 1000
// -10^7 <= k <= 10^7

// Example 1
// Input : nums = [1,1,1], k = 2
// Output: 2   ([1,1] 두 개)
//
// Example 2
// Input : nums = [1,2,3], k = 3
// Output: 2   ([1,2], [3])

// 접근 — 프리픽스 합 + 해시맵(등장 횟수 카운팅)
// 음수가 있어 슬라이딩 윈도우 불가(윈도우를 줄여도 합이 커질 수 있음). 완전 탐색은 O(n^2).
// 구간 [i..j]의 합이 k  ⇄  p[j] - p[i-1] = k  ⇄  p[i-1] = p[j] - k.
// 1) 누적합 s를 왼쪽부터 흘리며 "누적합 값 → 지금까지 등장 횟수"를 해시맵 cnt에 기록.
// 2) 각 위치에서 cnt[s - k]를 답에 더한다 — 현재 위치에서 끝나는 정답 구간의 개수.
// 3) cnt[0] = 1 로 시작(빈 접두사) — 배열 처음부터 시작하는 구간을 자동 포함.
// 시간 평균 O(n), 공간 O(n)

#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    int subarraySum(vector<int>& nums, int k)
    {
        unordered_map<int, int> cnt;                  // 누적합 값 → 등장 횟수
        cnt[0] = 1;                                   // 빈 접두사

        int s = 0, answer = 0;
        for (int x : nums)
        {
            s += x;
            auto it = cnt.find(s - k);                // 나보다 k 작은 누적합이 몇 번 나왔나
            if (it != cnt.end()) answer += it->second;
            ++cnt[s];                                 // 등록은 조회 뒤 — k=0일 때 자기 자신 중복 방지
        }
        return answer;
    }
};
