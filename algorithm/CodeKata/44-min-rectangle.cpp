// 프로그래머스 86491 - 최소직사각형 (Lv.1)
// https://school.programmers.co.kr/learn/courses/30/lessons/86491

// 문제 설명
// 명함 크기 [w, h]의 배열 sizes가 주어진다. 명함은 회전시킬 수 있고,
// 지갑 크기는 "가장 긴 가로 x 가장 긴 세로"로 결정된다.
// 모든 명함을 수납할 수 있는 최소 크기 지갑의 넓이를 반환하라.

// 제약 조건
// 1 <= sizes 길이 <= 10,000
// 각 원소는 [w, h], 1 <= w, h <= 1,000 인 자연수

// Example
// Input : [[60,50],[30,70],[60,30],[80,40]]
// Output: 4000   (긴 변 최댓값 80 x 짧은 변 최댓값 50)
//
// Input : [[10,7],[12,3],[8,15],[14,7],[5,15]]
// Output: 120    (15 x 8)
//
// Input : [[14,4],[19,6],[6,16],[18,7],[7,11]]
// Output: 133    (19 x 7)

// 접근 — 회전을 (긴 변, 짧은 변)으로 정규화하면 두 축이 독립
// 회전은 명함마다 독립으로 고를 수 있고 지갑은 max(가로) x max(세로)다.
// 어떤 명함의 긴 변을 세로로 돌리면 세로 최댓값만 커지거나 그대로이므로(교환 논증)
// 모든 명함의 긴 변을 같은 축으로 몰아주는 선택이 항상 최적이다.
// 1) 명함마다 max(w,h) = 긴 변, min(w,h) = 짧은 변으로 정규화한다.
// 2) 긴 변의 최댓값과 짧은 변의 최댓값을 각각 따로 갱신한다.
// 3) 두 최댓값의 곱이 답. 정렬도 조합 탐색도 필요 없다.
// 시간 O(n), 공간 O(1). 넓이 상한 1000 x 1000 = 1,000,000이라 int로 충분

#include <vector>
#include <algorithm>

using namespace std;

int solution(vector<vector<int>> sizes) {
    int maxLong = 0, maxShort = 0;                              // 긴 변 / 짧은 변 각각의 최댓값

    for (auto& s : sizes) {                                     // 인덱스가 필요 없으므로 범위 기반 for
        maxLong = max(maxLong, max(s[0], s[1]));                // 회전해서 긴 변을 한 축으로 몰아준다
        maxShort = max(maxShort, min(s[0], s[1]));              // 남은 짧은 변은 다른 축으로
    }

    return maxLong * maxShort;
}
