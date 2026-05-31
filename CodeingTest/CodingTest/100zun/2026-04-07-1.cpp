// 프로그래머스 Lv.1 - 서울에서 김서방 찾기
// https://school.programmers.co.kr/learn/courses/30/lessons/12919
//
// [문제]  String 배열 seoul에서 "Kim"의 위치 x를 찾아 "김서방은 x에 있다"를 반환
// [제약]  seoul 길이 1~1000 / 원소 길이 1~20 / "Kim"은 반드시 한 번 포함
// [입출력]  ["Jane","Kim"] → "김서방은 1에 있다"
//
// 풀이: 선형 탐색으로 "Kim"의 인덱스를 찾아 문자열로 조립 — O(n)

#include <string>
#include <vector>

using namespace std;

string solution(vector<string> seoul) {
    string answer = "";
    for (int i = 0; i < (int)seoul.size(); i++) {
        if (seoul[i] == "Kim") {
            answer = "김서방은 " + to_string(i) + "에 있다";
            break;
        }
    }
    return answer;
}
