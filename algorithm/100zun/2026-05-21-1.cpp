// 프로그래머스 Lv.1 - 과일 장수
// https://school.programmers.co.kr/learn/courses/30/lessons/135808
//
// [문제]  사과 m개씩 한 상자, 상자 가격 = (상자 최저점)*m. 최대 이익을 반환
// [제약]  3 ≤ k ≤ 9 / 3 ≤ m ≤ 10 / 7 ≤ score 길이 ≤ 1,000,000 / 1 ≤ score[i] ≤ k
// [입출력]  k=3,m=4,[1,2,3,1,2,3,1] → 8 / k=4,m=3,[...] → 33
//
// 풀이: 내림차순 정렬하면 매 m번째 원소가 그 상자의 최저점.
//        그 값들에 m을 곱해 합산(남는 사과는 자동 제외) — O(n log n)

#include <string>
#include <vector>
#include <algorithm>

using namespace std;

int solution(int k, int m, vector<int> score) {
    sort(score.rbegin(), score.rend());
    int answer = 0;
    for (int i = m - 1; i < (int)score.size(); i += m) {
        answer += score[i] * m;
    }
    return answer;
}
