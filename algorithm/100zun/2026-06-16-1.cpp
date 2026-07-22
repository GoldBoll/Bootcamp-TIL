// LeetCode 416 - Partition Equal Subset Sum (Medium)
// https://leetcode.com/problems/partition-equal-subset-sum/

// 문제 설명
// 양의 정수 배열 nums가 주어진다.
// 배열을 두 개의 부분집합으로 나눠 두 집합의 원소 합이 같게 만들 수 있으면 true,
// 불가능하면 false를 반환하라.

// 제약 조건
// 1 <= nums.length <= 200
// 1 <= nums[i] <= 100

// Example 1
// Input : nums = [1,5,11,5]
// Output: true
//   [1,5,5]와 [11] → 둘 다 합 11.
//
// Example 2
// Input : nums = [1,2,3,5]
// Output: false
//   합이 11(홀수)이라 절반으로 나눌 수 없다.

// 접근 — DP (0/1 냅색 / subset sum)
// 두 집합의 합이 같으려면 각 집합의 합은 전체 합의 절반이어야 한다.
// 1) 전체 합 sum이 홀수면 절반으로 못 나눔 → 즉시 false
// 2) target = sum/2 를 "정확히" 만드는 부분집합이 있는지 묻는 문제로 환원
//    (나머지 원소는 자동으로 나머지 절반이 됨)
// 3) dp[j] = 원소들을 골라 합 j를 만들 수 있는가
//    각 num에 대해 j를 target..num 으로 "역순" 순회하며 dp[j] |= dp[j-num]
//    역순이어야 같은 num을 두 번 쓰는 일을 막는다(0/1 냅색의 핵심)
// 시간 O(n * target), 공간 O(target)

#include <vector>
#include <numeric>
using namespace std;

class Solution {
public:
    bool canPartition(vector<int>& nums)
    {
        int sum = accumulate(nums.begin(), nums.end(), 0);
        if (sum % 2 != 0) return false;     // 홀수 합은 양분 불가

        int target = sum / 2;
        vector<bool> dp(target + 1, false);
        dp[0] = true;                       // 합 0은 아무것도 안 골라도 가능

        for (int num : nums)
            for (int j = target; j >= num; --j)   // 역순: 각 원소는 한 번만 사용
                if (dp[j - num]) dp[j] = true;

        return dp[target];
    }
};
