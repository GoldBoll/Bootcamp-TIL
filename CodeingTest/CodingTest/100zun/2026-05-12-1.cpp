// LeetCode 35 - Search Insert Position (Easy)
// https://leetcode.com/problems/search-insert-position/

// 문제 설명
// 정렬된 distinct integer 배열 nums와 target이 주어진다.
// target이 존재하면 그 인덱스를, 없으면 정렬을 유지한 채 삽입될 인덱스를 반환
// 반드시 O(log n) 시간 복잡도로 풀이해야 한다.

// 제약 조건
// 1 <= nums.length <= 10^4
// -10^4 <= nums[i] <= 10^4
// nums는 오름차순 정렬, 모든 원소는 distinct
// -10^4 <= target <= 10^4

// 예시
// nums = [1,3,5,6], target = 5 → 2   (5가 인덱스 2에 존재)
// nums = [1,3,5,6], target = 2 → 1   (1과 3 사이, 인덱스 1에 삽입)
// nums = [1,3,5,6], target = 7 → 4   (배열 끝에 삽입)

// 풀이 비교
// 선형 탐색          : 시간 O(n)     — 제약(O(log n))을 만족하지 못함
// 이분 탐색 (lower_bound) : 시간 O(log n) — target 이상의 첫 원소 위치 = 삽입 위치
// STL lower_bound  : 시간 O(log n) — 같은 원리, 코드 한 줄

// 핵심 아이디어
// "target이 들어갈 자리" = "target 이상인 첫 원소의 인덱스"
// 즉, lower_bound 그대로다. target이 존재하면 그 위치, 없으면 삽입 위치가 같다.
// 오버플로우 회피: mid = left + (right - left) / 2

#include <vector>
using namespace std;

// 내 풀이 #1 — 이분 탐색 (lower_bound) O(log n) / 공간 O(1)
// [left, right) 반열린 구간으로 탐색 — right = nums.size()로 시작해 삽입 위치까지 자연스럽게 반환
class Solution {
public:
    int searchInsert(vector<int>& nums, int target)
    {
        int left = 0;
        int right = (int)nums.size();

        while (left < right)
        {
            int mid = left + (right - left) / 2;
            if (nums[mid] < target)
                left = mid + 1;
            else
                right = mid;
        }
        return left;
    }
};

// 추천 풀이 #2 — STL lower_bound O(log n) / 공간 O(1)
// 표준 라이브러리로 같은 동작을 한 줄에 — 면접에선 #1을 손으로 쓰고 실무에선 이걸 쓴다
class Solution2 {
public:
    int searchInsert(vector<int>& nums, int target)
    {
        return (int)(lower_bound(nums.begin(), nums.end(), target) - nums.begin());
    }
};
