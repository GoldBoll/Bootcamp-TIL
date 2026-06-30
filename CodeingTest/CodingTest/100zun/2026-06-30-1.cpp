// LeetCode 643 - Maximum Average Subarray I (Easy)
// https://leetcode.com/problems/maximum-average-subarray-i/

// 문제 설명
// 정수 배열 nums(n개)와 정수 k가 주어진다.
// 길이가 정확히 k인 연속 부분배열 중 평균이 최대인 것을 찾아 그 평균값을 반환하라.
// 오차 10^-5 이하면 정답으로 인정된다.

// 제약 조건
// n == nums.length
// 1 <= k <= n <= 10^5
// -10^4 <= nums[i] <= 10^4

// Example 1
// Input : nums = [1,12,-5,-6,50,3], k = 4
// Output: 12.75000
//   최대 평균 (12 - 5 - 6 + 50) / 4 = 51 / 4 = 12.75
//
// Example 2
// Input : nums = [5], k = 1
// Output: 5.00000

// 접근 — 고정 크기 슬라이딩 윈도우
// 평균이 최대 ⇄ 길이가 k로 고정이므로 "합이 최대"인 윈도우를 찾으면 된다.
// 1) 먼저 앞 k개의 합을 구해 첫 윈도우 합 sum과 최댓값 best로 둔다.
// 2) i = k 부터 끝까지 한 칸씩 밀며 sum += nums[i] - nums[i-k]
//    (새로 들어온 원소를 더하고, 빠진 원소를 뺀다 — 매번 다시 더하지 않음)
// 3) 매 단계 best = max(best, sum)
// 마지막에 best / k 를 double로 반환.
// 시간 O(n), 공간 O(1)

#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    double findMaxAverage(vector<int>& nums, int k)
    {
        int sum = 0;
        for (int i = 0; i < k; ++i) sum += nums[i];   // 첫 윈도우 합

        int best = sum;
        for (int i = k; i < (int)nums.size(); ++i)
        {
            sum += nums[i] - nums[i - k];             // 한 칸 밀기: 더하고 빼기
            best = max(best, sum);
        }

        return (double)best / k;
    }
};
