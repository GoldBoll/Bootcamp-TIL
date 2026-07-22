// 프로그래머스 Lv.1 - 삼총사
// https://school.programmers.co.kr/learn/courses/30/lessons/131705
//
// [문제]  서로 다른 세 학생의 번호 합이 0이 되는 경우의 수를 반환
// [제약]  number 길이 3~13 / 각 원소 -1,000 ~ 1,000 (중복 값 가능)
// [입출력]  [-2,3,0,2,-5]→2 / [-3,-2,-1,0,1,2,3]→5 / [-1,1,-1,1]→0
//
// 풀이: 길이가 13 이하로 작아 세 개를 모두 고르는 완전탐색 — O(n³)

#include <string>
#include <vector>

using namespace std;

int solution(vector<int> number) {
    int answer = 0;
    int n = (int)number.size();
    for (int i = 0; i < n - 2; i++) {
        for (int j = i + 1; j < n - 1; j++) {
            for (int k = j + 1; k < n; k++) {
                if (number[i] + number[j] + number[k] == 0) {
                    answer++;
                }
            }
        }
    }
    return answer;
}
