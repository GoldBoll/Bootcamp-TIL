//https://school.programmers.co.kr/learn/courses/30/lessons/87390

#include <vector>
#include <algorithm>

using namespace std;

vector<int> solution(int n, long long left, long long right) {
    vector<int> answer;
    answer.reserve(right - left + 1);

    for (long long k = left; k <= right; k++)           // 1차원 인덱스 k만 순회
        answer.push_back((int)(max(k / n, k % n) + 1)); // (행, 열) = (k/n, k%n), 값 = max+1
    return answer;
}
