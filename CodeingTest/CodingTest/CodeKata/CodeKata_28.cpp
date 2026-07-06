//https://school.programmers.co.kr/learn/courses/30/lessons/42747

#include <vector>
#include <algorithm>
#include <functional>

using namespace std;

int solution(vector<int> citations) {
    sort(citations.begin(), citations.end(), greater<int>()); // 내림차순 정렬

    int h = 0;
    while (h < (int)citations.size() && citations[h] >= h + 1)
        h++;                                  // h+1번째 논문도 h+1회 이상 인용됐으면 h 확장
    return h;
}
