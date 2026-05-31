// 프로그래머스 Lv.1 - 명예의 전당 (1)
// https://school.programmers.co.kr/learn/courses/30/lessons/138477
//
// [문제]  매일 상위 k개 점수(명예의 전당)의 최하위 점수를 날마다 반환
// [제약]  3 ≤ k ≤ 100 / 7 ≤ score 길이 ≤ 1,000 / 0 ≤ score[i] ≤ 2,000
// [입출력]  k=3, [10,100,20,150,1,100,200] → [10,10,10,20,20,100,100]
//
// 풀이: 크기 k의 최소 힙 유지. 매일 점수를 넣고 k를 넘으면 최솟값을 제거,
//        남은 힙의 top(최솟값)이 그날 발표할 최하위 점수 — O(n log k)

#include <string>
#include <vector>
#include <queue>

using namespace std;

vector<int> solution(int k, vector<int> score) {
    vector<int> answer;
    priority_queue<int, vector<int>, greater<int>> minHeap;
    for (int s : score) {
        minHeap.push(s);
        if ((int)minHeap.size() > k) {
            minHeap.pop();
        }
        answer.push_back(minHeap.top());
    }
    return answer;
}
