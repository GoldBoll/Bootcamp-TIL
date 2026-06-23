//https://school.programmers.co.kr/learn/courses/30/lessons/42842

#include <string>
#include <vector>

using namespace std;

vector<int> solution(int brown, int yellow) {
    int total = brown + yellow;          // 전체 격자 수 = 가로(w) * 세로(h)

    // 세로(h)를 작은 약수부터 훑는다. h*h<=total이라 항상 w >= h가 보장됨
    for (int h = 1; h * h <= total; h++) {
        if (total % h != 0) continue;    // h가 약수가 아니면 직사각형이 안 나옴
        int w = total / h;               // 가로는 짝이 되는 나머지 약수
        if ((w - 2) * (h - 2) == yellow) // 테두리를 뺀 안쪽이 노란 격자 수와 같으면 정답
            return {w, h};
    }

    return {};
}
