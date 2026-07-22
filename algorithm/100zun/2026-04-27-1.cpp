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
// Merge Sort  : 시간 O(nlogn) / 공간 O(n)     — 임시 배열 필요, 안정 정렬
// Heap Sort   : 시간 O(nlogn) / 공간 O(1)     — in-place, 불안정 정렬
// Quick Sort  : 평균 O(nlogn) / 최악 O(n^2)   — in-place, 불안정 정렬, 캐시 친화 → 실무에서 가장 빠름
// → 안정성 우선이면 Merge, 최소 공간이면 Heap, 평균 속도 우선이면 Quick
//
// 참고: https://velog.io/@yhkim8917/병합정렬Merge-sort-힙정렬-퀵정렬

#include <iostream>
#include <vector>
using namespace std;

// 풀이 #1 — Merge Sort (병합 정렬)
// 시간 O(nlogn) / 공간 O(n) — 안정 정렬
// 배열을 절반씩 나누어 정렬 후 병합 (분할 정복)
// 왼쪽 절반만 버퍼에 복사 → 오른쪽은 원본에서 직접 비교
class Solution {
    void mergeSort(vector<int>& arr, vector<int>& buff, int left, int right) {
        if (left >= right) return;

        int center = (left + right) / 2;
        mergeSort(arr, buff, left, center);
        mergeSort(arr, buff, center + 1, right);

        // 왼쪽 절반을 버퍼에 복사
        int p = 0, j = 0;
        int i = left;
        int k = left;
        while (i <= center) {
            buff[p++] = arr[i++];
        }

        // 버퍼(왼쪽)와 원본(오른쪽 = i ~ right) 병합
        while (j < p && i <= right) {
            if (buff[j] <= arr[i]) arr[k++] = buff[j++];
            else                   arr[k++] = arr[i++];
        }

        // 왼쪽 잔여분 처리 (오른쪽은 이미 제자리)
        while (j < p) {
            arr[k++] = buff[j++];
        }
    }

public:
    vector<int> sortArray(vector<int>& nums) {
        vector<int> buff(nums.size());
        mergeSort(nums, buff, 0, (int)nums.size() - 1);
        return nums;
    }
};

// 풀이 #2 — Heap Sort (힙 정렬)
// 시간 O(nlogn) / 공간 O(1) — in-place, 불안정 정렬
// 1) 배열을 최대 힙으로 구성 (bottom-up heapify)
// 2) 루트(최댓값)를 끝으로 swap → 범위 줄여 heapify 반복
// while 반복으로 heapify 구현 → 콜 스택 0
class Solution2 {
    void heapify(vector<int>& arr, int parent, int lastIdx) {
        int root = arr[parent];

        // 부모 인덱스가 마지막 내부 노드 이하인 동안만 내려감
        while (parent < (lastIdx + 1) / 2) {
            int left  = parent * 2 + 1;
            int right = parent * 2 + 2;
            int child = (right <= lastIdx && arr[right] > arr[left]) ? right : left;

            if (root >= arr[child]) break;

            arr[parent] = arr[child];
            parent = child;
        }

        arr[parent] = root;
    }

public:
    vector<int> sortArray(vector<int>& nums) {
        int n = nums.size();

        // 힙 구성 (마지막 내부 노드부터 위로)
        for (int i = (n - 1) / 2; i >= 0; i--) {
            heapify(nums, i, n - 1);
        }

        // 루트 추출 → 끝으로 swap → 범위 줄여 heapify 반복
        for (int i = n - 1; i > 0; i--) {
            swap(nums[0], nums[i]);
            heapify(nums, 0, i - 1);
        }

        return nums;
    }
};

// 풀이 #3 — Quick Sort (퀵 정렬, 3-way median 피벗)
// 평균 O(nlogn) / 최악 O(n^2) / 공간 O(logn) — 재귀 스택
// 피벗을 기준으로 좌우 분할 (분할 정복)
// 양 끝과 중앙값 중 중간값을 피벗으로 선택해 최악 케이스 회피
class Solution3 {
    // 세 인덱스의 값을 정렬 후 중앙 인덱스 반환 (median-of-three)
    int sort3(vector<int>& arr, int idx1, int idx2, int idx3) {
        if (arr[idx2] < arr[idx1]) swap(arr[idx2], arr[idx1]);
        if (arr[idx3] < arr[idx2]) swap(arr[idx3], arr[idx2]);
        if (arr[idx2] < arr[idx1]) swap(arr[idx2], arr[idx1]);
        return idx2;
    }

    void quickSort(vector<int>& arr, int left, int right) {
        if (left >= right) return;

        // 피벗 = 양 끝과 중앙값 중 중간값
        int m = sort3(arr, left, (left + right) / 2, right);
        int pivot = arr[m];

        // 피벗을 끝-1 위치로 임시 격리
        swap(arr[m], arr[right - 1]);

        int pl = left + 1, pr = right - 2;

        while (pl <= pr) {
            while (arr[pl] < pivot) pl++;
            while (arr[pr] > pivot) pr--;

            if (pl <= pr) {
                swap(arr[pl], arr[pr]);
                pl++;
                pr--;
            }
        }

        if (left < pr)  quickSort(arr, left, pr);
        if (pl < right) quickSort(arr, pl, right);
    }

public:
    vector<int> sortArray(vector<int>& nums) {
        if (nums.size() > 1) {
            quickSort(nums, 0, (int)nums.size() - 1);
        }
        return nums;
    }
};
