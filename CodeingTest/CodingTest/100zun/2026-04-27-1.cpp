// LeetCode 912 - Sort an Array (Medium)
// https://leetcode.com/problems/sort-an-array/

// 문제 설명
// 정수 배열 nums를 오름차순으로 정렬하여 반환
// 내장 정렬 함수 사용 금지, O(nlogn) 시간 / 가능한 최소 공간

// 입력
// nums = [5,2,3,1]

// 출력
// [1,2,3,5]

// 풀이 비교
// Merge Sort  : 시간 O(nlogn) / 공간 O(n)  — 임시 배열 필요, 안정 정렬
// Heap Sort   : 시간 O(nlogn) / 공간 O(1)  — in-place, 불안정 정렬
// → 공간 제약이 없으면 Merge Sort, 최소 공간이 목표면 Heap Sort

#include <iostream>
#include <vector>
using namespace std;

// 내 풀이: Merge Sort (O(nlogn) 시간, O(n) 공간)
class Solution {
    void merge(vector<int>& nums, int left, int mid, int right) {
        vector<int> temp(right - left + 1);
        int i = left, j = mid + 1, k = 0;

        while (i <= mid && j <= right) {
            if (nums[i] <= nums[j]) temp[k++] = nums[i++];
            else                    temp[k++] = nums[j++];
        }
        while (i <= mid)   temp[k++] = nums[i++];
        while (j <= right) temp[k++] = nums[j++];

        for (int x = 0; x < (int)temp.size(); x++)
            nums[left + x] = temp[x];
    }

    void mergeSort(vector<int>& nums, int left, int right) {
        if (left >= right) return;
        int mid = left + (right - left) / 2;
        mergeSort(nums, left, mid);
        mergeSort(nums, mid + 1, right);
        merge(nums, left, mid, right);
    }

public:
    vector<int> sortArray(vector<int>& nums) {
        mergeSort(nums, 0, (int)nums.size() - 1);
        return nums;
    }
};

// 추천 풀이: Heap Sort (O(nlogn) 시간, O(1) 공간)
// max-heap 구성 후 루트(최댓값)를 끝으로 보내며 정렬, 추가 배열 불필요
class Solution2 {
    void heapify(vector<int>& nums, int n, int i) {
        int largest = i;
        int l = 2 * i + 1, r = 2 * i + 2;
        if (l < n && nums[l] > nums[largest]) largest = l;
        if (r < n && nums[r] > nums[largest]) largest = r;
        if (largest != i) {
            swap(nums[i], nums[largest]);
            heapify(nums, n, largest);
        }
    }

public:
    vector<int> sortArray(vector<int>& nums) {
        int n = nums.size();
        for (int i = n / 2 - 1; i >= 0; i--)
            heapify(nums, n, i);
        for (int i = n - 1; i > 0; i--) {
            swap(nums[0], nums[i]);
            heapify(nums, i, 0);
        }
        return nums;
    }
};
