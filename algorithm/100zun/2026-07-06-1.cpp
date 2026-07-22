// LeetCode 303 - Range Sum Query - Immutable (Easy)
// https://leetcode.com/problems/range-sum-query-immutable/

// 문제 설명
// 정수 배열 nums가 주어진다. 아래 쿼리를 처리하는 NumArray 클래스를 구현하라.
// sumRange(left, right): nums[left] + ... + nums[right] (양 끝 포함)의 합을 반환.
// 배열은 불변(immutable)이고 sumRange가 여러 번 호출된다.

// 제약 조건
// 1 <= nums.length <= 10^4
// -10^5 <= nums[i] <= 10^5
// 0 <= left <= right < nums.length
// sumRange 호출 최대 10^4회

// Example
// Input : ["NumArray","sumRange","sumRange","sumRange"]
//         [[[-2,0,3,-5,2,-1]],[0,2],[2,5],[0,5]]
// Output: [null,1,-1,-3]
//   sumRange(0,2) = -2+0+3      =  1
//   sumRange(2,5) = 3-5+2-1     = -1
//   sumRange(0,5) = -2+0+3-5+2-1 = -3

// 접근 — 프리픽스 합(prefix sum) 전처리
// 쿼리마다 구간을 직접 더하면 O(n) x 10^4회 = 최악 10^8 연산 — 전처리로 없앤다.
// 1) 생성자에서 누적합 배열 p를 만든다. p[i] = nums[0..i-1]의 합, p[0] = 0.
// 2) 구간 합은 뺄셈 한 번: sumRange(l, r) = p[r+1] - p[l].
// 3) p를 n+1 크기(빈 접두사 포함)로 잡으면 l = 0일 때의 예외 분기가 사라진다.
// 시간: 전처리 O(n) + 쿼리 O(1), 공간 O(n)

#include <vector>
using namespace std;

class NumArray {
    vector<int> p;                                    // p[i] = 앞에서 i개의 합
public:
    NumArray(vector<int>& nums)
    {
        p.assign(nums.size() + 1, 0);
        for (int i = 0; i < (int)nums.size(); ++i)
            p[i + 1] = p[i] + nums[i];                // 누적합 전처리
    }

    int sumRange(int left, int right)
    {
        return p[right + 1] - p[left];                // 구간 합 = 누적합의 차
    }
};
