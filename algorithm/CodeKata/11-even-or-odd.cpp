//https://school.programmers.co.kr/learn/courses/30/lessons/12937

#include <string>

using namespace std;

string solution(int num) {
    return num % 2 == 0 ? "Even" : "Odd";   // 0과 비교 — 음수에서 나머지가 -1이라 == 1은 틀린다
}
