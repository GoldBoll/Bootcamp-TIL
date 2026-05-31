// 프로그래머스 Lv.1 - 숫자 문자열과 영단어 (2021 카카오 인턴)
// https://school.programmers.co.kr/learn/courses/30/lessons/81301
//
// [문제]  일부 자릿수가 영단어로 바뀐 문자열 s에서 원래 숫자를 반환
// [제약]  s 길이 1~50 / "zero"·"0"으로 시작 안 함 / 결과는 1~2,000,000,000
// [입출력]  "one4seveneight"→1478 / "23four5six7"→234567 / "123"→123
//
// 풀이: 각 영단어를 대응 숫자로 치환한 뒤 정수 변환 — O(|s|)

#include <string>
#include <vector>

using namespace std;

int solution(string s) {
    vector<string> words = {"zero", "one", "two", "three", "four",
                            "five", "six", "seven", "eight", "nine"};
    for (int i = 0; i < 10; i++) {
        size_t pos;
        while ((pos = s.find(words[i])) != string::npos) {
            s.replace(pos, words[i].size(), to_string(i));
        }
    }
    return stoi(s);
}
