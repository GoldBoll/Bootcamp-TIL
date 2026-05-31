// 프로그래머스 Lv.1 - 모의고사
// https://school.programmers.co.kr/learn/courses/30/lessons/42840
//
// [문제]  세 수포자의 찍기 패턴으로 가장 많이 맞힌 사람을 오름차순으로 반환
// [제약]  최대 10,000 문제 / 정답은 1~5 / 동점이면 오름차순
// [입출력]  [1,2,3,4,5] → [1] / [1,3,2,4,2] → [1,2,3]
//
// 풀이: 각 패턴을 주기로 순환 비교해 점수 집계, 최고점자를 번호 순으로 수집 — O(n)

#include <string>
#include <vector>
#include <algorithm>

using namespace std;

vector<int> solution(vector<int> answers) {
    vector<int> p1 = {1, 2, 3, 4, 5};
    vector<int> p2 = {2, 1, 2, 3, 2, 4, 2, 5};
    vector<int> p3 = {3, 3, 1, 1, 2, 2, 4, 4, 5, 5};
    int score[3] = {0, 0, 0};
    for (int i = 0; i < (int)answers.size(); i++) {
        if (answers[i] == p1[i % 5]) score[0]++;
        if (answers[i] == p2[i % 8]) score[1]++;
        if (answers[i] == p3[i % 10]) score[2]++;
    }
    int best = max({score[0], score[1], score[2]});
    vector<int> answer;
    for (int i = 0; i < 3; i++) {
        if (score[i] == best) answer.push_back(i + 1);
    }
    return answer;
}
