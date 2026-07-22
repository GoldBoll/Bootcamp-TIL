// 프로그래머스 Lv.1 - 크기가 작은 부분문자열
// https://school.programmers.co.kr/learn/courses/30/lessons/147355
//
// [문제]  t의 부분문자열(길이=p) 중 나타내는 수가 p 이하인 것의 개수를 반환
// [제약]  p 길이 1~18 / p 길이 ≤ t 길이 ≤ 10,000 / 숫자 문자열, 0으로 시작 안 함
// [입출력]  "3141592","271"→2 / "500220839878","7"→8 / "10203","15"→3
//
// 풀이: 길이 p인 부분문자열을 슬라이딩하며 수 비교.
//        18자리까지 가능해 unsigned long long으로 변환 — O(n*|p|)

#include <string>
#include <vector>

using namespace std;

int solution(string t, string p) {
    int answer = 0;
    int lp = (int)p.size();
    unsigned long long pv = stoull(p);
    for (int i = 0; i + lp <= (int)t.size(); i++) {
        unsigned long long sub = stoull(t.substr(i, lp));
        if (sub <= pv) {
            answer++;
        }
    }
    return answer;
}
